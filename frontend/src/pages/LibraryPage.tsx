import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Game, ImportResult } from '../api/games'
import { listGames } from '../api/games'
import {
  createRoom,
  finishActivity,
  getRoomDashboard,
  listRooms,
  startActivity,
  type Room,
  type RoomDashboard,
} from '../api/rooms'
import { GameCatalog } from '../components/GameCatalog'
import { GameImport } from '../components/GameImport'

const cardStyle: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: 12,
  padding: 16,
  background: '#fff',
}

export function LibraryPage() {
  const [games, setGames] = useState<Game[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [dashboards, setDashboards] = useState<Record<string, RoomDashboard>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [roomName, setRoomName] = useState('')
  const [roomGameSlug, setRoomGameSlug] = useState('')
  const [creatingRoom, setCreatingRoom] = useState(false)
  const [busyRoomCode, setBusyRoomCode] = useState<string | null>(null)

  const gameOptions = useMemo(
    () => games.map((game) => ({ label: `${game.title} (${game.slug})`, value: game.slug })),
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
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  function handleImported(result: ImportResult) {
    setGames((prev) => {
      const without = prev.filter((g) => g.slug !== result.game.slug)
      return [result.game, ...without]
    })
    if (!roomGameSlug) {
      setRoomGameSlug(result.game.slug)
    }
    void loadData()
  }

  function handleDeleted(slug: string) {
    setGames((prev) => prev.filter((g) => g.slug !== slug))
    if (roomGameSlug === slug) {
      setRoomGameSlug('')
    }
    void loadData()
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
      setError(err instanceof Error ? err.message : String(err))
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
      setError(err instanceof Error ? err.message : String(err))
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
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusyRoomCode(null)
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px 40px' }}>
      <h1 style={{ fontSize: 28, marginBottom: 4 }}>📚 EduLab Games</h1>
      <p style={{ color: '#64748b', marginBottom: 24 }}>
        Biblioteca, painel do professor e fluxo de participação da Prioridade 5 em um único lugar.
      </p>

      {error && (
        <div style={{ ...cardStyle, marginBottom: 20, borderColor: '#fecaca', background: '#fef2f2', color: '#b91c1c' }}>
          Erro: {error}
        </div>
      )}

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Importar jogo</h2>
        <GameImport onImported={handleImported} />
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Painel do professor</h2>
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '340px minmax(0, 1fr)' }}>
          <form onSubmit={handleCreateRoom} style={{ ...cardStyle, display: 'grid', gap: 12, alignContent: 'start' }}>
            <strong>Criar sala</strong>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Nome da sala</span>
              <input
                value={roomName}
                onChange={(event) => setRoomName(event.target.value)}
                placeholder="Ex.: Laboratório 2A"
                required
                style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
              />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Jogo da atividade</span>
              <select
                value={roomGameSlug}
                onChange={(event) => setRoomGameSlug(event.target.value)}
                style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
              >
                <option value="">Selecione um jogo importado</option>
                {gameOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={creatingRoom || !roomName.trim() || !roomGameSlug}
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                border: 'none',
                background: '#2563eb',
                color: '#fff',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {creatingRoom ? 'Criando…' : 'Criar sala'}
            </button>
            <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
              Depois de criar, inicie a atividade e compartilhe o link/código com os alunos.
            </p>
          </form>

          <div style={{ display: 'grid', gap: 16 }}>
            {loading && <p style={{ color: '#64748b' }}>Carregando painel…</p>}
            {!loading && rooms.length === 0 && (
              <div style={cardStyle}>Nenhuma sala criada ainda.</div>
            )}
            {rooms.map((room) => {
              const dashboard = dashboards[room.code]
              const summary = dashboard?.participant_summary ?? room.participant_summary ?? {}
              const participants = dashboard?.participants ?? []
              const currentActivity = dashboard?.activity ?? room.current_activity
              const isBusy = busyRoomCode === room.code

              return (
                <div key={room.code} style={cardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                    <div>
                      <h3 style={{ margin: '0 0 6px' }}>{room.name}</h3>
                      <p style={{ margin: 0, color: '#475569' }}>
                        Código <strong>{room.code}</strong> • jogo <strong>{room.game_slug ?? 'não definido'}</strong>
                      </p>
                      <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 13 }}>
                        Status da sala: {room.status}
                        {currentActivity ? ` • atividade #${currentActivity.id} (${currentActivity.status})` : ' • sem atividade iniciada'}
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        onClick={() => handleStartRoom(room)}
                        disabled={isBusy || !room.game_slug}
                        style={{ padding: '8px 10px', borderRadius: 8, border: 'none', background: '#0f766e', color: '#fff', cursor: 'pointer' }}
                      >
                        {isBusy ? '…' : 'Iniciar atividade'}
                      </button>
                      <button
                        onClick={() => handleFinishRoom(room)}
                        disabled={isBusy || !currentActivity}
                        style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
                      >
                        Encerrar atividade
                      </button>
                      <Link to={`/join?room=${room.code}`} style={{ padding: '8px 10px', borderRadius: 8, background: '#eff6ff', textDecoration: 'none' }}>
                        Abrir entrada do aluno
                      </Link>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 14, marginBottom: 14 }}>
                    <span>Participantes: <strong>{summary.total ?? 0}</strong></span>
                    <span>Entraram: <strong>{summary.joined ?? 0}</strong></span>
                    <span>Jogando: <strong>{summary.active ?? 0}</strong></span>
                    <span>Concluíram: <strong>{summary.finished ?? 0}</strong></span>
                  </div>

                  {participants.length === 0 ? (
                    <p style={{ margin: 0, color: '#64748b' }}>Nenhum participante registrado nesta atividade ainda.</p>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                        <thead>
                          <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                            <th style={{ padding: '8px 6px' }}>Participante</th>
                            <th style={{ padding: '8px 6px' }}>Origem</th>
                            <th style={{ padding: '8px 6px' }}>Status</th>
                            <th style={{ padding: '8px 6px' }}>Pontuação</th>
                            <th style={{ padding: '8px 6px' }}>Última atividade</th>
                          </tr>
                        </thead>
                        <tbody>
                          {participants.map((participant) => (
                            <tr key={participant.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '8px 6px' }}>{participant.display_name}</td>
                              <td style={{ padding: '8px 6px' }}>{participant.source}</td>
                              <td style={{ padding: '8px 6px' }}>{participant.status}</td>
                              <td style={{ padding: '8px 6px' }}>{participant.last_score ?? '—'}</td>
                              <td style={{ padding: '8px 6px' }}>{new Date(participant.last_seen_at).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>
          Biblioteca ({games.length} {games.length === 1 ? 'jogo' : 'jogos'})
        </h2>
        {loading && <p style={{ color: '#64748b' }}>Carregando…</p>}
        {!loading && !error && <GameCatalog games={games} onDelete={handleDeleted} />}
      </section>
    </div>
  )
}
