import io
import json
import zipfile
from urllib.parse import parse_qs, urlsplit

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.main import app



def _make_edugame(slug: str, version: str) -> bytes:
    buf = io.BytesIO()
    manifest = {
        "slug": slug,
        "title": f"Jogo {slug}",
        "version": version,
        "description": "Jogo de teste",
        "grade": "2º ano",
        "subject": "Matemática",
    }
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("manifest.json", json.dumps(manifest))
        zf.writestr("index.html", "<html><body>ok</body></html>")
        zf.writestr("styles.css", "body{background:#fff}")
        zf.writestr("script.js", "window.parent.postMessage({ type: 'game_loaded' }, '*')")
    buf.seek(0)
    return buf.read()


@pytest.fixture()
def tmp_data_dirs(tmp_path, monkeypatch):
    packages_dir = tmp_path / "packages"
    static_dir = tmp_path / "static" / "imported"
    packages_dir.mkdir(parents=True)
    static_dir.mkdir(parents=True)

    monkeypatch.setattr("app.config.PACKAGES_DIR", packages_dir)
    monkeypatch.setattr("app.config.STATIC_IMPORTED_DIR", static_dir)
    monkeypatch.setattr("app.routers.games.PACKAGES_DIR", packages_dir)
    monkeypatch.setattr("app.routers.games.STATIC_IMPORTED_DIR", static_dir)
    for route in app.routes:
        if getattr(route, "name", None) == "imported_games":
            route.app.directory = str(static_dir)
            route.app.all_directories = [str(static_dir)]

    return packages_dir, static_dir


@pytest.fixture()
def db_session(tmp_path, monkeypatch):
    db_url = f"sqlite:///{tmp_path}/test.db"
    test_engine = create_engine(db_url, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=test_engine)
    TestSessionLocal = sessionmaker(bind=test_engine)
    monkeypatch.setattr("app.main.SessionLocal", TestSessionLocal)

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
    test_client = TestClient(app)
    response = test_client.post(
        "/api/auth/register",
        json={"name": "Professor de Teste", "email": "teacher@example.com", "password": "senha-segura-123"},
    )
    assert response.status_code == 201
    return test_client



def _import_game(client: TestClient, slug: str = "cdu-2ano"):
    pkg = _make_edugame(slug, "1.0.0")
    response = client.post(
        "/api/games/import",
        files={"file": (f"{slug}.edugame", pkg, "application/octet-stream")},
    )
    assert response.status_code == 201
    return response.json()["game"]



def _create_room_and_activity(client: TestClient, game_slug: str = "cdu-2ano"):
    _import_game(client, game_slug)
    room_response = client.post(
        "/api/rooms/",
        json={"name": "Sala 2A", "game_slug": game_slug},
    )
    assert room_response.status_code == 201
    room = room_response.json()

    activity_response = client.post(f"/api/rooms/{room['code']}/activities/start", json={})
    assert activity_response.status_code == 201
    activity = activity_response.json()
    return room, activity


