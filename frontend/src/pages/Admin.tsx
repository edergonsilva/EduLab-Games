import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import {
  adminLogin,
  getAdminGames,
  setAdminGameStatus,
  uploadEdugame,
  type Game,
} from '../services/api'
import './Admin.css'

type Feedback = {
  tone: 'success' | 'error'
  text: string
}

function getApiMessage(error: unknown, fallback: string) {
  const axiosError = error as AxiosError<{ detail?: string }>
  return axiosError.response?.data?.detail ?? fallback
}

function statusBadgeClass(status: string) {
  if (status === 'published') return 'badge-green'
  if (status === 'test') return 'badge-yellow'
  return 'badge-orange'
}

export default function Admin() {
  const queryClient = useQueryClient()
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [brokenThumbs, setBrokenThumbs] = useState<Record<string, boolean>>({})

  const { data: games = [], isLoading: loadingGames } = useQuery<Game[]>({
    queryKey: ['admin-games'],
    queryFn: () => getAdminGames(),
    enabled: authed,
  })

  const importMutation = useMutation({
    mutationFn: uploadEdugame,
    onSuccess: result => {
      setFeedback({ tone: 'success', text: result.message })
      setSelectedFile(null)
      void queryClient.invalidateQueries({ queryKey: ['admin-games'] })
    },
    onError: err => {
      setFeedback({ tone: 'error', text: getApiMessage(err, 'Não foi possível importar o pacote .edugame.') })
    },
  })

  const publishMutation = useMutation({
    mutationFn: ({ gameId, version, status }: { gameId: string; version: string; status: 'test' | 'published' | 'archived' }) =>
      setAdminGameStatus(gameId, version, status),
    onSuccess: game => {
      setFeedback({ tone: 'success', text: `Status de ${game.name} alterado para ${game.status}.` })
      void queryClient.invalidateQueries({ queryKey: ['admin-games'] })
    },
    onError: err => {
      setFeedback({ tone: 'error', text: getApiMessage(err, 'Não foi possível atualizar o status do jogo.') })
    },
  })

  const summary = useMemo(() => ({
    total: games.length,
    imported: games.filter(game => game.source === 'imported').length,
    published: games.filter(game => game.status === 'published').length,
    test: games.filter(game => game.status === 'test').length,
  }), [games])

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

  const handleImport = () => {
    if (!selectedFile) {
      setFeedback({ tone: 'error', text: 'Selecione um arquivo .edugame para importar.' })
      return
    }
    importMutation.mutate(selectedFile)
  }

  if (authed) {
    return (
      <div className="page admin-page">
        <h2 className="page-title">⚙️ Painel Administrativo</h2>
        <p className="page-subtitle">Importe jogos, acompanhe o catálogo persistido e publique versões testadas.</p>

        <div className="admin-summary-grid">
          <div className="card admin-summary-card"><strong>{summary.total}</strong><span>Jogos no total</span></div>
          <div className="card admin-summary-card"><strong>{summary.imported}</strong><span>Importados</span></div>
          <div className="card admin-summary-card"><strong>{summary.test}</strong><span>Em teste</span></div>
          <div className="card admin-summary-card"><strong>{summary.published}</strong><span>Publicados</span></div>
        </div>

        <div className="admin-grid">
          <div className="card admin-card">
            <h3 className="card-heading">📦 Importar Jogo (.edugame)</h3>
            <p className="admin-muted">
              O pacote é validado, salvo localmente e registrado no banco SQLite com status inicial <strong>test</strong>.
            </p>
            <label className="admin-upload-field">
              <span>{selectedFile ? selectedFile.name : 'Selecione um arquivo .edugame'}</span>
              <input
                type="file"
                accept=".edugame"
                onChange={event => {
                  setFeedback(null)
                  setSelectedFile(event.target.files?.[0] ?? null)
                }}
              />
            </label>
            <button className="btn btn-primary btn-sm" onClick={handleImport} disabled={importMutation.isPending}>
              {importMutation.isPending ? '⏳ Importando...' : '📤 Importar pacote'}
            </button>
            {feedback && <div className={`admin-feedback admin-feedback-${feedback.tone}`}>{feedback.text}</div>}
          </div>

          <div className="card admin-card admin-games-card">
            <h3 className="card-heading">🎮 Jogos disponíveis/importados</h3>
            {loadingGames ? (
              <div className="placeholder-area">⏳ Carregando jogos...</div>
            ) : games.length === 0 ? (
              <div className="placeholder-area">Nenhum jogo encontrado.</div>
            ) : (
              <div className="admin-games-list">
                {games.map(game => {
                  const cardKey = `${game.source}-${game.id}-${game.version}`
                  const showImage = game.thumbnail && !brokenThumbs[cardKey]

                  return (
                    <div key={cardKey} className="admin-game-item">
                      <div className="admin-game-thumb">
                        {showImage ? (
                          <img
                            src={game.thumbnail ?? undefined}
                            alt={game.name}
                            onError={() => setBrokenThumbs(current => ({ ...current, [cardKey]: true }))}
                          />
                        ) : (
                          <span>🎮</span>
                        )}
                      </div>
                      <div className="admin-game-main">
                        <div className="admin-game-header">
                          <div>
                            <strong>{game.name}</strong>
                            <div className="admin-game-meta">{game.id} · v{game.version}</div>
                          </div>
                          <div className="admin-game-badges">
                            <span className={`badge ${statusBadgeClass(game.status)}`}>{game.status}</span>
                            <span className={`badge ${game.source === 'imported' ? 'badge-yellow' : 'badge-purple'}`}>
                              {game.source === 'imported' ? 'Importado' : 'Base'}
                            </span>
                          </div>
                        </div>
                        <p className="admin-game-description">{game.description ?? 'Sem descrição cadastrada.'}</p>
                        <div className="admin-game-details">
                          {game.subject && <span className="admin-game-tag">📚 {game.subject}</span>}
                          {game.school_grades.length > 0 && (
                            <span className="admin-game-tag">🎓 {game.school_grades.map(g => `${g}º`).join(', ')}</span>
                          )}
                          <span className="admin-game-tag">⏱ {game.estimated_duration_minutes} min</span>
                        </div>
                        <div className="admin-game-footer">
                          <small>Modos: {game.mode.join(', ')}</small>
                          <div className="admin-game-actions">
                            {game.play_url && (
                              <a
                                className="btn btn-outline btn-sm"
                                href={`/jogar/${game.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                ▶ Testar
                              </a>
                            )}
                            {game.source === 'imported' && game.status !== 'published' && (
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => publishMutation.mutate({ gameId: game.id, version: game.version, status: 'published' })}
                                disabled={publishMutation.isPending}
                              >
                                Publicar
                              </button>
                            )}
                            {game.source === 'imported' && game.status === 'published' && (
                              <button
                                className="btn btn-outline btn-sm"
                                onClick={() => publishMutation.mutate({ gameId: game.id, version: game.version, status: 'test' })}
                                disabled={publishMutation.isPending}
                              >
                                Despublicar
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <button
          className="btn btn-outline btn-sm"
          style={{ marginTop: '2rem' }}
          onClick={() => {
            setAuthed(false)
            setSelectedFile(null)
            setFeedback(null)
          }}
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
