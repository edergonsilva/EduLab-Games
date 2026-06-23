const API_BASE = '/api'

export interface Game {
  id: number
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

export async function listGames(): Promise<Game[]> {
  const res = await fetch(`${API_BASE}/games/`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function getGame(slug: string): Promise<Game> {
  const res = await fetch(`${API_BASE}/games/${slug}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function importGame(file: File): Promise<ImportResult> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${API_BASE}/games/import`, {
    method: 'POST',
    body: form,
  })
  if (!res.ok) {
    const detail = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(detail.detail ?? res.statusText)
  }
  return res.json()
}

export async function deleteGame(slug: string): Promise<void> {
  const res = await fetch(`${API_BASE}/games/${slug}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await res.text())
}
