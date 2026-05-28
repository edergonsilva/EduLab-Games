import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getRoom, joinRoom, type Room } from '../services/api'
import './JoinRoom.css'

const STATUS_LABEL: Record<string, string> = {
  waiting: 'Aguardando início da atividade',
  active: 'Atividade em andamento',
  finished: 'Atividade encerrada',
}

export default function JoinRoom() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [code, setCode] = useState(searchParams.get('code') ?? '')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [joinedRoomCode, setJoinedRoomCode] = useState<string | null>(null)
  const [joinedRoomSnapshot, setJoinedRoomSnapshot] = useState<Room | null>(null)

  const joinedCode = joinedRoomCode ?? null
  const { data: roomLive } = useQuery<Room>({
    queryKey: ['room-by-code', joinedCode],
    queryFn: () => getRoom(joinedCode!),
    enabled: !!joinedCode,
    refetchInterval: query => {
      const status = query.state.data?.status
      return status === 'finished' ? false : 3000
    },
  })

  const room = roomLive ?? joinedRoomSnapshot

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim() || !name.trim()) {
      setError('Preencha o código da sala e o seu nome.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const roomResponse = await joinRoom(code.trim(), name.trim())
      setJoinedRoomSnapshot(roomResponse)
      setJoinedRoomCode(roomResponse.code)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg ?? 'Sala não encontrada. Verifique o código e tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const goToRoomGame = () => {
    if (!room?.selected_game_id) return
    const params = new URLSearchParams({
      mode: 'sala_codigo',
      room_code: room.code,
      room_id: room.id,
      room_name: room.name,
      origin: 'room',
    })
    if (room.grade) params.set('grade', String(room.grade))
    if (room.subject) params.set('subject', room.subject)
    navigate(`/jogar/${room.selected_game_id}?${params.toString()}`)
  }

  if (room) {
    const canPlayNow = room.status === 'active' && !!room.selected_game_id
    return (
      <div className="page join-room-page">
        <div className="join-card card">
          <div className="join-icon">{canPlayNow ? '🎮' : '⏳'}</div>
          <h2 className="join-title">{room.name}</h2>
          <p className="join-subtitle">Sala {room.code}</p>
          <div className="room-info-list">
            <p><strong>Status:</strong> {STATUS_LABEL[room.status] ?? room.status}</p>
            <p><strong>Ano:</strong> {room.grade ? `${room.grade}º ano` : 'Todos'}</p>
            <p><strong>Disciplina:</strong> {room.subject ?? 'Todas'}</p>
            <p><strong>Jogadores conectados:</strong> {room.players.length}</p>
            <p><strong>Jogo:</strong> {room.selected_game_id ?? 'Ainda não selecionado'}</p>
          </div>

          {canPlayNow ? (
            <button className="btn btn-primary btn-lg join-btn" onClick={goToRoomGame}>
              ▶ Entrar no jogo da sala
            </button>
          ) : (
            <div className="waiting-box">
              {room.status === 'finished'
                ? 'A atividade desta sala já foi encerrada.'
                : 'Você já entrou na sala. Aguarde o professor iniciar a atividade.'}
            </div>
          )}

          <button onClick={() => navigate('/')} className="btn btn-outline btn-sm back-btn">
            ← Voltar ao Início
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page join-room-page">
      <div className="join-card card">
        <div className="join-icon">🚪</div>
        <h2 className="join-title">Entrar em uma Sala</h2>
        <p className="join-subtitle">
          Digite o código que o professor está exibindo na tela.
        </p>

        <form className="join-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="code" className="form-label">Código da Sala</label>
            <input
              id="code"
              type="text"
              className="input code-input"
              placeholder="Ex: 482931"
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              autoFocus
            />
          </div>
          <div className="form-group">
            <label htmlFor="name" className="form-label">Seu Nome ou Apelido</label>
            <input
              id="name"
              type="text"
              className="input"
              placeholder="Ex: Maria"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={40}
            />
          </div>

          {error && <p className="join-error">{error}</p>}

          <button type="submit" className="btn btn-primary btn-lg join-btn" disabled={loading}>
            {loading ? '⏳ Entrando...' : '▶ Entrar na Sala'}
          </button>
        </form>

        <button onClick={() => navigate('/')} className="btn btn-outline btn-sm back-btn">
          ← Voltar ao Início
        </button>
      </div>
    </div>
  )
}
