import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Game } from '../api/games'
import { listGames } from '../api/games'
import {
  createRoom,
  deleteRoom,
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
import { GameImportPanel } from '../components/GameImportPanel'
import { Badge, Button, Card, Field, formatBrazilDateTime, Input, Modal, PageContainer, PageHeader, SectionHeading, Select } from '../components/ui'
import { userErrorMessage } from '../api/errors'
import { subscribeToRooms } from '../api/realtime'

export function LibraryPage({ teacherId }: { teacherId: number }) {
  const [games, setGames] = useState<Game[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [dashboards, setDashboards] = useState<Record<string, RoomDashboard>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [roomName, setRoomName] = useState('')
  const [activityGameByRoom, setActivityGameByRoom] = useState<Record<string, string>>({})
  const [roomGameSlug, setRoomGameSlug] = useState('')
  const [copiedInviteCode, setCopiedInviteCode] = useState<string | null>(null)
  const [copiedRoomCode, setCopiedRoomCode] = useState<string | null>(null)
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

  // Load initial dashboards on mount
  useEffect(() => {
    if (rooms.length === 0) return
    async function loadInitial() {
      const entries = await Promise.all(
        rooms.map(async (room) => {
          try {
            return [room.code, await getRoomDashboard(room.code)] as const
          } catch {
            return [room.code, null] as const
          }
        }),
      )
      setDashboards((current) => {
        const next = { ...current }
        for (const [code, dashboard] of entries) {
          if (dashboard) next[code] = dashboard
        }
        return next
      })
    }
    void loadInitial()
  }, [rooms])

  // Real-time updates via WebSocket (no polling!)
  useEffect(() => {
    if (rooms.length === 0) return

    const unsubscribe = subscribeToRooms(
      rooms.map((room) => room.code),
      (eventName, payload: unknown) => {
        // Update dashboards in real-time via Socket.IO
        const typedPayload = payload as Record<string, unknown>
        
        if (eventName === 'activity.score') {
          setDashboards((prev) => {
            const code = typedPayload.room_code as string
            if (!prev[code]?.participants) return prev
            return {
              ...prev,
              [code]: {
                ...prev[code],
                participants: prev[code].participants.map((p) =>
                  p.id === typedPayload.participant_id
                    ? { ...p, last_score: typedPayload.score as number }
                    : p
                ),
              },
            }
          })
        } else if (eventName === 'activity.progress') {
          setDashboards((prev) => {
            const code = typedPayload.room_code as string
            if (!prev[code]?.participants) return prev
            const progress = typedPayload.progress as { current?: number; total?: number } | undefined
            return {
              ...prev,
              [code]: {
                ...prev[code],
                participants: prev[code].participants.map((p) =>
                  p.id === typedPayload.participant_id
                    ? {
                        ...p,
                        progress_current: progress?.current ?? p.progress_current,
                        progress_total: progress?.total ?? p.progress_total,
                      }
                    : p
                ),
              },
            }
          })
        } else if (eventName === 'participant.updated') {
          setDashboards((prev) => {
            const code = typedPayload.room_code as string
            if (!prev[code]?.participants) return prev
            return {
              ...prev,
              [code]: {
                ...prev[code],
                participants: prev[code].participants.map((p) =>
                  p.id === typedPayload.participant_id
                    ? { 
                        ...p, 
                        connection_status: typedPayload.connection_status as string, 
                        status: typedPayload.status as string 
                      }
                    : p
                ),
              },
            }
          })
        } else if (eventName === 'activity.completed') {
          setDashboards((prev) => {
            const code = typedPayload.room_code as string
            if (!prev[code]?.participants) return prev
            return {
              ...prev,
              [code]: {
                ...prev[code],
                participants: prev[code].participants.map((p) =>
                  p.id === typedPayload.participant_id
                    ? { ...p, status: 'completed' }
                    : p
                ),
              },
            }
          })
        }
      },
      // On reconnect: refetch all dashboards
      async () => {
        const entries = await Promise.all(
          rooms.map(async (room) => {
            try {
              return [room.code, await getRoomDashboard(room.code)] as const
            } catch {
              return [room.code, null] as const
            }
          }),
        )
        setDashboards((current) => {
          const next = { ...current }
          for (const [code, dashboard] of entries) {
            if (dashboard) next[code] = dashboard
          }
          return next
        })
      }
    )

    return () => {
      unsubscribe()
    }
  }, [rooms])

  function handleDeleted(slug: string) {
    setGames((prev) => prev.filter((g) => g.slug !== slug))
    setActivityGameByRoom((current) => Object.fromEntries(
      Object.entries(current).filter(([, gameSlug]) => gameSlug !== slug),
    ))
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
        game_slug: roomGameSlug,
      })
      setRoomName('')
      setRoomGameSlug('')
      await loadData()
    } catch (err) {
      setError(userErrorMessage(err, 'Não foi possível criar a sala.'))
    } finally {
      setCreatingRoom(false)
    }
  }

  async function handleStartRoom(room: Room) {
    const selectedGame = room.game_slug || activityGameByRoom[room.code]
    setBusyRoomCode(room.code)
    setError(null)
    try {
      if (!selectedGame) {
        throw new Error('Selecione um jogo antes de iniciar a atividade.')
      }
      await startActivity(room.code, selectedGame)
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

  async function handleDeleteRoom(room: Room) {
    const confirmed = window.confirm(`Excluir a sala "${room.name}" (código ${room.code})?\n\nEsta ação remove também as atividades e os registros desta sala.`)
    if (!confirmed) return

    setBusyRoomCode(room.code)
    setError(null)
    try {
      await deleteRoom(room.code)
      setRooms((current) => current.filter((item) => item.code !== room.code))
      setDashboards((current) => {
        const next = { ...current }
        delete next[room.code]
        return next
      })
    } catch (err) {
      setError(userErrorMessage(err, 'Não foi possível excluir a sala.'))
    } finally {
      setBusyRoomCode(null)
    }
  }

  async function handleCopyRoomInvite(room: Room) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/join?room=${encodeURIComponent(room.code)}`)
      setCopiedInviteCode(room.code)
      window.setTimeout(() => setCopiedInviteCode((current) => current === room.code ? null : current), 2000)
    } catch {
      setError('Não foi possível copiar o convite neste navegador.')
    }
  }

  async function handleCopyRoomCode(room: Room) {
    try {
      await navigator.clipboard.writeText(room.code)
      setCopiedRoomCode(room.code)
      window.setTimeout(() => setCopiedRoomCode((current) => current === room.code ? null : current), 2000)
    } catch {
      setError('Não foi possível copiar o código neste navegador.')
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
                  required
                >
                  <option value="">Selecione um jogo</option>
                  {gameOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </Select>
              </Field>
              <Button
              type="submit"
              disabled={creatingRoom || !roomName.trim() || !roomGameSlug}
            >
              {creatingRoom ? 'Criando…' : 'Criar sala'}
              </Button>
              <p className="m-0 text-xs leading-5 text-muted">A sala começa em espera. Compartilhe o convite, acompanhe as entradas e inicie quando a turma estiver pronta.</p>
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
              const participants = [...(dashboard?.participants ?? [])].sort((first, second) => {
                const firstScore = first.last_score ?? -Infinity
                const secondScore = second.last_score ?? -Infinity
                if (firstScore !== secondScore) return Number(secondScore) - Number(firstScore)
                return new Date(first.joined_at).getTime() - new Date(second.joined_at).getTime()
              })
              const currentActivity = dashboard?.activity ?? room.current_activity
              const isBusy = busyRoomCode === room.code

              return (
                <Card key={room.code} className="min-w-0 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="font-display text-lg font-semibold text-ink">{room.name}</h3>
                      <p className="mt-1 text-sm text-muted">
                        Código <strong className="font-mono text-ink">{room.code}</strong> · último jogo <strong className="text-ink">{room.game_slug ?? 'nenhum'}</strong>
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                        <Badge tone={room.status === 'active' ? 'brand' : room.status === 'finished' ? 'danger' : 'accent'}>{room.status}</Badge>
                        {currentActivity && <span>Atividade #{currentActivity.id} · {currentActivity.status}</span>}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <label className="grid min-w-48 gap-1 text-xs font-semibold text-muted">
                        Jogo desta atividade
                        {room.game_slug ? (
                          <span className="text-sm text-ink">
                            {games.find((game) => game.slug === room.game_slug)?.title ?? room.game_slug}
                          </span>
                        ) : (
                          <Select
                            value={activityGameByRoom[room.code] ?? ''}
                            onChange={(event) => setActivityGameByRoom((current) => ({
                              ...current,
                              [room.code]: event.target.value,
                            }))}
                            disabled={isBusy || games.length === 0}
                            aria-label={`Jogo da atividade da sala ${room.name}`}
                          >
                            <option value="">Selecione um jogo</option>
                            {gameOptions.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </Select>
                        )}
                      </label>
                      <Button
                        onClick={() => void handleOpenHistory(room)}
                        type="button"
                        variant="secondary" size="sm">Histórico</Button>
                      <Button onClick={() => void handleCopyRoomInvite(room)} type="button" variant="secondary" size="sm">
                        {copiedInviteCode === room.code ? 'Convite copiado' : 'Copiar convite'}
                      </Button>
                      <Button onClick={() => void handleCopyRoomCode(room)} type="button" variant="secondary" size="sm">
                        {copiedRoomCode === room.code ? 'Copiado' : 'Copiar código'}
                      </Button>
                      <Button
                        onClick={() => void handleStartRoom(room)}
                        type="button"
                        disabled={isBusy || room.status !== 'waiting' || !(room.game_slug || activityGameByRoom[room.code])}
                      >
                        {isBusy ? '…' : 'Iniciar atividade'}
                      </Button>
                      <Button
                        onClick={() => void handleDeleteRoom(room)}
                        type="button"
                        disabled={isBusy}
                        variant="danger"
                        size="sm"
                      >
                        {isBusy ? '…' : 'Excluir'}
                      </Button>
                      <Button
                        onClick={() => handleFinishRoom(room)}
                        type="button"
                        disabled={isBusy || room.status !== 'active' || !currentActivity}
                        variant="secondary" size="sm">Encerrar atividade</Button>
                      <Link className="inline-flex min-h-10 items-center rounded-md bg-brand-soft px-3 py-2 text-sm font-semibold text-brand-dark no-underline hover:bg-brand/15" to={`/join?room=${room.code}`}>
                        Link do aluno
                      </Link>
                    </div>
                  </div>

                  <div className="my-4 flex flex-wrap gap-2">
                    <Badge>{summary.total ?? 0} participantes</Badge>
                    <Badge>{summary.waiting ?? 0} na fila</Badge>
                    <Badge tone="accent">{summary.playing ?? 0} jogando</Badge>
                    <Badge tone="brand">{summary.completed ?? 0} concluíram</Badge>
                  </div>

                  <p className="mb-4 text-xs leading-5 text-muted">
                    A pontuação aparece quando o jogo envia eventos de atividade. Jogos sem essa integração abrem normalmente, mas não atualizam o ranking.
                  </p>

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
                            <th className="px-3 py-2.5 font-semibold">Conexão</th>
                            <th className="px-3 py-2.5 font-semibold">Progresso</th>
                            <th className="px-3 py-2.5 font-semibold">Última atividade</th>
                          </tr>
                        </thead>
                        <tbody>
                          {participants.map((participant) => {
                            const statusLabel = {
                              waiting: 'Na fila',
                              playing: 'Jogando',
                              completed: 'Concluiu',
                            }[participant.status] ?? participant.status

                            return (
                              <tr key={participant.id} className="border-b border-line last:border-0">
                                <td className="px-3 py-2.5 font-medium text-ink">{participant.display_name}</td>
                                <td className="px-3 py-2.5 text-muted">{participant.source}</td>
                                <td className="px-3 py-2.5 text-muted">{statusLabel}</td>
                                <td className="px-3 py-2.5 font-semibold tabular-nums text-ink">{participant.last_score ?? '—'}</td>
                                <td className="px-3 py-2.5 text-muted">{participant.connection_status === 'connected' ? 'Conectado' : 'Desconectado'}</td>
                                <td className="px-3 py-2.5 text-muted">{participant.progress_total ? `${participant.progress_current ?? 0}/${participant.progress_total}` : '—'}</td>
                                <td className="px-3 py-2.5 text-muted">{formatBrazilDateTime(participant.last_seen_at)}</td>
                              </tr>
                            )
                          })}
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

      <section className="mb-10">
        <SectionHeading title="Importar jogos" description="Adicione novos jogos à sua biblioteca." />
        <GameImportPanel onImportSuccess={loadData} />
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
