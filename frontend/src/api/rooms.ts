import { apiErrorMessage } from './errors'

export interface Activity {
  id: number
  room_id: number
  game_slug: string | null
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
  connection_status: string
  last_score?: number | null
  progress_current?: number | null
  progress_total?: number | null
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
  started_at?: string | null
  finished_at?: string | null
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

export interface RoomHistory {
  room: Room
  activities: Array<{
    activity: Activity
    game?: RoomDashboard['game']
    participants: Participant[]
    events: ActivityEvent[]
  }>
}

export interface JoinRoomResult {
  room: Room
  activity: Activity
  participant: Participant
  game?: {
    slug: string
    title: string
    version: string
    description?: string | null
    grade?: string | null
    subject?: string | null
    entry_url: string
  } | null
  runner_url?: string | null
  message: string
}

export interface RoomLobby {
  room: Room
  activity?: Activity | null
  game?: RoomDashboard['game'] | null
  participants: Participant[]
  participant_count: number
  current_participant_id: number
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
    throw new Error(await apiErrorMessage(response))
  }
  return response.json() as Promise<T>
}

const STUDENT_SESSION_KEY = 'edulab.student.session'

export interface StudentSession {
  room_code: string
  participant_id: number
  display_name: string
  activity_id?: number
  runner_url?: string | null
}

export function saveStudentSession(session: StudentSession) {
  localStorage.setItem(STUDENT_SESSION_KEY, JSON.stringify(session))
}

export function readStudentSession(): StudentSession | null {
  const raw = localStorage.getItem(STUDENT_SESSION_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw) as StudentSession
  } catch {
    localStorage.removeItem(STUDENT_SESSION_KEY)
    return null
  }
}

export function clearStudentSession() {
  localStorage.removeItem(STUDENT_SESSION_KEY)
}

export async function listRooms(): Promise<Room[]> {
  const response = await fetch('/api/rooms/')
  return parseResponse<Room[]>(response)
}

export async function createRoom(payload: { name: string; game_slug: string }): Promise<Room> {
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

export async function openActivityLobby(code: string): Promise<Activity> {
  const response = await fetch(`/api/rooms/${encodeURIComponent(code)}/activities/open`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  return parseResponse<Activity>(response)
}

export async function getRoomLobby(code: string): Promise<RoomLobby> {
  const response = await fetch(`/api/rooms/${encodeURIComponent(code)}/lobby`)
  return parseResponse<RoomLobby>(response)
}

export async function deleteRoom(code: string): Promise<void> {
  const response = await fetch(`/api/rooms/${encodeURIComponent(code)}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    throw new Error(await apiErrorMessage(response))
  }
}

export async function getRoomHistory(code: string): Promise<RoomHistory> {
  const response = await fetch(`/api/rooms/${encodeURIComponent(code)}/history`)
  return parseResponse<RoomHistory>(response)
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

export async function getRunnerContext(): Promise<RunnerContext> {
  const response = await fetch('/api/rooms/participants/me/context')
  return parseResponse<RunnerContext>(response)
}

export async function createActivityEvent(
  activityId: number,
  payload: {
    event_type: string
    score?: number
    progress?: { current: number; total: number }
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
