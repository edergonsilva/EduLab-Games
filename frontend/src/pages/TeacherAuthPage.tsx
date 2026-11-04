import { FormEvent, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { loginTeacher, registerTeacher } from '../api/auth'
import { Button, Card, Field, Input, Mascot } from '../components/ui'
import { userErrorMessage } from '../api/errors'

type AuthMode = 'login' | 'register'

export function TeacherAuthPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [mode, setMode] = useState<AuthMode>('login')
  const [name, setName] = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (mode === 'register') {
        await registerTeacher({ name: name.trim(), school_name: schoolName.trim(), email, password })
      } else {
        await loginTeacher({ email, password })
      }
      const state = location.state as { from?: string } | null
      navigate(state?.from || '/professor/biblioteca', { replace: true })
    } catch (err) {
      setError(userErrorMessage(err, 'Não foi possível acessar a conta.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="grid min-h-[calc(100vh-4.25rem)] place-items-center bg-canvas px-4 py-10 sm:px-6">
      <Card className="w-full max-w-md p-6 sm:p-8">
        <p className="mb-2 text-xs font-bold uppercase text-brand">
          Área do professor
        </p>
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-3xl font-semibold text-ink">
            {mode === 'login' ? 'Acesse suas turmas' : 'Crie sua conta'}
          </h1>
          <Mascot className="h-16 w-12" />
        </div>
        <p className="mb-6 mt-2 text-sm leading-6 text-muted">
          Salas e acompanhamento ficam vinculados à sua conta.
        </p>

        <div role="group" aria-label="Acesso à conta" className="mb-5 grid grid-cols-2 rounded-md bg-canvas p-1">
          {(['login', 'register'] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={mode === option}
              onClick={() => { setMode(option); setError(null) }}
              className={`rounded px-3 py-2 text-sm font-semibold transition-colors ${mode === option ? 'bg-white text-brand-dark shadow-sm' : 'text-muted hover:text-ink'}`}
            >
              {option === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4">
          {mode === 'register' && (
            <>
              <Field label="Seu nome"><Input autoComplete="name" maxLength={120} onChange={(event) => setName(event.target.value)} required value={name} /></Field>
              <Field hint="Opcional" label="Escola"><Input autoComplete="organization" maxLength={160} onChange={(event) => setSchoolName(event.target.value)} value={schoolName} /></Field>
            </>
          )}
          <Field label="E-mail"><Input autoComplete="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} /></Field>
          <Field hint={mode === 'register' ? 'Use pelo menos 8 caracteres.' : undefined} label="Senha"><Input autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'register' ? 8 : undefined} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></Field>
          {error && <p role="alert" className="m-0 text-sm text-danger">{error}</p>}
          <Button className="mt-1 w-full" disabled={busy} type="submit">
            {busy ? 'Aguarde…' : mode === 'login' ? 'Entrar na biblioteca' : 'Criar conta de professor'}
          </Button>
        </form>
      </Card>
    </main>
  )
}