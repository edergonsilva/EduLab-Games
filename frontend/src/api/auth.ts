import { apiErrorMessage } from './errors'

export interface Teacher {
  id: number
  name: string
  email: string
  school_name?: string | null
}

type Credentials = {
  email: string
  password: string
}

async function sendAuthRequest(path: string, payload?: Record<string, string>): Promise<Teacher> {
  const response = await fetch(`/api/auth/${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: payload ? JSON.stringify(payload) : undefined,
  })
  if (!response.ok) throw new Error(await apiErrorMessage(response))
  return response.status === 204 ? ({} as Teacher) : response.json()
}

export function loginTeacher(credentials: Credentials): Promise<Teacher> {
  return sendAuthRequest('login', credentials)
}

export function registerTeacher(payload: Credentials & { name: string; school_name?: string }): Promise<Teacher> {
  return sendAuthRequest('register', payload)
}

export async function getTeacherSession(): Promise<Teacher | null> {
  const response = await fetch('/api/auth/me', { credentials: 'include' })
  if (response.status === 401) return null
  if (!response.ok) throw new Error(await apiErrorMessage(response))
  return response.json()
}

export async function logoutTeacher(): Promise<void> {
  await sendAuthRequest('logout')
}