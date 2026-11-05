import asyncio
import io
import json
import zipfile
from urllib.parse import parse_qs, urlsplit

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db, migrate_schema
from app.main import app
from app import realtime
from app.security import PARTICIPANT_SESSION_COOKIE_NAME



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
    assert activity_response.status_code == 200
    activity = activity_response.json()
    return room, activity


class TestPriority5ParticipationFlow:
    def test_socket_requires_session_and_restricts_participant_to_own_room(self, client, db_session, monkeypatch):
        room, _ = _create_room_and_activity(client)
        other_room = client.post(
            "/api/rooms/",
            json={"name": "Outra sala", "game_slug": room["game_slug"]},
        ).json()
        student = TestClient(app)
        student.post(
            f"/api/rooms/{room['code']}/join",
            json={"display_name": "Socket"},
        )
        participant_cookie = student.cookies.get(PARTICIPANT_SESSION_COOKIE_NAME)
        test_session_factory = sessionmaker(bind=db_session.get_bind())
        monkeypatch.setattr(realtime, "SessionLocal", test_session_factory)
        saved_sessions = {}

        async def save_session(sid, session):
            saved_sessions[sid] = session

        async def get_session(sid):
            return saved_sessions[sid]

        async def no_op(*args, **kwargs):
            return None

        monkeypatch.setattr(realtime.sio, "save_session", save_session)
        monkeypatch.setattr(realtime.sio, "get_session", get_session)
        monkeypatch.setattr(realtime.sio, "enter_room", no_op)
        monkeypatch.setattr(realtime.sio, "emit", no_op)

        async def exercise_socket_authorization():
            assert not await realtime.connect("anonymous-sid", {}, None)
            cookie_header = f"{PARTICIPANT_SESSION_COOKIE_NAME}={participant_cookie}"
            assert await realtime.connect("student-sid", {"HTTP_COOKIE": cookie_header}, None)
            assert (await realtime.join_room_channel("student-sid", {"room_code": room["code"]}))["ok"]
            denied = await realtime.join_room_channel("student-sid", {"room_code": other_room["code"]})
            assert denied["ok"] is False

        asyncio.run(exercise_socket_authorization())

    def test_room_has_one_terminal_waiting_active_finished_lifecycle(self, client):
        game = _import_game(client, "lifecycle-game")
        room_response = client.post(
            "/api/rooms/",
            json={"name": "Sala ciclo", "game_slug": game["slug"]},
        )
        room = room_response.json()

        assert room_response.status_code == 201
        assert room["status"] == "waiting"
        assert room["current_activity"]["status"] == "waiting"
        activity_id = room["current_activity"]["id"]

        start_response = client.post(
            f"/api/rooms/{room['code']}/activities/start",
            json={"game_slug": game["slug"]},
        )
        assert start_response.status_code == 200
        assert start_response.json()["id"] == activity_id
        assert client.get(f"/api/rooms/{room['code']}").json()["status"] == "active"

        finish_response = client.post(f"/api/rooms/activities/{activity_id}/finish")
        assert finish_response.status_code == 200
        assert client.get(f"/api/rooms/{room['code']}").json()["status"] == "finished"
        assert client.post(
            f"/api/rooms/{room['code']}/activities/start",
            json={"game_slug": game["slug"]},
        ).status_code == 409

    def test_late_join_is_supported_with_a_participant_session(self, client):
        room, _ = _create_room_and_activity(client)
        student = TestClient(app)

        response = student.post(
            f"/api/rooms/{room['code']}/join",
            json={"display_name": "Entrada tardia"},
        )

        assert response.status_code == 201
        assert response.json()["runner_url"] == "/runner"

    def test_activity_events_require_participant_session_and_ignore_client_identity(self, client):
        game = _import_game(client)
        room = client.post(
            "/api/rooms/",
            json={"name": "Sala autenticada", "game_slug": game["slug"]},
        ).json()
        first_student = TestClient(app)
        second_student = TestClient(app)
        first_participant = first_student.post(
            f"/api/rooms/{room['code']}/join",
            json={"display_name": "Ana"},
        ).json()["participant"]
        second_participant = second_student.post(
            f"/api/rooms/{room['code']}/join",
            json={"display_name": "Bia"},
        ).json()["participant"]
        activity = client.post(
            f"/api/rooms/{room['code']}/activities/start",
            json={"game_slug": game["slug"]},
        ).json()
        anonymous_student = TestClient(app)
        denied = anonymous_student.post(
            f"/api/rooms/activities/{activity['id']}/events",
            json={"event_type": "progress", "score": 100},
        )
        assert denied.status_code == 401

        response = first_student.post(
            f"/api/rooms/activities/{activity['id']}/events",
            json={
                "participant_id": second_participant["id"],
                "event_type": "progress",
                "score": 12,
            },
        )

        assert response.status_code == 201
        assert response.json()["participant_id"] == first_participant["id"]

    def test_progress_values_are_validated(self, client):
        room, activity = _create_room_and_activity(client)
        student = TestClient(app)
        student.post(
            f"/api/rooms/{room['code']}/join",
            json={"display_name": "Progresso"},
        )

        response = student.post(
            f"/api/rooms/activities/{activity['id']}/events",
            json={
                "event_type": "progress",
                "progress": {"current": 11, "total": 10},
            },
        )

        assert response.status_code == 422

    def test_finished_room_rejects_new_events_but_keeps_saved_results(self, client):
        room, activity = _create_room_and_activity(client)
        student = TestClient(app)
        participant = student.post(
            f"/api/rooms/{room['code']}/join",
            json={"display_name": "Resultado"},
        ).json()["participant"]
        saved = student.post(
            f"/api/rooms/activities/{activity['id']}/events",
            json={"event_type": "progress", "score": 8},
        )
        assert saved.status_code == 201

        assert client.post(f"/api/rooms/activities/{activity['id']}/finish").status_code == 200
        rejected = student.post(
            f"/api/rooms/activities/{activity['id']}/events",
            json={"event_type": "progress", "score": 9},
        )
        history = client.get(f"/api/rooms/{room['code']}/history").json()

        assert rejected.status_code == 409
        assert history["activities"][0]["participants"][0]["id"] == participant["id"]
        assert history["activities"][0]["events"][0]["score"] == 8

    def test_existing_database_migration_allows_lobby_without_losing_activities(self, tmp_path, monkeypatch):
        legacy_engine = create_engine(f"sqlite:///{tmp_path}/legacy.db")
        with legacy_engine.begin() as connection:
            connection.exec_driver_sql(
                "CREATE TABLE rooms (id INTEGER PRIMARY KEY, teacher_id INTEGER, code VARCHAR, "
                "name VARCHAR, game_slug VARCHAR, status VARCHAR, created_at DATETIME)"
            )
            connection.exec_driver_sql(
                "CREATE TABLE games (id INTEGER PRIMARY KEY, teacher_id INTEGER, is_public BOOLEAN)"
            )
            connection.exec_driver_sql(
                "CREATE TABLE activities (id INTEGER PRIMARY KEY, room_id INTEGER NOT NULL, "
                "game_slug VARCHAR NOT NULL, status VARCHAR NOT NULL, "
                "started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, ended_at DATETIME)"
            )
            connection.exec_driver_sql(
                "CREATE TABLE participants (id INTEGER PRIMARY KEY, status VARCHAR NOT NULL)"
            )
            connection.exec_driver_sql("CREATE INDEX ix_activities_id ON activities (id)")
            connection.exec_driver_sql("CREATE INDEX ix_activities_room_id ON activities (room_id)")
            connection.exec_driver_sql(
                "INSERT INTO activities (id, room_id, game_slug, status) "
                "VALUES (1, 2, 'jogo-antigo', 'finished')"
            )

        monkeypatch.setattr("app.database.engine", legacy_engine)
        migrate_schema()

        with legacy_engine.begin() as connection:
            connection.exec_driver_sql(
                "INSERT INTO activities (room_id, game_slug, status) VALUES (2, NULL, 'waiting')"
            )
            activities = connection.exec_driver_sql(
                "SELECT id, game_slug, status FROM activities ORDER BY id"
            ).all()
            indexes = {
                row[1]
                for row in connection.exec_driver_sql("PRAGMA index_list(activities)")
            }

        assert activities[0] == (1, "jogo-antigo", "finished")
        assert activities[1][1:] == (None, "waiting")
        assert indexes == {"ix_activities_id", "ix_activities_room_id"}

    def test_room_management_requires_teacher_session(self, client):
        anonymous_client = TestClient(app)

        assert anonymous_client.get("/api/rooms/").status_code == 401
        assert anonymous_client.post("/api/rooms/", json={"name": "Sala sem dono"}).status_code == 401

    def test_room_not_found_error_is_returned_in_portuguese(self, client):
        response = client.get("/api/rooms/nao-existe")

        assert response.status_code == 404
        assert response.json()["detail"] == "A sala 'nao-existe' não foi encontrada."

    def test_teacher_can_delete_room_with_its_participants_and_history(self, client):
        room, _ = _create_room_and_activity(client)

        delete_response = client.delete(f"/api/rooms/{room['code']}")

        assert delete_response.status_code == 204
        assert client.get(f"/api/rooms/{room['code']}/dashboard").status_code == 404

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
        assert payload["runner_url"] == "/runner"
        assert "access_token" not in payload["runner_url"]
        entry_url = payload["game"]["entry_url"]
        assert student_client.get(entry_url).status_code == 404
        student_client.get(f"/api/rooms/participants/{payload['participant']['id']}/context")
        assert student_client.get(entry_url).status_code == 200
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
        assert student_client.get(f"/api/rooms/participants/{participant_id}/context").status_code == 200

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
                "progress": {"current": 10, "total": 10},
                "payload": {"phase": "final"},
            },
        )

        assert event_response.status_code == 201
        event = event_response.json()
        assert event["participant_id"] == participant["id"]
        assert event["status"] == "completed"
        assert event["score"] == 95

        dashboard_response = client.get(f"/api/rooms/{room['code']}/dashboard")
        assert dashboard_response.status_code == 200
        dashboard = dashboard_response.json()
        assert dashboard["participant_summary"]["completed"] == 1
        assert dashboard["participants"][0]["display_name"] == "Bruno"
        assert dashboard["participants"][0]["last_score"] == 95
        assert dashboard["participants"][0]["status"] == "completed"
        assert dashboard["participants"][0]["progress_current"] == 10
        assert dashboard["participants"][0]["progress_total"] == 10
        assert dashboard["recent_events"][0]["payload"]["phase"] == "final"

    def test_dashboard_ranks_students_by_score(self, client):
        room, activity = _create_room_and_activity(client)
        first_student = TestClient(app)
        second_student = TestClient(app)

        first_join = first_student.post(
            f"/api/rooms/{room['code']}/join",
            json={"display_name": "Aline"},
        )
        second_join = second_student.post(
            f"/api/rooms/{room['code']}/join",
            json={"display_name": "Beto"},
        )

        first_id = first_join.json()["participant"]["id"]
        second_id = second_join.json()["participant"]["id"]

        first_student.post(
            f"/api/rooms/activities/{activity['id']}/events",
            json={"participant_id": first_id, "event_type": "progress", "score": 10},
        )
        second_student.post(
            f"/api/rooms/activities/{activity['id']}/events",
            json={"participant_id": second_id, "event_type": "progress", "score": 30},
        )

        dashboard = client.get(f"/api/rooms/{room['code']}/dashboard").json()
        assert [participant["display_name"] for participant in dashboard["participants"]] == ["Beto", "Aline"]
        assert [participant["last_score"] for participant in dashboard["participants"]] == [30, 10]

    def test_room_history_preserves_activity_and_score_events(self, client):
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

        history_response = client.get(f"/api/rooms/{room['code']}/history")
        assert history_response.status_code == 200
        history = history_response.json()
        assert [entry["activity"]["id"] for entry in history["activities"]] == [first_activity["id"]]
        assert [event["score"] for event in history["activities"][0]["events"]] == [4, 2]

    def test_runner_context_exposes_platform_context_for_shell(self, client):
        room, activity = _create_room_and_activity(client)
        join_response = client.post(
            f"/api/rooms/{room['code']}/join",
            json={"display_name": "Carla"},
        )
        participant = join_response.json()["participant"]

        response = client.get(f"/api/rooms/participants/{participant['id']}/context")
        self_context = client.get("/api/rooms/participants/me/context")

        assert response.status_code == 200
        assert self_context.status_code == 200
        context = response.json()
        assert context["schema_version"] == "1.3"
        assert context["participant"]["id"] == participant["id"]
        assert context["activity"]["id"] == activity["id"]
        assert "access_token" not in context
        assert "HttpOnly" in response.headers["set-cookie"]
        assert context["room"]["code"] == room["code"]
        assert context["game"]["slug"] == "cdu-2ano"
        assert context["context"]["room_code"] == room["code"]
        assert context["context"]["grade"] == "2º ano"
        assert context["context"]["subject"] == "Matemática"

    def test_room_waits_before_starting_activity(self, client):
        game = _import_game(client)
        room_response = client.post(
            "/api/rooms/",
            json={"name": "Sala em lobby", "game_slug": game["slug"]},
        )
        assert room_response.status_code == 201
        room = room_response.json()

        lobby_response = client.post(f"/api/rooms/{room['code']}/activities/open", json={})
        assert lobby_response.status_code == 201
        activity = lobby_response.json()
        assert activity["status"] == "waiting"
        assert activity["game_slug"] == game["slug"]

        student_client = TestClient(app)
        join_response = student_client.post(
            f"/api/rooms/{room['code']}/join",
            json={"display_name": "Duda"},
        )

        assert join_response.status_code == 201
        payload = join_response.json()
        assert payload["activity"]["status"] == "waiting"
        assert payload["participant"]["status"] == "waiting"
        assert payload.get("runner_url") in (None, "")

    def test_starting_lobby_activates_same_activity_and_preserves_students(self, client):
        game = _import_game(client, "jogo-da-rodada")
        room = client.post(
            "/api/rooms/",
            json={"name": "Sala da rodada", "game_slug": game["slug"]},
        ).json()
        lobby = client.post(f"/api/rooms/{room['code']}/activities/open", json={}).json()
        student = TestClient(app)
        join_response = student.post(
            f"/api/rooms/{room['code']}/join",
            json={"display_name": "Lia"},
        )
        participant = join_response.json()["participant"]

        start_response = client.post(
            f"/api/rooms/{room['code']}/activities/start",
            json={"game_slug": game["slug"]},
        )

        assert start_response.status_code == 200
        started = start_response.json()
        assert started["id"] == lobby["id"]
        assert started["status"] == "active"
        assert started["game_slug"] == game["slug"]
        dashboard = client.get(f"/api/rooms/{room['code']}/dashboard").json()
        assert dashboard["participant_summary"]["total"] == 1
        assert dashboard["participants"][0]["id"] == participant["id"]
        runner_context = student.get(f"/api/rooms/participants/{participant['id']}/context")
        assert runner_context.status_code == 200
        assert "access_token" not in runner_context.json()
        assert "HttpOnly" in runner_context.headers["set-cookie"]
