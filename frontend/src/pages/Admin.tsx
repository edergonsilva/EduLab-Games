import { useState } from 'react'
import { adminLogin } from '../services/api'
import './Admin.css'

export default function Admin() {
  const [password, setPassword] = useState('')
  const [authed, setAuthed]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim()) return
    setLoading(true)
    setError('')
    try {
      await adminLogin(password)
      setAuthed(true)
    } catch {
      setError('Senha incorreta. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  if (authed) {
    return (
      <div className="page admin-page">
        <h2 className="page-title">⚙️ Painel Administrativo</h2>
        <p className="page-subtitle">Bem-vindo, Administrador!</p>

        <div className="admin-grid">
          <div className="card admin-card">
            <h3 className="card-heading">📦 Importar Jogo (.edugame)</h3>
            <div className="placeholder-area">
              <span className="placeholder-icon">🔶</span>
              <p><strong>PLACEHOLDER</strong></p>
              <p>
                Faça upload de um arquivo <code>.edugame</code> para importar
                um novo jogo. O sistema valida o manifesto e coloca o jogo em
                modo <strong>teste</strong> antes da publicação.
              </p>
            </div>
            <label className="btn btn-primary btn-sm" style={{ cursor: 'pointer' }}>
              📤 Selecionar Arquivo .edugame
              <input type="file" accept=".edugame" style={{ display: 'none' }} onChange={() =>
                alert('Envio de .edugame será integrado ao endpoint /api/import/edugame em versão futura.')
              } />
            </label>
          </div>

          <div className="card admin-card">
            <h3 className="card-heading">🎮 Gerenciar Jogos</h3>
            <div className="placeholder-area">
              <span className="placeholder-icon">🔴</span>
              <p><strong>PLACEHOLDER</strong></p>
              <p>
                Lista de jogos importados com ações de:
                teste → publicar, editar, arquivar.
              </p>
            </div>
          </div>

          <div className="card admin-card">
            <h3 className="card-heading">👥 Gerenciar Turmas</h3>
            <div className="placeholder-area">
              <span className="placeholder-icon">🔴</span>
              <p><strong>PLACEHOLDER</strong></p>
              <p>
                Importação e gerenciamento de turmas/alunos
                via PDF da Secretaria de Itajaí.
              </p>
            </div>
          </div>

          <div className="card admin-card">
            <h3 className="card-heading">📊 Relatórios</h3>
            <div className="placeholder-area">
              <span className="placeholder-icon">🔴</span>
              <p><strong>PLACEHOLDER</strong></p>
              <p>
                Resultados, participação e desempenho por
                turma, disciplina e jogo.
              </p>
            </div>
          </div>
        </div>

        <button
          className="btn btn-outline btn-sm"
          style={{ marginTop: '2rem' }}
          onClick={() => setAuthed(false)}
        >
          🔒 Sair
        </button>
      </div>
    )
  }

  return (
    <div className="page admin-login-page">
      <div className="card admin-login-card">
        <div className="admin-login-icon">⚙️</div>
        <h2 className="admin-login-title">Área Administrativa</h2>
        <p className="admin-login-subtitle">
          Digite a senha para acessar o painel de administração.
        </p>

        <form className="admin-form" onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="password" className="form-label">Senha</label>
            <input
              id="password"
              type="password"
              className="input"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
            />
          </div>

          {error && <p className="admin-error">{error}</p>}

          <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ width: '100%' }}>
            {loading ? '⏳ Verificando...' : '🔐 Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
