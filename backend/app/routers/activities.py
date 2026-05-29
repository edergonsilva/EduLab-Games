from fastapi import APIRouter, HTTPException, Query

from app.models.activity import Activity, ActivityDetail, EnsureActivityRequest, RecordActivityEventRequest
from app.services.storage import ensure_activity, get_activity, list_activities, list_activity_events, record_activity_event

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
    return ActivityDetail(**activity.model_dump(), recent_events=list_activity_events(activity_id))


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
    activity = record_activity_event(activity_id, event_type=body.event_type, payload=body.payload)
    if activity is None:
        raise HTTPException(status_code=404, detail="Atividade não encontrada.")
    return activity
