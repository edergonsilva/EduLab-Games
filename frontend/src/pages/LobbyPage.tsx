import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getRoomLobby, readStudentSession, saveStudentSession, type RoomLobby } from '../api/rooms'
import { userErrorMessage } from '../api/errors'
import { subscribeToRooms } from '../api/realtime'
import { Badge, Card, PageContainer, PageHeader } from '../components/ui'

export function LobbyPage() {
  const { code } = useParams()
  const navigate = useNavigate()
  const roomCode = (code ?? '').trim().toUpperCase()
  const [lobby, setLobby] = useState<RoomLobby | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!roomCode) {
      setError('Código da sala não informado.')
      setLoading(false)
      return
    }

    async function loadLobby() {
      try {
        setError(null)
        const nextLobby = await getRoomLobby(roomCode)
        setLobby(nextLobby)
        // Auto-redirect when activity becomes active
        if (nextLobby.room.status === 'active' && nextLobby.activity) {
          const participant = nextLobby.participants.find(
            (item) => item.id === nextLobby.current_participant_id,
          )
          if (participant) {
            saveStudentSession({
              room_code: roomCode,
              participant_id: participant.id,
              display_name: participant.display_name,
              activity_id: nextLobby.activity.id,
            })
            navigate('/runner', { replace: true })
          }
        }
      } catch (err) {
        setError(userErrorMessage(err, 'Não foi possível carregar a sala.'))
      } finally {
        setLoading(false)
      }
    }

    void loadLobby()

    // Real-time updates via WebSocket - NO POLLING!
    const unsubscribe = subscribeToRooms(
      [roomCode],
      (eventName) => {
        // On room events, refetch lobby state
        if (eventName === 'activity.started' || eventName === 'room.updated' || eventName === 'participant.joined') {
          void loadLobby()
        }
      },
      // On reconnect: refetch lobby
      () => void loadLobby(),
    )

    return () => {
      unsubscribe()
    }
  }, [navigate, roomCode])

  if (loading) {
    return <PageContainer><p className="text-sm text-muted">Carregando sala…</p></PageContainer>
  }

  if (error || !lobby) {
    return (
      <PageContainer className="max-w-xl">
        <Card role="alert" className="border-red-200 bg-red-50 p-4 text-sm text-danger">
          {error ?? 'Sala não encontrada.'}
        </Card>
        <Link className="mt-4 inline-block text-sm font-semibold text-brand no-underline hover:underline" to="/join">Voltar para a entrada</Link>
      </PageContainer>
    )
  }

  const activityStatus = lobby.room.status
  const session = readStudentSession()
  const participants = [...(lobby.participants ?? [])].sort((first, second) => {
    const firstScore = first.last_score ?? -Infinity
    const secondScore = second.last_score ?? -Infinity
    if (firstScore !== secondScore) return Number(secondScore) - Number(firstScore)
    return new Date(first.joined_at).getTime() - new Date(second.joined_at).getTime()
  })
  const currentPosition = session ? participants.findIndex((participant) => participant.id === session.participant_id) + 1 : 0
  const topParticipants = participants.slice(0, 3)

  return (
    <PageContainer className="max-w-4xl">
      <PageHeader
        eyebrow="Sala em espera"
        title={lobby.room.name}
        description={`Código ${lobby.room.code}. Acompanhe a abertura da atividade e os colegas que já entraram.`}
      />

      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="m-0 text-xs font-bold uppercase tracking-[0.12em] text-brand">Status da sala</p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-ink">{activityStatus === 'finished' ? 'Atividade encerrada' : activityStatus === 'active' ? 'Atividade iniciada' : 'Aguardando o professor'}</h2>
            </div>
            <Badge tone={activityStatus === 'active' ? 'brand' : 'accent'}>{activityStatus === 'active' ? 'Ativa' : 'Em espera'}</Badge>
          </div>

          <p className="text-sm leading-6 text-muted">
            {activityStatus === 'finished'
              ? 'O professor encerrou esta sala. Os resultados permanecem registrados.'
              : activityStatus === 'active'
                ? 'A atividade já começou. Esta página será encaminhada ao jogo.'
                : 'A sala está aberta. Assim que o professor iniciar a atividade, o jogo será liberado para os participantes.'}
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-line bg-canvas p-3">
              <p className="m-0 text-xs uppercase text-muted">Código</p>
              <p className="mt-2 font-mono text-lg font-semibold text-ink">{lobby.room.code}</p>
            </div>
            <div className="rounded-md border border-line bg-canvas p-3">
              <p className="m-0 text-xs uppercase text-muted">Participantes</p>
              <p className="mt-2 text-lg font-semibold text-ink">{lobby.participant_count}</p>
            </div>
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-muted">Ranking inicial</p>
          {topParticipants.length === 0 ? (
            <p className="m-0 text-sm text-muted">Ainda não há participantes nesta sala.</p>
          ) : (
            <div className="grid gap-3">
              {topParticipants.map((participant, index) => (
                <div key={participant.id} className="flex items-center justify-between gap-3 rounded-md border border-line bg-canvas px-3 py-2 text-sm">
                  <div>
                    <span className="mr-2 font-bold text-brand">#{index + 1}</span>
                    <span className="font-medium text-ink">{participant.display_name}</span>
                  </div>
                  <span className="font-semibold tabular-nums text-ink">{participant.last_score ?? 0} pts</span>
                </div>
              ))}
            </div>
          )}

          {currentPosition > 0 && (
            <div className="mt-4 rounded-md border border-brand/30 bg-brand-pale p-3 text-sm text-brand-dark">
              Sua posição atual: <strong>#{currentPosition}</strong>
            </div>
          )}
        </Card>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Link className="inline-flex min-h-10 items-center rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-ink no-underline hover:bg-canvas" to="/join">Voltar</Link>
      </div>
    </PageContainer>
  )
}
