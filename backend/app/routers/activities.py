from fastapi import APIRouter, HTTPException, Query

from app.models.activity import Activity, ActivityDetail, EnsureActivityRequest, RecordActivityEventRequest
from app.services.storage import (
    ensure_activity,
    get_activity,
    list_activities,
    list_activity_events,
    list_activity_participants,
    list_participants,
    record_activity_event,
)

router = APIRouter()


@router.get("", response_model=list[Activity])
async def list_activities_route(limit: int = Query(30, ge=1, le=100)):
    """Lista atividades/sessões recentes com resumo básico."""
    return list_activities(limit=limit)


@router.get("/{activity_id}", response_model=ActivityDetail)
async def get_activity_route(activity_id: str):
    """Retorna uma atividade com seus eventos mais recentes."""
    activity = get_activity(activity_id)
    if activity is None:
        raise HTTPException(status_code=404, detail="Atividade não encontrada.")
    return ActivityDetail(
        **activity.model_dump(),
        recent_events=list_activity_events(activity_id),
        participant_results=list_activity_participants(activity_id),
    )


@router.post("/ensure", response_model=Activity)
async def ensure_activity_route(body: EnsureActivityRequest):
    """Obtém ou cria a atividade atual usada pelo runner."""
    activity = ensure_activity(
        activity_id=body.activity_id,
        game_id=body.game_id,
        origin=body.origin,
        room_id=body.room_id,
        room_code=body.room_code,
        title=body.title,
        grade=body.grade,
        subject=body.subject,
    )
    if activity is None:
        raise HTTPException(status_code=400, detail="Não foi possível preparar a atividade.")
    return activity


@router.post("/{activity_id}/events", response_model=Activity)
async def record_activity_event_route(activity_id: str, body: RecordActivityEventRequest):
    """Persiste um evento recebido pelo runner/jogo."""
    payload_participant_id = body.payload.get("participant_id")
    payload_display_name = body.payload.get("display_name")
    payload_source = body.payload.get("source")
    resolved_participant_id = (
        body.participant_id
        if body.participant_id
        else payload_participant_id
        if isinstance(payload_participant_id, str)
        else None
    )
    resolved_display_name = (
        body.display_name
        if body.display_name
        else payload_display_name
        if isinstance(payload_display_name, str)
        else None
    )
    resolved_source = (
        body.source
        if body.source
        else payload_source
        if isinstance(payload_source, str)
        else None
    )
    activity = record_activity_event(
        activity_id,
        event_type=body.event_type,
        payload=body.payload,
        participant_id=resolved_participant_id,
        display_name=resolved_display_name,
        source=resolved_source,
    )
    if activity is None:
        raise HTTPException(status_code=404, detail="Atividade não encontrada.")
    return activity


@router.get("/{activity_id}/participants")
async def list_activity_participants_route(activity_id: str, limit: int = Query(200, ge=1, le=500)):
    """Retorna resultados por participante para uma atividade."""
    activity = get_activity(activity_id)
    if activity is None:
        raise HTTPException(status_code=404, detail="Atividade não encontrada.")
    return list_activity_participants(activity_id, limit=limit)


@router.get("/participants/list")
async def list_participants_route(
    room_code: str | None = Query(None),
    activity_id: str | None = Query(None),
    limit: int = Query(200, ge=1, le=500),
):
    """Lista participantes com filtros opcionais de sala/atividade."""
    return list_participants(room_code=room_code, activity_id=activity_id, limit=limit)
