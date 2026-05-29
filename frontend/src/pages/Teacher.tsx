import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createRoom,
  finishRoom,
  getGames,
  getGrades,
  getRooms,
  getSubjects,
  startRoom,
  updateRoom,
  type Game,
  type Grade,
  type Room,
  type Subject,
} from '../services/api'
import './Teacher.css'

const STATUS_LABEL: Record<string, string> = {
  waiting: 'Aguardando',
  active: 'Em andamento',
  finished: 'Encerrada',
}
const ROOM_POLL_INTERVAL = 3000

export default function Teacher() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [roomName, setRoomName] = useState('Turma de hoje')
  const [grade, setGrade] = useState<number | undefined>(undefined)
  const [subject, setSubject] = useState<string | undefined>(undefined)
  const [gameId, setGameId] = useState('')
  const [roomCode, setRoomCode] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [roomGameSelection, setRoomGameSelection] = useState<Record<string, string>>({})

  const { data: grades = [] } = useQuery<Grade[]>({
    queryKey: ['grades'],
    queryFn: getGrades,
  })

  const { data: subjects = [] } = useQuery<Subject[]>({
    queryKey: ['subjects'],
    queryFn: getSubjects,
  })

  const { data: roomGamesFiltered = [], isLoading: gamesLoading } = useQuery<Game[]>({
    queryKey: ['room-games', grade, subject],
    queryFn: () => getGames({ mode: 'sala_codigo', grade, subject }),
  })
  const { data: allRoomGames = [] } = useQuery<Game[]>({
    queryKey: ['room-games-all'],
    queryFn: () => getGames({ mode: 'sala_codigo' }),
  })

  const { data: rooms = [], isLoading: roomsLoading } = useQuery<Room[]>({
    queryKey: ['rooms'],
    queryFn: getRooms,
    refetchInterval: ROOM_POLL_INTERVAL,
  })

  const roomGamesById = useMemo(
    () => Object.fromEntries(allRoomGames.map(game => [game.id, game])),
    [allRoomGames],
  )

  const effectiveGameId = roomGamesFiltered.some(game => game.id === gameId)
    ? gameId
    : (roomGamesFiltered[0]?.id ?? '')

  const refreshRooms = async () => {
    await queryClient.invalidateQueries({ queryKey: ['rooms'] })
  }

  const createRoomMutation = useMutation({
    mutationFn: createRoom,
    onSuccess: async room => {
      setRoomCode(room.code)
      setError('')
      await refreshRooms()
    },
    onError: () => {
      setError('Não foi possível criar a sala. Revise os dados e tente novamente.')
    },
  })

  const updateRoomMutation = useMutation({
    mutationFn: ({ code, roomGameId }: { code: string; roomGameId: string }) =>
      updateRoom(code, { game_id: roomGameId }),
    onSuccess: async () => {
      setError('')
      await refreshRooms()
    },
    onError: () => {
      setError('Não foi possível salvar o jogo da sala.')
    },
  })

  const startRoomMutation = useMutation({
    mutationFn: ({ code, roomGameId }: { code: string; roomGameId?: string }) =>
      startRoom(code, roomGameId),
    onSuccess: async () => {
      setError('')
      await refreshRooms()
    },
    onError: () => {
      setError('Não foi possível iniciar a atividade. Selecione um jogo válido para sala por código.')
    },
  })

  const finishRoomMutation = useMutation({
    mutationFn: finishRoom,
    onSuccess: async () => {
      setError('')
      await refreshRooms()
    },
    onError: () => {
      setError('Não foi possível encerrar a sala.')
    },
  })

  const handleCreate = () => {
    const trimmedRoomName = roomName.trim()
    if (!trimmedRoomName) {
      setError('Informe um nome para a sala/atividade.')
      return
    }
    createRoomMutation.mutate({
      name: trimmedRoomName,
      grade,
      subject,
      game_id: effectiveGameId || undefined,
    })
  }

  const getRoomSelectedGame = (room: Room): string => {
    if (roomGameSelection[room.code] !== undefined) return roomGameSelection[room.code]
    return room.selected_game_id ?? ''
  }

  const getRoomGameLabel = (room: Room) => {
    if (!room.selected_game_id) return 'Não selecionado'
    return roomGamesById[room.selected_game_id]?.name ?? room.selected_game_id
  }

  return (
    <div className="page teacher-page">
      <h2 className="page-title">👨‍🏫 Painel do Professor</h2>
      <p className="page-subtitle">
        Crie salas por código, selecione um jogo e inicie a atividade para a turma.
      </p>

      <div className="teacher-grid">
        <div className="card teacher-card">
          <h3 className="card-heading">🚀 Criar Nova Sala</h3>
          <div className="form-group">
            <label className="form-label" htmlFor="room-name">Nome da sala/atividade</label>
            <input
              id="room-name"
              className="input"
              value={roomName}
              onChange={e => setRoomName(e.target.value)}
              maxLength={120}
            />
          </div>
          <div className="teacher-inline-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="grade-select">Ano</label>
              <select
                id="grade-select"
                className="input"
                value={grade ?? ''}
                onChange={e => setGrade(e.target.value ? Number(e.target.value) : undefined)}
              >
                <option value="">Todos</option>
                {grades.map(item => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="subject-select">Disciplina</label>
              <select
                id="subject-select"
                className="input"
                value={subject ?? ''}
                onChange={e => setSubject(e.target.value || undefined)}
              >
                <option value="">Todas</option>
                {subjects.map(item => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="game-select">Jogo da atividade</label>
            <select
              id="game-select"
              className="input"
              value={effectiveGameId}
              onChange={e => setGameId(e.target.value)}
              disabled={gamesLoading || roomGamesFiltered.length === 0}
            >
              {roomGamesFiltered.length === 0 && <option value="">Nenhum jogo publicado com sala por código</option>}
              {roomGamesFiltered.map(game => (
                <option key={`${game.source}-${game.id}-${game.version}`} value={game.id}>
                  {game.name} ({game.version})
                </option>
              ))}
            </select>
          </div>

          {error && <p className="teacher-error">{error}</p>}
          <button
            className="btn btn-primary btn-lg"
            onClick={handleCreate}
            disabled={createRoomMutation.isPending}
          >
            {createRoomMutation.isPending ? '⏳ Criando...' : '▶ Criar Sala'}
          </button>

          {roomCode && (
            <div className="room-code-display">
              <p className="room-code-label">Código da Sala</p>
              <div className="room-code-value">{roomCode}</div>
              <p className="room-code-hint">Projete este código para os alunos acessarem</p>
            </div>
          )}
        </div>

        <div className="card teacher-card">
          <h3 className="card-heading">🗂️ Salas Criadas</h3>
          {roomsLoading ? (
            <div className="placeholder-area">⏳ Carregando salas...</div>
          ) : rooms.length === 0 ? (
            <div className="placeholder-area">Nenhuma sala criada ainda.</div>
          ) : (
            <div className="room-list">
              {rooms.map(room => {
                const selectedRoomGame = getRoomSelectedGame(room)
                const canStart = !!selectedRoomGame && room.status === 'waiting'
                const gameName = getRoomGameLabel(room)

                return (
                  <div key={room.code} className="room-list-item">
                    <div className="room-list-main">
                      <strong>{room.name}</strong>
                      <div className="room-list-meta">Código: {room.code} • Jogo: {gameName}</div>
                      <div className="room-list-meta">
                        {room.grade ? `${room.grade}º ano` : 'Todos os anos'} • {room.subject ?? 'Todas as disciplinas'}
                      </div>
                    </div>
                    <div className="room-list-side">
                      <span className="badge badge-purple">{STATUS_LABEL[room.status] ?? room.status}</span>
                      <small>{room.players.length} jogador(es)</small>
                      <div className="room-actions">
                        <select
                          className="input room-game-select"
                          value={selectedRoomGame}
                          onChange={e => setRoomGameSelection(current => ({ ...current, [room.code]: e.target.value }))}
                        >
                          <option value="">Selecionar jogo</option>
                          {allRoomGames.map(game => (
                            <option key={`room-${room.code}-${game.id}`} value={game.id}>{game.name}</option>
                          ))}
                        </select>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => updateRoomMutation.mutate({ code: room.code, roomGameId: selectedRoomGame })}
                          disabled={!selectedRoomGame || updateRoomMutation.isPending}
                        >
                          Salvar jogo
                        </button>
                        {room.status === 'waiting' && (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => startRoomMutation.mutate({ code: room.code, roomGameId: selectedRoomGame || undefined })}
                            disabled={!canStart || startRoomMutation.isPending}
                          >
                            Iniciar atividade
                          </button>
                        )}
                        {room.status === 'active' && (
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => finishRoomMutation.mutate(room.code)}
                            disabled={finishRoomMutation.isPending}
                          >
                            Encerrar sala
                          </button>
                        )}
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => navigate(`/entrar-sala?code=${room.code}`)}
                        >
                          Ver entrada do aluno
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="card teacher-card">
          <h3 className="card-heading">📌 Fluxo recomendado</h3>
          <div className="placeholder-area">
            <p>1) Crie a sala e projete o código</p>
            <p>2) Escolha e salve o jogo da atividade</p>
            <p>3) Clique em <strong>Iniciar atividade</strong></p>
            <p>4) Alunos entram em <code>/entrar-sala</code> e aguardam ou jogam conforme status</p>
          </div>
        </div>
      </div>

      <button onClick={() => navigate('/')} className="btn btn-outline btn-sm" style={{ marginTop: '1.5rem' }}>
        ← Voltar ao Início
      </button>
    </div>
  )
}
