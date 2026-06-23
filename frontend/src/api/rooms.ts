export interface Activity {
  id: number
  room_id: number
  game_slug: string
  status: string
  started_at: string
  ended_at?: string | null
}

export interface Participant {
  id: number
  room_id: number
  activity_id: number
  display_name: string
  source: string
  status: string
  last_score?: number | null
  joined_at: string
  last_seen_at: string
  finished_at?: string | null
  roster_student_id?: string | null
  roster_match_status?: string | null
}

export interface ActivityEvent {
  id: number
  room_id: number
  activity_id: number
  participant_id?: number | null
  event_type: string
  score?: number | null
  status?: string | null
  payload: Record<string, unknown>
  created_at: string
}

export interface Room {
  id: number
  code: string
  name: string
  game_slug?: string | null
  status: string
  created_at: string
  current_activity?: Activity | null
  participant_summary?: Record<string, number> | null
}

export interface RoomDashboard {
  room: Room
  activity?: Activity | null
  game?: {
    slug: string
    title: string
    version: string
    description?: string | null
    grade?: string | null
    subject?: string | null
    entry_url: string
  } | null
  participants: Participant[]
  recent_events: ActivityEvent[]
  participant_summary: Record<string, number>
}

export interface JoinRoomResult {
  room: Room
  activity: Activity
  participant: Participant
  game: {
    slug: string
    title: string
    version: string
    description?: string | null
    grade?: string | null
    subject?: string | null
    entry_url: string
  }
  runner_url: string
  message: string
}

export interface RunnerContext extends JoinRoomResult {
  schema_version: string
  context: {
    room_code: string
    room_id: number
    mode: string
    origin: string
    grade?: string | null
    subject?: string | null
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let detail = response.statusText
    try {
      const payload = await response.json()
      detail = payload.detail ?? payload.message ?? JSON.stringify(payload)
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(detail)
  }
  return response.json() as Promise<T>
}

export async function listRooms(): Promise<Room[]> {
  const response = await fetch('/api/rooms/')
  return parseResponse<Room[]>(response)
}

export async function createRoom(payload: { name: string; game_slug?: string }): Promise<Room> {
  const response = await fetch('/api/rooms/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return parseResponse<Room>(response)
}

export async function startActivity(code: string, gameSlug?: string): Promise<Activity> {
  const response = await fetch(`/api/rooms/${encodeURIComponent(code)}/activities/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(gameSlug ? { game_slug: gameSlug } : {}),
  })
  return parseResponse<Activity>(response)
}

export async function finishActivity(activityId: number): Promise<Activity> {
  const response = await fetch(`/api/rooms/activities/${activityId}/finish`, {
    method: 'POST',
  })
  return parseResponse<Activity>(response)
}

export async function getRoomDashboard(code: string): Promise<RoomDashboard> {
  const response = await fetch(`/api/rooms/${encodeURIComponent(code)}/dashboard`)
  return parseResponse<RoomDashboard>(response)
}

export async function joinRoom(
  code: string,
  payload: { display_name?: string; source?: string },
): Promise<JoinRoomResult> {
  const response = await fetch(`/api/rooms/${encodeURIComponent(code)}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return parseResponse<JoinRoomResult>(response)
}

export async function getRunnerContext(participantId: number): Promise<RunnerContext> {
  const response = await fetch(`/api/rooms/participants/${participantId}/context`)
  return parseResponse<RunnerContext>(response)
}

export async function createActivityEvent(
  activityId: number,
  payload: {
    participant_id?: number
    display_name?: string
    event_type: string
    score?: number
    status?: string
    payload?: Record<string, unknown>
  },
): Promise<ActivityEvent> {
  const response = await fetch(`/api/rooms/activities/${activityId}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return parseResponse<ActivityEvent>(response)
}
