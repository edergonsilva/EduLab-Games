import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getGame, type Game } from '../services/api'
import './GamePlayer.css'

type GameEvent =
  | { type: 'game_started'; gameId?: string }
  | { type: 'question_answered'; correct: boolean; score: number; question?: number }
  | { type: 'score_updated'; score: number }
  | { type: 'game_finished'; score: number; [key: string]: unknown }

export default function GamePlayer() {
  const { gameId } = useParams<{ gameId: string }>()
  const navigate = useNavigate()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [iframeLoaded, setIframeLoaded] = useState(false)
  const [iframeError, setIframeError] = useState(false)
  const [events, setEvents] = useState<GameEvent[]>([])
  const [score, setScore] = useState<number | null>(null)
  const [gameStarted, setGameStarted] = useState(false)
  const [gameFinished, setGameFinished] = useState(false)

  const {
    data: game,
    isLoading,
    error,
  } = useQuery<Game>({
    queryKey: ['game', gameId],
    queryFn: () => getGame(gameId!),
    enabled: !!gameId,
    retry: false,
  })

  // Listen for postMessage events from the game iframe.
  // Games served from /static/ share the platform origin; sandboxed iframes
  // without allow-same-origin report an opaque ("null") origin — both are accepted.
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const allowedOrigins = [window.location.origin, 'null']
      if (!allowedOrigins.includes(event.origin)) return
      if (!event.data || typeof event.data !== 'object') return
      const msg = event.data as { type?: string; [key: string]: unknown }
      if (!msg.type) return

      const gameEvent = msg as unknown as GameEvent

      switch (msg.type) {
        case 'game_started':
          setGameStarted(true)
          setGameFinished(false)
          setScore(null)
          break
        case 'score_updated': {
          const s = typeof msg.score === 'number' ? msg.score : null
          if (s !== null) setScore(s)
          break
        }
        case 'game_finished': {
          const s = typeof msg.score === 'number' ? msg.score : null
          if (s !== null) setScore(s)
          setGameFinished(true)
          break
        }
      }

      setEvents(prev => [...prev.slice(-49), gameEvent])
      console.info('[EduLab Runner] game event:', msg.type, msg)
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // Send initial context to the game once iframe loads
  function handleIframeLoad() {
    setIframeLoaded(true)
    setIframeError(false)
    if (iframeRef.current?.contentWindow && game) {
      iframeRef.current.contentWindow.postMessage(
        {
          type: 'init',
          gameId: game.id,
          gameName: game.name,
          subject: game.subject,
          grades: game.school_grades,
        },
        window.location.origin,
      )
    }
  }

  function handleIframeError() {
    setIframeLoaded(false)
    setIframeError(true)
  }

  if (isLoading) {
    return (
      <div className="player-page">
        <div className="player-loading">
          <div className="player-spinner" />
          <p>Carregando jogo...</p>
        </div>
      </div>
    )
  }

  if (error || !game) {
    return (
      <div className="player-page">
        <div className="player-error card">
          <div className="player-error-icon">😔</div>
          <h2>Jogo não encontrado</h2>
          <p>Não foi possível localizar o jogo solicitado.</p>
          <button className="btn btn-primary" onClick={() => navigate(-1)}>
            ← Voltar
          </button>
        </div>
      </div>
    )
  }

  if (!game.play_url) {
    return (
      <div className="player-page">
        <div className="player-error card">
          <div className="player-error-icon">🚧</div>
          <h2>Jogo não disponível</h2>
          <p>
            <strong>{game.name}</strong> ainda não possui arquivos de execução configurados.
          </p>
          <p className="player-error-hint">
            {game.source === 'imported'
              ? 'Verifique se o pacote .edugame foi importado corretamente.'
              : 'O arquivo de jogo seed não foi encontrado no servidor.'}
          </p>
          <button className="btn btn-primary" onClick={() => navigate(-1)}>
            ← Voltar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="player-page">
      {/* Header bar */}
      <div className="player-header">
        <button className="player-back-btn" onClick={() => navigate(-1)}>
          ← Sair
        </button>
        <div className="player-title-group">
          <span className="player-game-name">{game.name}</span>
          <span className={`badge ${game.source === 'imported' ? 'badge-yellow' : 'badge-purple'}`}>
            {game.source === 'imported' ? 'Importado' : 'Base'}
          </span>
        </div>
        <div className="player-hud">
          {score !== null && (
            <span className="player-score-badge">⭐ {score} pts</span>
          )}
          {gameStarted && !gameFinished && (
            <span className="player-status-badge player-status-playing">▶ Jogando</span>
          )}
          {gameFinished && (
            <span className="player-status-badge player-status-finished">🏁 Finalizado</span>
          )}
        </div>
      </div>

      {/* Loading overlay shown while iframe is not ready */}
      {!iframeLoaded && !iframeError && (
        <div className="player-overlay">
          <div className="player-spinner" />
          <p>Iniciando {game.name}...</p>
        </div>
      )}

      {/* Error overlay */}
      {iframeError && (
        <div className="player-overlay player-overlay-error">
          <div className="player-error-icon">⚠️</div>
          <p>
            Não foi possível carregar o jogo.<br />
            <small>Verifique se o servidor está disponível.</small>
          </p>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              setIframeError(false)
              setIframeLoaded(false)
            }}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Game iframe */}
      {!iframeError && (
        <iframe
          ref={iframeRef}
          className="player-iframe"
          src={game.play_url}
          title={game.name}
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          allow="fullscreen"
          sandbox="allow-scripts allow-forms allow-popups"
        />
      )}

      {/* Event log (collapsed by default, useful for testing) */}
      {events.length > 0 && (
        <details className="player-event-log">
          <summary>🔍 Eventos do jogo ({events.length})</summary>
          <ul>
            {events.map((ev, i) => (
              <li key={i}>
                <code>{ev.type}</code>
                {ev.type === 'question_answered' && (
                  <span className={ev.correct ? 'ev-correct' : 'ev-wrong'}>
                    {' '}— {ev.correct ? '✅ acerto' : '❌ erro'} — score: {ev.score}
                  </span>
                )}
                {ev.type === 'score_updated' && (
                  <span> — ⭐ {ev.score}</span>
                )}
                {ev.type === 'game_finished' && (
                  <span> — 🏁 score final: {ev.score}</span>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