class TestPriority5ParticipationFlow:
    def test_room_management_requires_teacher_session(self, client):
        anonymous_client = TestClient(app)

        assert anonymous_client.get("/api/rooms/").status_code == 401
        assert anonymous_client.post("/api/rooms/", json={"name": "Sala sem dono"}).status_code == 401

    def test_room_not_found_error_is_returned_in_portuguese(self, client):
        response = client.get("/api/rooms/nao-existe")

        assert response.status_code == 404
        assert response.json()["detail"] == "A sala 'nao-existe' não foi encontrada."

    def test_teacher_rooms_are_isolated_but_students_join_by_invite(self, client):
        room, _ = _create_room_and_activity(client)
        client.post("/api/auth/logout")
        register_response = client.post(
            "/api/auth/register",
            json={"name": "Outro Professor", "email": "other@example.com", "password": "senha-segura-456"},
        )
        assert register_response.status_code == 201

        assert client.get("/api/rooms/").json() == []
        assert client.get(f"/api/rooms/{room['code']}/dashboard").status_code == 404

        student_client = TestClient(app)
        join_response = student_client.post(
            f"/api/rooms/{room['code']}/join",
            json={"display_name": "Aluno Convidado"},
        )
        assert join_response.status_code == 201

    def test_join_creates_participant_linked_to_room_and_activity(self, client):
        room, activity = _create_room_and_activity(client)

        student_client = TestClient(app)
        response = student_client.post(
            f"/api/rooms/{room['code']}/join",
            json={"display_name": "Ana"},
        )

        assert response.status_code == 201
        payload = response.json()
        assert payload["participant"]["display_name"] == "Ana"
        assert payload["participant"]["source"] == "manual"
        assert payload["participant"]["room_id"] == room["id"]
        assert payload["participant"]["activity_id"] == activity["id"]
        assert payload["game"]["slug"] == "cdu-2ano"
        assert payload["runner_url"].startswith("/runner?participant_id=")
        access_token = parse_qs(urlsplit(payload["runner_url"]).query)["access_token"][0]
        entry_url = payload["game"]["entry_url"]
        assert student_client.get(entry_url).status_code == 404
        assert student_client.get(f"{entry_url}?access_token={access_token}").status_code == 200
        assert student_client.get(entry_url.rsplit("/", 1)[0] + "/script.js").status_code == 200

    def test_join_without_name_is_rejected(self, client):
        room, _ = _create_room_and_activity(client)

        response = client.post(f"/api/rooms/{room['code']}/join", json={})

        assert response.status_code == 422

    def test_same_student_cannot_join_activity_twice(self, client):
        room, _ = _create_room_and_activity(client)
        student_client = TestClient(app)
        first_join = student_client.post(
            f"/api/rooms/{room['code']}/join",
            json={"display_name": "Ana"},
        )
        second_join = student_client.post(
            f"/api/rooms/{room['code']}/join",
            json={"display_name": "ana"},
        )

        assert first_join.status_code == 201
        assert second_join.status_code == 409

    def test_completed_student_cannot_reopen_runner_or_submit_more_events(self, client):
        room, activity = _create_room_and_activity(client)
        student_client = TestClient(app)
        join_response = student_client.post(
            f"/api/rooms/{room['code']}/join",
            json={"display_name": "João"},
        )
        participant_id = join_response.json()["participant"]["id"]
        completion_response = student_client.post(
            f"/api/rooms/activities/{activity['id']}/events",
            json={"participant_id": participant_id, "event_type": "result", "score": 7},
        )

        assert completion_response.status_code == 201
        assert student_client.get(f"/api/rooms/participants/{participant_id}/context").status_code == 409
        assert student_client.post(
            f"/api/rooms/activities/{activity['id']}/events",
            json={"participant_id": participant_id, "event_type": "progress", "score": 8},
        ).status_code == 409

    def test_active_student_cannot_reopen_runner(self, client):
        room, _ = _create_room_and_activity(client)
        student_client = TestClient(app)
        join_response = student_client.post(
            f"/api/rooms/{room['code']}/join",
            json={"display_name": "Pedro"},
        )
        participant_id = join_response.json()["participant"]["id"]

        assert student_client.get(f"/api/rooms/participants/{participant_id}/context").status_code == 200
        event_response = student_client.post(
            f"/api/rooms/activities/{join_response.json()['activity']['id']}/events",
            json={"participant_id": participant_id, "event_type": "runner_opened"},
        )
        assert event_response.status_code == 201
        assert student_client.get(f"/api/rooms/participants/{participant_id}/context").status_code == 409

    def test_event_updates_participant_progress_and_teacher_dashboard(self, client):
        room, activity = _create_room_and_activity(client)
        student_client = TestClient(app)
        join_response = student_client.post(
            f"/api/rooms/{room['code']}/join",
            json={"display_name": "Bruno"},
        )
        participant = join_response.json()["participant"]

        event_response = student_client.post(
            f"/api/rooms/activities/{activity['id']}/events",
            json={
                "participant_id": participant["id"],
                "event_type": "completed",
                "score": 95,
                "payload": {"phase": "final"},
            },
        )

        assert event_response.status_code == 201
        event = event_response.json()
        assert event["participant_id"] == participant["id"]
        assert event["status"] == "finished"
        assert event["score"] == 95

        dashboard_response = client.get(f"/api/rooms/{room['code']}/dashboard")
        assert dashboard_response.status_code == 200
        dashboard = dashboard_response.json()
        assert dashboard["participant_summary"]["finished"] == 1
        assert dashboard["participants"][0]["display_name"] == "Bruno"
        assert dashboard["participants"][0]["last_score"] == 95
        assert dashboard["participants"][0]["status"] == "finished"
        assert dashboard["recent_events"][0]["payload"]["phase"] == "final"

    def test_room_history_returns_all_activities_and_score_events(self, client):
        room, first_activity = _create_room_and_activity(client)
        student_client = TestClient(app)
        first_join = student_client.post(
            f"/api/rooms/{room['code']}/join",
            json={"display_name": "Marta"},
        )
        first_participant_id = first_join.json()["participant"]["id"]
        student_client.post(
            f"/api/rooms/activities/{first_activity['id']}/events",
            json={"participant_id": first_participant_id, "event_type": "progress", "score": 2},
        )
        student_client.post(
            f"/api/rooms/activities/{first_activity['id']}/events",
            json={"participant_id": first_participant_id, "event_type": "result", "score": 4},
        )

        second_activity = client.post(
            f"/api/rooms/{room['code']}/activities/start",
            json={},
        ).json()
        second_join = student_client.post(
            f"/api/rooms/{room['code']}/join",
            json={"display_name": "Rui"},
        )
        second_participant_id = second_join.json()["participant"]["id"]
        student_client.post(
            f"/api/rooms/activities/{second_activity['id']}/events",
            json={"participant_id": second_participant_id, "event_type": "progress", "score": 6},
        )

        history_response = client.get(f"/api/rooms/{room['code']}/history")
        assert history_response.status_code == 200
        history = history_response.json()
        assert [entry["activity"]["id"] for entry in history["activities"]] == [
            second_activity["id"],
            first_activity["id"],
        ]
        assert history["activities"][0]["events"][0]["score"] == 6
        assert [event["score"] for event in history["activities"][1]["events"]] == [4, 2]

    def test_runner_context_exposes_platform_context_for_shell(self, client):
        room, activity = _create_room_and_activity(client)
        join_response = client.post(
            f"/api/rooms/{room['code']}/join",
            json={"display_name": "Carla"},
        )
        participant = join_response.json()["participant"]

        response = client.get(f"/api/rooms/participants/{participant['id']}/context")

        assert response.status_code == 200
        context = response.json()
        assert context["schema_version"] == "1.3"
        assert context["participant"]["id"] == participant["id"]
        assert context["activity"]["id"] == activity["id"]
        assert context["room"]["code"] == room["code"]
        assert context["game"]["slug"] == "cdu-2ano"
        assert context["context"]["room_code"] == room["code"]
        assert context["context"]["grade"] == "2º ano"
        assert context["context"]["subject"] == "Matemática"
