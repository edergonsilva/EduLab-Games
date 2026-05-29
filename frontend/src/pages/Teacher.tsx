import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createRoom, getGames, getRooms, type Game, type Room } from '../services/api'
import './Teacher.css'

const STATUS_LABEL: Record<string, string> = {
  waiting: 'Aguardando',
  active: 'Em andamento',
  finished: 'Encerrada',
}

export default function Teacher() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [gameId, setGameId] = useState('')
  const [roomCode, setRoomCode] = useState<string | null>(null)
  const [error, setError] = useState('')

  const { data: roomGames = [], isLoading: gamesLoading } = useQuery<Game[]>({
    queryKey: ['room-games'],
    queryFn: () => getGames({ mode: 'sala_codigo' }),
  })

  const { data: rooms = [], isLoading: roomsLoading } = useQuery<Room[]>({
    queryKey: ['rooms'],
    queryFn: getRooms,
  })

  const effectiveGameId = roomGames.some(game => game.id === gameId)
    ? gameId
    : (roomGames[0]?.id ?? '')

  const createRoomMutation = useMutation({
    mutationFn: createRoom,
    onSuccess: room => {
      setRoomCode(room.code)
      setError('')
      void queryClient.invalidateQueries({ queryKey: ['rooms'] })
    },
    onError: () => {
      setError('Não foi possível criar a sala. Escolha um jogo com modo sala por código e tente novamente.')
    },
  })

  const handleCreate = () => {
    if (!effectiveGameId) {
      setError('Nenhum jogo publicado com sala por código está disponível no momento.')
      return
    }
    createRoomMutation.mutate(effectiveGameId)
  }

  return (
    <div className="page teacher-page">
      <h2 className="page-title">👨‍🏫 Painel do Professor</h2>
      <p className="page-subtitle">
        Crie uma sala, projete o código e acompanhe as salas persistidas localmente.
      </p>

      <div className="teacher-grid">
        <div className="card teacher-card">
          <h3 className="card-heading">🚀 Criar Nova Sala</h3>
          <div className="form-group">
            <label className="form-label" htmlFor="game-select">Jogo</label>
            <select
              id="game-select"
              className="input"
              value={effectiveGameId}
              onChange={e => setGameId(e.target.value)}
              disabled={gamesLoading || roomGames.length === 0}
            >
              {roomGames.length === 0 && <option value="">Nenhum jogo publicado com sala por código</option>}
              {roomGames.map(game => (
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
            disabled={createRoomMutation.isPending || roomGames.length === 0}
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
          <h3 className="card-heading">🗂️ Salas Recentes</h3>
          {roomsLoading ? (
            <div className="placeholder-area">⏳ Carregando salas...</div>
          ) : rooms.length === 0 ? (
            <div className="placeholder-area">Nenhuma sala criada ainda.</div>
          ) : (
            <div className="room-list">
              {rooms.map(room => (
                <div key={room.code} className="room-list-item">
                  <div>
                    <strong>Sala {room.code}</strong>
                    <div className="room-list-meta">Jogo: {room.game_id}</div>
                  </div>
                  <div className="room-list-side">
                    <span className="badge badge-purple">{STATUS_LABEL[room.status] ?? room.status}</span>
                    <small>{room.players.length} jogador(es)</small>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card teacher-card">
          <h3 className="card-heading">📄 Importar Lista de Alunos (PDF)</h3>
          <div className="placeholder-area">
            <span className="placeholder-icon">🔶</span>
            <p>
              A importação de PDF continua planejada para a próxima etapa, mas as salas e jogos já podem ser testados
              localmente com backend persistente.
            </p>
          </div>
        </div>
      </div>

      <button onClick={() => navigate('/')} className="btn btn-outline btn-sm" style={{ marginTop: '1.5rem' }}>
        ← Voltar ao Início
      </button>
    </div>
  )
}
