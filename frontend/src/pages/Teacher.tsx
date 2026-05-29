import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createRoom } from '../services/api'
import './Teacher.css'

export default function Teacher() {
  const navigate = useNavigate()
  const [gameId, setGameId]   = useState('quiz_multipla_escolha')
  const [roomCode, setRoomCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const handleCreate = async () => {
    setLoading(true)
    setError('')
    try {
      const room = await createRoom(gameId)
      setRoomCode(room.code)
    } catch {
      setError('Não foi possível criar a sala. Verifique a conexão com o servidor.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page teacher-page">
      <h2 className="page-title">👨‍🏫 Painel do Professor</h2>
      <p className="page-subtitle">
        Crie uma sala, projete o código e acompanhe os alunos em tempo real.
      </p>

      <div className="teacher-grid">
        {/* Create room panel */}
        <div className="card teacher-card">
          <h3 className="card-heading">🚀 Criar Nova Sala</h3>
          <div className="form-group">
            <label className="form-label" htmlFor="game-select">Jogo</label>
            <select
              id="game-select"
              className="input"
              value={gameId}
              onChange={e => setGameId(e.target.value)}
            >
              <option value="quiz_multipla_escolha">Quiz de Múltipla Escolha</option>
              <option value="arrastar_soltar">Arrastar e Soltar</option>
              <option value="desafio_contas">Desafio de Contas</option>
            </select>
          </div>
          {error && <p className="teacher-error">{error}</p>}
          <button
            className="btn btn-primary btn-lg"
            onClick={handleCreate}
            disabled={loading}
          >
            {loading ? '⏳ Criando...' : '▶ Criar Sala'}
          </button>

          {roomCode && (
            <div className="room-code-display">
              <p className="room-code-label">Código da Sala</p>
              <div className="room-code-value">{roomCode}</div>
              <p className="room-code-hint">Projete este código para os alunos acessarem</p>
            </div>
          )}
        </div>

        {/* Live dashboard placeholder */}
        <div className="card teacher-card">
          <h3 className="card-heading">📊 Acompanhamento em Tempo Real</h3>
          <div className="placeholder-area">
            <span className="placeholder-icon">🔴</span>
            <p><strong>PLACEHOLDER</strong></p>
            <p>
              O painel ao vivo com lista de alunos conectados, progresso,
              pontuação e ranking em tempo real será implementado via WebSocket
              em versão futura.
            </p>
          </div>
        </div>

        {/* PDF import placeholder */}
        <div className="card teacher-card">
          <h3 className="card-heading">📄 Importar Lista de Alunos (PDF)</h3>
          <div className="placeholder-area">
            <span className="placeholder-icon">🔶</span>
            <p><strong>PLACEHOLDER</strong></p>
            <p>
              Importação da lista de alunos via PDF (modelo Secretaria de Itajaí)
              será habilitada em versão futura. O serviço de backend já está
              preparado em <code>services/pdf_import_service.py</code>.
            </p>
          </div>
          <label className="btn btn-outline btn-sm" style={{ cursor: 'not-allowed', opacity: 0.5 }}>
            📤 Selecionar PDF (em breve)
          </label>
        </div>
      </div>

      <button onClick={() => navigate('/')} className="btn btn-outline btn-sm" style={{ marginTop: '1.5rem' }}>
        ← Voltar ao Início
      </button>
    </div>
  )
}
