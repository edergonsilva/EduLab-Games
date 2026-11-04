import { apiErrorMessage } from './errors'

const API_BASE = '/api'

export interface Game {
  id: number
  teacher_id?: number | null
  is_public: boolean
  slug: string
  title: string
  version: string
  description?: string
  author?: string
  grade?: string
  subject?: string
  thumbnail?: string
  entry_url: string
  extracted_path: string
  package_path: string
  imported_at: string
  updated_at: string
}

export interface ImportResult {
  game: Game
  replaced: boolean
  message: string
}

export interface GameMetadataUpdate {
  title: string
  description: string
  grade: string
  subject: string
  is_public: boolean
}

export async function listGames(): Promise<Game[]> {
  const res = await fetch(`${API_BASE}/games/`, { credentials: 'include' })
  if (!res.ok) throw new Error(await apiErrorMessage(res))
  return res.json()
}

export async function getGame(slug: string): Promise<Game> {
  const res = await fetch(`${API_BASE}/games/${slug}`, { credentials: 'include' })
  if (!res.ok) throw new Error(await apiErrorMessage(res))
  return res.json()
}

export async function importGame(file: File, isPublic = false): Promise<ImportResult> {
  const form = new FormData()
  form.append('file', file)
  form.append('is_public', String(isPublic))
  const res = await fetch(`${API_BASE}/games/import`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  })
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res))
  }
  return res.json()
}

export async function deleteGame(slug: string): Promise<void> {
  const res = await fetch(`${API_BASE}/games/${slug}`, { method: 'DELETE', credentials: 'include' })
  if (!res.ok) throw new Error(await apiErrorMessage(res))
}

export async function updateGameMetadata(slug: string, updates: GameMetadataUpdate): Promise<Game> {
  const res = await fetch(`${API_BASE}/games/${slug}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res))
  }
  return res.json()
}
