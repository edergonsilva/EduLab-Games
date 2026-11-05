import { FormEvent, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { joinRoom, saveStudentSession } from '../api/rooms'
import { userErrorMessage } from '../api/errors'
import { Button, Card, Field, Input, PageContainer, PageHeader } from '../components/ui'

export function JoinRoomPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const initialRoomCode = useMemo(() => searchParams.get('room') ?? '', [searchParams])
  const [roomCode, setRoomCode] = useState(initialRoomCode)
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const result = await joinRoom(roomCode.trim().toUpperCase(), {
        display_name: displayName.trim(),
      })
      setMessage(result.message)

      saveStudentSession({
        room_code: result.room.code,
        participant_id: result.participant.id,
        display_name: result.participant.display_name,
        activity_id: result.activity.id,
        runner_url: result.runner_url ?? null,
      })

      if (result.activity.status === 'lobby' || !result.runner_url) {
        navigate(`/sala/${result.room.code}/lobby`, { replace: true })
        return
      }

      navigate('/runner')
    } catch (err) {
      setError(userErrorMessage(err, 'Não foi possível entrar na sala.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader eyebrow="Participar de uma atividade" title="Entrar na sala" description="Informe o código da sala e seu nome ou apelido. Cada aluno pode jogar uma vez por atividade." />

      <Card className="mx-auto max-w-xl p-5 sm:p-7">
        <form onSubmit={handleSubmit} className="grid gap-4">
          <Field label="Código da sala">
            <Input
            value={roomCode}
            onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
            placeholder="Ex.: AB12CD"
            required
            autoCapitalize="characters"
            />
          </Field>

          <Field label="Nome ou apelido">
            <Input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Ex.: Ana"
            required
            autoComplete="name"
            />
          </Field>

          <Button className="mt-2 w-full" disabled={loading} type="submit">
            {loading ? 'Entrando…' : 'Entrar e abrir atividade'}
          </Button>

          {message && <p className="m-0 text-sm text-brand-dark">{message}</p>}
          {error && <p role="alert" className="m-0 text-sm text-danger">Erro: {error}</p>}
        </form>
      </Card>
    </PageContainer>
  )
}
