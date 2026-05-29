import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
})

// ---- Types ----
export interface Grade {
  id: number
  label: string
  short: string
}

export interface Subject {
  id: string
  label: string
  icon: string
  color: string
}

export interface Game {
  id: string
  name: string
  description?: string
  thumbnail?: string | null
  entry_point?: string | null
  play_url?: string | null
  mode: string[]
  min_players: number
  max_players: number
  session_required: boolean
  school_grades: number[]
  subject?: string | null
  tags: string[]
  status: string
  developer: string
  credits: string
  version: string
  estimated_duration_minutes: number
  api_version: string
  supports_teacher_panel?: boolean
  supports_ranking?: boolean
  source: 'seed' | 'imported'
}

export interface Room {
  id: string
  code: string
  name: string
  grade?: number | null
  subject?: string | null
  selected_game_id?: string | null
  status: string
  players: string[]
  created_at: number
  updated_at: number
  started_at?: number | null
  finished_at?: number | null
}

export interface HealthResponse {
  status: string
  app: string
  version: string
}

export interface ImportEdugameResponse {
  ok: boolean
  created: boolean
  message: string
  manifest: Game
}

// ---- API calls ----
export const getHealth = () =>
  axios.get<HealthResponse>('/health', { timeout: 10000 }).then(r => r.data)

export const getGrades = () =>
  api.get<Grade[]>('/catalog/grades').then(r => r.data)

export const getSubjects = () =>
  api.get<Subject[]>('/catalog/subjects').then(r => r.data)

export const getGames = (params?: {
  subject?: string
  grade?: number
  mode?: string
  status?: string
}) => api.get<Game[]>('/games', { params }).then(r => r.data)

export const getGame = (id: string, version?: string) =>
  api.get<Game>(`/games/${id}`, { params: version ? { version } : undefined }).then(r => r.data)

export const getAdminGames = (status?: string) =>
  api.get<Game[]>('/admin/games', { params: status ? { status } : undefined }).then(r => r.data)

export const setAdminGameStatus = (gameId: string, version: string, status: 'test' | 'published' | 'archived') =>
  api.patch<Game>(`/admin/games/${gameId}/${version}`, { status }).then(r => r.data)

export const uploadEdugame = (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  return api.post<ImportEdugameResponse>('/import/edugame', formData).then(r => r.data)
}

export interface CreateRoomPayload {
  name: string
  grade?: number
  subject?: string
  game_id?: string
}

export const createRoom = (payload: CreateRoomPayload) =>
  api.post<Room>('/rooms', payload).then(r => r.data)

export const getRoom = (code: string) =>
  api.get<Room>(`/rooms/${code}`).then(r => r.data)

export const getRooms = () =>
  api.get<Room[]>('/rooms').then(r => r.data)

export const joinRoom = (code: string, player_name: string) =>
  api.post<Room>(`/rooms/${code}/join`, { player_name }).then(r => r.data)

export interface UpdateRoomPayload {
  name?: string
  grade?: number
  subject?: string
  game_id?: string
}

export const updateRoom = (code: string, payload: UpdateRoomPayload) =>
  api.patch<Room>(`/rooms/${code}`, payload).then(r => r.data)

export const startRoom = (code: string, game_id?: string) =>
  api.post<Room>(`/rooms/${code}/start`, game_id ? { game_id } : {}).then(r => r.data)

export const finishRoom = (code: string) =>
  api.post<Room>(`/rooms/${code}/finish`, {}).then(r => r.data)

export const adminLogin = (password: string) =>
  api.post('/admin/login', { password }).then(r => r.data)

export default api
