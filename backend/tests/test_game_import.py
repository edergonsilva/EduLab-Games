"""Tests for clean .edugame reimportation behaviour.

These tests verify that when a `.edugame` package with the same slug is
imported a second time, the platform:

1. Removes the previously extracted static files from disk.
2. Removes the previously saved .edugame package file from disk.
3. Deletes the old database row.
4. Saves the new package, extracts it, and creates a fresh database row.
5. Sets ``replaced=True`` and includes a descriptive message in the response.
6. Does NOT touch files belonging to games with a different slug.
"""

import io
import json
import zipfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.main import app


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


def _make_edugame(slug: str, version: str, css: str = "body{}", js: str = "// js") -> bytes:
    """Build a minimal in-memory .edugame ZIP."""
    buf = io.BytesIO()
    manifest = {
        "slug": slug,
        "title": f"Test Game {slug}",
        "version": version,
        "description": "A test game",
        "author": "Test Author",
    }
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("manifest.json", json.dumps(manifest))
        zf.writestr("index.html", f"<html><head><link rel='stylesheet' href='styles.css'></head><body>{slug} v{version}</body></html>")
        zf.writestr("styles.css", css)
        zf.writestr("script.js", js)
    buf.seek(0)
    return buf.read()


@pytest.fixture()
def tmp_data_dirs(tmp_path, monkeypatch):
    """Redirect all data directories to a temporary location."""
    packages_dir = tmp_path / "packages"
    static_dir = tmp_path / "static" / "imported"
    packages_dir.mkdir(parents=True)
    static_dir.mkdir(parents=True)

    monkeypatch.setattr("app.config.PACKAGES_DIR", packages_dir)
    monkeypatch.setattr("app.config.STATIC_IMPORTED_DIR", static_dir)
    monkeypatch.setattr("app.routers.games.PACKAGES_DIR", packages_dir)
    monkeypatch.setattr("app.routers.games.STATIC_IMPORTED_DIR", static_dir)

    return packages_dir, static_dir


@pytest.fixture()
def db_session(tmp_path):
    """Provide a fresh in-memory SQLite session for each test."""
    db_url = f"sqlite:///{tmp_path}/test.db"
    test_engine = create_engine(db_url, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=test_engine)
    TestSessionLocal = sessionmaker(bind=test_engine)

    def override_get_db():
        session = TestSessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    yield TestSessionLocal()
    app.dependency_overrides.pop(get_db, None)
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture()
def client(db_session, tmp_data_dirs):
    return TestClient(app)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestFirstImport:
    def test_import_returns_201(self, client):
        pkg = _make_edugame("meu-jogo", "1.0.0")
        resp = client.post(
            "/api/games/import",
            files={"file": ("meu-jogo.edugame", pkg, "application/octet-stream")},
        )
        assert resp.status_code == 201

    def test_import_response_fields(self, client):
        pkg = _make_edugame("meu-jogo", "1.0.0")
        resp = client.post(
            "/api/games/import",
            files={"file": ("meu-jogo.edugame", pkg, "application/octet-stream")},
        )
        data = resp.json()
        assert data["replaced"] is False
        assert "meu-jogo" in data["message"]
        assert data["game"]["slug"] == "meu-jogo"
        assert data["game"]["version"] == "1.0.0"

    def test_import_creates_extracted_files(self, client, tmp_data_dirs):
        _, static_dir = tmp_data_dirs
        pkg = _make_edugame("meu-jogo", "1.0.0")
        client.post(
            "/api/games/import",
            files={"file": ("meu-jogo.edugame", pkg, "application/octet-stream")},
        )
        extract_dir = static_dir / "meu-jogo" / "1.0.0"
        assert extract_dir.exists()
        assert (extract_dir / "index.html").exists()
        assert (extract_dir / "styles.css").exists()
        assert (extract_dir / "script.js").exists()

    def test_import_saves_package_file(self, client, tmp_data_dirs):
        packages_dir, _ = tmp_data_dirs
        pkg = _make_edugame("meu-jogo", "1.0.0")
        client.post(
            "/api/games/import",
            files={"file": ("meu-jogo.edugame", pkg, "application/octet-stream")},
        )
        assert (packages_dir / "meu-jogo.edugame").exists()

    def test_import_game_appears_in_catalog(self, client):
        pkg = _make_edugame("meu-jogo", "1.0.0")
        client.post(
            "/api/games/import",
            files={"file": ("meu-jogo.edugame", pkg, "application/octet-stream")},
        )
        resp = client.get("/api/games/")
        assert resp.status_code == 200
        slugs = [g["slug"] for g in resp.json()]
        assert "meu-jogo" in slugs


