import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { joinRoom } from '../services/api'
import './JoinRoom.css'

export default function JoinRoom() {
  const navigate = useNavigate()
  const [code, setCode]       = useState('')
  const [name, setName]       = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim() || !name.trim()) {
      setError('Preencha o código da sala e o seu nome.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await joinRoom(code.trim(), name.trim())
      // TODO: redirecionar para a tela do jogo com o contexto da sala
      alert(`✅ Você entrou na sala ${code}! Em breve o jogo começará.`)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg ?? 'Sala não encontrada. Verifique o código e tente novamente.')
    } finally {
      setLoading(false)
    }
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
