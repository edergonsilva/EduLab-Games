import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Game } from '../api/games'
import { listGames } from '../api/games'
import {
  createRoom,
  finishActivity,
  getRoomDashboard,
  getRoomHistory,
  listRooms,
  startActivity,
  type Room,
  type RoomDashboard,
  type RoomHistory,
} from '../api/rooms'
import { GameCatalog } from '../components/GameCatalog'
import { Badge, Button, Card, Field, formatBrazilDateTime, Input, Modal, PageContainer, PageHeader, SectionHeading, Select } from '../components/ui'
import { userErrorMessage } from '../api/errors'

export function LibraryPage({ teacherId }: { teacherId: number }) {
  const [games, setGames] = useState<Game[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [dashboards, setDashboards] = useState<Record<string, RoomDashboard>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [roomName, setRoomName] = useState('')
  const [roomGameSlug, setRoomGameSlug] = useState('')
  const [creatingRoom, setCreatingRoom] = useState(false)
  const [busyRoomCode, setBusyRoomCode] = useState<string | null>(null)
  const [historyRoom, setHistoryRoom] = useState<Room | null>(null)
  const [roomHistory, setRoomHistory] = useState<RoomHistory | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)

  const gameOptions = useMemo(
    () => games.map((game) => ({ label: `${game.title}`, value: game.slug })),
    [games],
  )

  async function loadDashboards(roomList: Room[]) {
    const entries = await Promise.all(
      roomList.map(async (room) => {
        try {
          return [room.code, await getRoomDashboard(room.code)] as const
        } catch {
          return [room.code, null] as const
        }
      }),
    )

    const nextDashboards: Record<string, RoomDashboard> = {}
    for (const [code, dashboard] of entries) {
      if (dashboard) nextDashboards[code] = dashboard
    }
    setDashboards(nextDashboards)
  }

  async function loadData() {
    try {
      setError(null)
      const [loadedGames, loadedRooms] = await Promise.all([listGames(), listRooms()])
      setGames(loadedGames)
      setRooms(loadedRooms)
      if (!roomGameSlug && loadedGames[0]) {
        setRoomGameSlug(loadedGames[0].slug)
      }
      await loadDashboards(loadedRooms)
    } catch (err) {
      setError(userErrorMessage(err, 'Não foi possível carregar a biblioteca.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  useEffect(() => {
    if (rooms.length === 0) return
    let cancelled = false

    async function refreshDashboards() {
      if (document.visibilityState !== 'visible') return
      const entries = await Promise.all(
        rooms.map(async (room) => {
          try {
            return [room.code, await getRoomDashboard(room.code)] as const
          } catch {
            return [room.code, null] as const
          }
        }),
      )
      if (cancelled) return
      setDashboards((current) => {
        const next = { ...current }
        for (const [code, dashboard] of entries) {
          if (dashboard) next[code] = dashboard
        }
        return next
      })
    }

    const interval = window.setInterval(() => void refreshDashboards(), 2500)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [rooms])

  function handleDeleted(slug: string) {
    setGames((prev) => prev.filter((g) => g.slug !== slug))
    if (roomGameSlug === slug) {
      setRoomGameSlug('')
    }
    void loadData()
  }

  function handleUpdated(updatedGame: Game) {
    setGames((previous) => previous.map((game) => game.slug === updatedGame.slug ? updatedGame : game))
  }

  async function handleOpenHistory(room: Room) {
    setHistoryRoom(room)
    setRoomHistory(null)
    setHistoryError(null)
    setHistoryLoading(true)
    try {
      setRoomHistory(await getRoomHistory(room.code))
    } catch (err) {
      setHistoryError(userErrorMessage(err, 'Não foi possível carregar o histórico.'))
    } finally {
      setHistoryLoading(false)
    }
  }

  async function handleCreateRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCreatingRoom(true)
    setError(null)
    try {
      await createRoom({
        name: roomName.trim(),
        game_slug: roomGameSlug || undefined,
      })
      setRoomName('')
      await loadData()
    } catch (err) {
      setError(userErrorMessage(err, 'Não foi possível criar a sala.'))
    } finally {
      setCreatingRoom(false)
    }
  }

  async function handleStartRoom(room: Room) {
    setBusyRoomCode(room.code)
    setError(null)
    try {
      await startActivity(room.code, room.game_slug ?? undefined)
      await loadData()
    } catch (err) {
      setError(userErrorMessage(err, 'Não foi possível iniciar a atividade.'))
    } finally {
      setBusyRoomCode(null)
    }
  }

  async function handleFinishRoom(room: Room) {
    const activityId = dashboards[room.code]?.activity?.id ?? room.current_activity?.id
    if (!activityId) return
    setBusyRoomCode(room.code)
    setError(null)
    try {
      await finishActivity(activityId)
      await loadData()
    } catch (err) {
      setError(userErrorMessage(err, 'Não foi possível encerrar a atividade.'))
    } finally {
      setBusyRoomCode(null)
    }
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Espaço do professor"
        title="Biblioteca e salas"
        description="Organize seus jogos, inicie atividades e acompanhe o progresso das turmas."
        actions={<Link className="inline-flex min-h-10 items-center rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-ink no-underline transition-colors hover:bg-canvas" to="/professor/criador-de-jogos">Criar jogo com IA</Link>}
      />

      {error && (
        <Card role="alert" className="mb-6 border-red-200 bg-red-50 p-4 text-sm text-danger">
          Erro: {error}
        </Card>
      )}

      <section className="mb-10">
        <SectionHeading title="Salas de aula" description="Crie atividades e acompanhe os resultados em tempo real." />
        <div className="grid items-start gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="p-5">
            <h3 className="mb-4 font-display text-lg font-semibold text-ink">Criar sala</h3>
            <form onSubmit={handleCreateRoom} className="grid gap-4">
              <Field label="Nome da sala">
                <Input
                value={roomName}
                onChange={(event) => setRoomName(event.target.value)}
                placeholder="Ex.: Laboratório 2A"
                required
                />
              </Field>
              <Field label="Jogo da atividade">
                <Select
                value={roomGameSlug}
                onChange={(event) => setRoomGameSlug(event.target.value)}
              >
                <option value="">Selecione um jogo importado</option>
                {gameOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
                </Select>
              </Field>
              <Button
              type="submit"
              disabled={creatingRoom || !roomName.trim() || !roomGameSlug}
            >
              {creatingRoom ? 'Criando…' : 'Criar sala'}
              </Button>
              <p className="m-0 text-xs leading-5 text-muted">Depois de criar, inicie a atividade e compartilhe o código com os alunos.</p>
            </form>
          </Card>

          <div className="grid min-w-0 gap-4">
            {loading && <p className="text-sm text-muted">Carregando salas…</p>}
            {!loading && rooms.length === 0 && (
              <Card className="p-6 text-sm text-muted">Nenhuma sala criada ainda.</Card>
            )}
            {rooms.map((room) => {
              const dashboard = dashboards[room.code]
              const summary = dashboard?.participant_summary ?? room.participant_summary ?? {}
              const participants = dashboard?.participants ?? []
              const currentActivity = dashboard?.activity ?? room.current_activity
              const isBusy = busyRoomCode === room.code

              return (
                <Card key={room.code} className="min-w-0 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="font-display text-lg font-semibold text-ink">{room.name}</h3>
                      <p className="mt-1 text-sm text-muted">
                        Código <strong className="font-mono text-ink">{room.code}</strong> · jogo <strong className="text-ink">{room.game_slug ?? 'não definido'}</strong>
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                        <Badge tone={room.status === 'active' ? 'brand' : 'neutral'}>{room.status}</Badge>
                        {currentActivity && <span>Atividade #{currentActivity.id} · {currentActivity.status}</span>}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => void handleOpenHistory(room)}
                        variant="secondary" size="sm">Histórico</Button>
                      <Button
                        onClick={() => handleStartRoom(room)}
                        disabled={isBusy || !room.game_slug}
                      >
                        {isBusy ? '…' : 'Iniciar atividade'}
                      </Button>
                      <Button
                        onClick={() => handleFinishRoom(room)}
                        disabled={isBusy || !currentActivity}
                        variant="secondary" size="sm">Encerrar atividade</Button>
                      <Link className="inline-flex min-h-10 items-center rounded-md bg-brand-soft px-3 py-2 text-sm font-semibold text-brand-dark no-underline hover:bg-brand/15" to={`/join?room=${room.code}`}>
                        Link do aluno
                      </Link>
                    </div>
                  </div>

                  <div className="my-4 flex flex-wrap gap-2">
                    <Badge>{summary.total ?? 0} participantes</Badge>
                    <Badge>{summary.joined ?? 0} entraram</Badge>
                    <Badge tone="accent">{summary.active ?? 0} jogando</Badge>
                    <Badge tone="brand">{summary.finished ?? 0} concluíram</Badge>
                  </div>

                  {participants.length === 0 ? (
                    <p className="m-0 text-sm text-muted">Nenhum participante registrado nesta atividade ainda.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-md border border-line">
                      <table className="w-full min-w-[620px] border-collapse text-left text-sm">
                        <thead>
                          <tr className="border-b border-line bg-canvas text-xs uppercase text-muted">
                            <th className="px-3 py-2.5 font-semibold">Participante</th>
                            <th className="px-3 py-2.5 font-semibold">Origem</th>
                            <th className="px-3 py-2.5 font-semibold">Status</th>
                            <th className="px-3 py-2.5 font-semibold">Pontuação</th>
                            <th className="px-3 py-2.5 font-semibold">Última atividade</th>
                          </tr>
                        </thead>
                        <tbody>
                          {participants.map((participant) => (
                            <tr key={participant.id} className="border-b border-line last:border-0">
                              <td className="px-3 py-2.5 font-medium text-ink">{participant.display_name}</td>
                              <td className="px-3 py-2.5 text-muted">{participant.source}</td>
                              <td className="px-3 py-2.5 text-muted">{participant.status}</td>
                              <td className="px-3 py-2.5 font-semibold tabular-nums text-ink">{participant.last_score ?? '—'}</td>
                              <td className="px-3 py-2.5 text-muted">{formatBrazilDateTime(participant.last_seen_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      <section>
        <SectionHeading title="Biblioteca de jogos" description={`${games.length} ${games.length === 1 ? 'jogo' : 'jogos'} disponíveis para sua conta.`} />
        {loading && <p className="text-sm text-muted">Carregando jogos…</p>}
        {!loading && !error && <GameCatalog games={games} teacherId={teacherId} onDelete={handleDeleted} onUpdate={handleUpdated} />}
      </section>

      {historyRoom && (
        <Modal labelledBy="room-history-title" onClose={() => setHistoryRoom(null)} className="max-h-[90vh] max-w-5xl overflow-y-auto">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id="room-history-title" className="font-display text-xl font-semibold text-ink">Histórico · {historyRoom.name}</h2>
                <p className="mt-1 text-sm text-muted">Sala <span className="font-mono">{historyRoom.code}</span></p>
              </div>
              <Button onClick={() => setHistoryRoom(null)} type="button" variant="quiet" aria-label="Fechar histórico">Fechar</Button>
            </div>
            {historyLoading && <p className="text-sm text-muted">Carregando atividades…</p>}
            {historyError && <p role="alert" className="text-sm text-danger">{historyError}</p>}
            {!historyLoading && roomHistory?.activities.length === 0 && <p className="text-sm text-muted">Esta sala ainda não tem atividades registradas.</p>}
            {roomHistory?.activities.map(({ activity, game, participants, events }) => {
              const namesById = new Map(participants.map((participant) => [participant.id, participant.display_name]))
              const scoredEvents = events.filter((activityEvent) => activityEvent.score !== null && activityEvent.score !== undefined)
              return (
                <section key={activity.id} className="grid gap-3 border-t border-line py-5">
                  <div className="flex flex-wrap justify-between gap-2">
                    <strong className="font-display font-semibold text-ink">{game?.title ?? activity.game_slug}</strong>
                    <span className="text-xs text-muted">Atividade #{activity.id} · {formatBrazilDateTime(activity.started_at)} · {activity.status}</span>
                  </div>
                  {participants.length > 0 && (
                    <div className="overflow-x-auto rounded-md border border-line">
                      <table className="w-full min-w-[480px] border-collapse text-left text-sm">
                        <thead><tr className="border-b border-line bg-canvas text-xs uppercase text-muted"><th className="px-3 py-2 font-semibold">Aluno</th><th className="px-3 py-2 font-semibold">Status final</th><th className="px-3 py-2 font-semibold">Última pontuação</th></tr></thead>
                        <tbody>{participants.map((participant) => <tr key={participant.id} className="border-b border-line last:border-0"><td className="px-3 py-2 font-medium">{participant.display_name}</td><td className="px-3 py-2 text-muted">{participant.status}</td><td className="px-3 py-2 font-semibold tabular-nums">{participant.last_score ?? '—'}</td></tr>)}</tbody>
                      </table>
                    </div>
                  )}
                  {scoredEvents.length > 0 && (
                    <details className="group">
                      <summary className="cursor-pointer text-sm font-semibold text-brand hover:text-brand-dark">Ver {scoredEvents.length} registro(s) de pontuação</summary>
                      <div className="mt-2 max-h-60 overflow-auto rounded-md border border-line">
                        <table className="w-full min-w-[480px] border-collapse text-left text-xs">
                          <thead><tr className="border-b border-line bg-canvas uppercase text-muted"><th className="px-2 py-2 font-semibold">Horário</th><th className="px-2 py-2 font-semibold">Aluno</th><th className="px-2 py-2 font-semibold">Evento</th><th className="px-2 py-2 font-semibold">Pontos</th></tr></thead>
                          <tbody>{scoredEvents.map((activityEvent) => <tr key={activityEvent.id} className="border-b border-line last:border-0"><td className="px-2 py-2">{formatBrazilDateTime(activityEvent.created_at)}</td><td className="px-2 py-2">{namesById.get(activityEvent.participant_id ?? -1) ?? '—'}</td><td className="px-2 py-2">{activityEvent.event_type}</td><td className="px-2 py-2 font-semibold tabular-nums">{activityEvent.score}</td></tr>)}</tbody>
                        </table>
                      </div>
                    </details>
                  )}
                  {participants.length === 0 && <p className="m-0 text-sm text-muted">Nenhum aluno participou desta atividade.</p>}
                </section>
              )
            })}
        </Modal>
      )}
    </PageContainer>
  )
}