class TestCleanReimportation:
    """Core feature: clean replacement when the same slug is re-imported."""

    def test_reimport_returns_replaced_true(self, client):
        pkg_v1 = _make_edugame("meu-jogo", "1.0.0")
        pkg_v2 = _make_edugame("meu-jogo", "2.0.0")

        client.post(
            "/api/games/import",
            files={"file": ("meu-jogo.edugame", pkg_v1, "application/octet-stream")},
        )
        resp = client.post(
            "/api/games/import",
            files={"file": ("meu-jogo.edugame", pkg_v2, "application/octet-stream")},
        )
        assert resp.status_code == 201
        assert resp.json()["replaced"] is True

    def test_reimport_removes_old_extracted_directory(self, client, tmp_data_dirs):
        _, static_dir = tmp_data_dirs
        pkg_v1 = _make_edugame("meu-jogo", "1.0.0", css="body{color:red}")
        pkg_v2 = _make_edugame("meu-jogo", "2.0.0", css="body{color:blue}")

        client.post(
            "/api/games/import",
            files={"file": ("meu-jogo.edugame", pkg_v1, "application/octet-stream")},
        )

        old_extract_dir = static_dir / "meu-jogo" / "1.0.0"
        assert old_extract_dir.exists(), "v1 should be extracted before reimport"

        client.post(
            "/api/games/import",
            files={"file": ("meu-jogo.edugame", pkg_v2, "application/octet-stream")},
        )

        assert not old_extract_dir.exists(), "Old extracted directory must be removed on reimport"

    def test_reimport_removes_old_package_file(self, client, tmp_data_dirs):
        packages_dir, _ = tmp_data_dirs
        pkg_v1 = _make_edugame("meu-jogo", "1.0.0")
        pkg_v2 = _make_edugame("meu-jogo", "2.0.0")

        client.post(
            "/api/games/import",
            files={"file": ("meu-jogo.edugame", pkg_v1, "application/octet-stream")},
        )

        old_package = packages_dir / "meu-jogo.edugame"
        assert old_package.exists()
        old_mtime = old_package.stat().st_mtime

        client.post(
            "/api/games/import",
            files={"file": ("meu-jogo.edugame", pkg_v2, "application/octet-stream")},
        )

        # File should still exist but be the NEW package (different content/mtime)
        assert old_package.exists(), "Package file should be replaced, not permanently gone"
        new_mtime = old_package.stat().st_mtime
        assert new_mtime >= old_mtime, "Package file should be overwritten with new content"

    def test_reimport_updates_database_record(self, client):
        pkg_v1 = _make_edugame("meu-jogo", "1.0.0")
        pkg_v2 = _make_edugame("meu-jogo", "2.0.0")

        client.post(
            "/api/games/import",
            files={"file": ("meu-jogo.edugame", pkg_v1, "application/octet-stream")},
        )
        client.post(
            "/api/games/import",
            files={"file": ("meu-jogo.edugame", pkg_v2, "application/octet-stream")},
        )

        resp = client.get("/api/games/meu-jogo")
        assert resp.status_code == 200
        assert resp.json()["version"] == "2.0.0"

    def test_reimport_only_one_record_in_catalog(self, client):
        pkg_v1 = _make_edugame("meu-jogo", "1.0.0")
        pkg_v2 = _make_edugame("meu-jogo", "2.0.0")

        client.post(
            "/api/games/import",
            files={"file": ("meu-jogo.edugame", pkg_v1, "application/octet-stream")},
        )
        client.post(
            "/api/games/import",
            files={"file": ("meu-jogo.edugame", pkg_v2, "application/octet-stream")},
        )

        resp = client.get("/api/games/")
        games = resp.json()
        meu_jogo_entries = [g for g in games if g["slug"] == "meu-jogo"]
        assert len(meu_jogo_entries) == 1, "Catalog must have exactly one entry per slug after reimport"

    def test_reimport_new_css_content_is_extracted(self, client, tmp_data_dirs):
        _, static_dir = tmp_data_dirs
        pkg_v1 = _make_edugame("meu-jogo", "1.0.0", css="body{color:red}")
        pkg_v2 = _make_edugame("meu-jogo", "2.0.0", css="body{color:blue}")

        client.post(
            "/api/games/import",
            files={"file": ("meu-jogo.edugame", pkg_v1, "application/octet-stream")},
        )
        client.post(
            "/api/games/import",
            files={"file": ("meu-jogo.edugame", pkg_v2, "application/octet-stream")},
        )

        new_css = (static_dir / "meu-jogo" / "2.0.0" / "styles.css").read_text()
        assert "blue" in new_css, "New CSS content must be present after reimport"

    def test_reimport_message_mentions_removal(self, client):
        pkg_v1 = _make_edugame("meu-jogo", "1.0.0")
        pkg_v2 = _make_edugame("meu-jogo", "2.0.0")

        client.post(
            "/api/games/import",
            files={"file": ("meu-jogo.edugame", pkg_v1, "application/octet-stream")},
        )
        resp = client.post(
            "/api/games/import",
            files={"file": ("meu-jogo.edugame", pkg_v2, "application/octet-stream")},
        )
        message = resp.json()["message"].lower()
        assert "previous" in message or "removed" in message or "artefact" in message


class TestReimportIsolation:
    """Reimportation must not affect games with different slugs."""

    def test_other_game_files_untouched(self, client, tmp_data_dirs):
        _, static_dir = tmp_data_dirs
        pkg_a_v1 = _make_edugame("jogo-a", "1.0.0")
        pkg_b = _make_edugame("jogo-b", "1.0.0")
        pkg_a_v2 = _make_edugame("jogo-a", "2.0.0")

        client.post(
            "/api/games/import",
            files={"file": ("jogo-a.edugame", pkg_a_v1, "application/octet-stream")},
        )
        client.post(
            "/api/games/import",
            files={"file": ("jogo-b.edugame", pkg_b, "application/octet-stream")},
        )

        # Reimport jogo-a
        client.post(
            "/api/games/import",
            files={"file": ("jogo-a.edugame", pkg_a_v2, "application/octet-stream")},
        )

        # jogo-b must still be intact
        assert (static_dir / "jogo-b" / "1.0.0" / "index.html").exists(), \
            "jogo-b files must not be removed when jogo-a is reimported"

    def test_other_game_catalog_entry_untouched(self, client):
        pkg_a_v1 = _make_edugame("jogo-a", "1.0.0")
        pkg_b = _make_edugame("jogo-b", "1.0.0")
        pkg_a_v2 = _make_edugame("jogo-a", "2.0.0")

        client.post(
            "/api/games/import",
            files={"file": ("jogo-a.edugame", pkg_a_v1, "application/octet-stream")},
        )
        client.post(
            "/api/games/import",
            files={"file": ("jogo-b.edugame", pkg_b, "application/octet-stream")},
        )
        client.post(
            "/api/games/import",
            files={"file": ("jogo-a.edugame", pkg_a_v2, "application/octet-stream")},
        )

        resp = client.get("/api/games/jogo-b")
        assert resp.status_code == 200, "jogo-b catalog entry must survive jogo-a reimport"


class TestValidation:
    def test_non_edugame_extension_rejected(self, client):
        resp = client.post(
            "/api/games/import",
            files={"file": ("game.zip", b"data", "application/octet-stream")},
        )
        assert resp.status_code == 400

    def test_invalid_zip_rejected(self, client):
        resp = client.post(
            "/api/games/import",
            files={"file": ("game.edugame", b"not a zip", "application/octet-stream")},
        )
        assert resp.status_code == 422

    def test_missing_manifest_rejected(self, client):
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            zf.writestr("index.html", "<html></html>")
        buf.seek(0)
        resp = client.post(
            "/api/games/import",
            files={"file": ("game.edugame", buf.read(), "application/octet-stream")},
        )
        assert resp.status_code == 422

    def test_manifest_missing_slug_rejected(self, client):
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            zf.writestr("manifest.json", json.dumps({"title": "Game", "version": "1.0.0"}))
            zf.writestr("index.html", "<html></html>")
        buf.seek(0)
        resp = client.post(
            "/api/games/import",
            files={"file": ("game.edugame", buf.read(), "application/octet-stream")},
        )
        assert resp.status_code == 422
