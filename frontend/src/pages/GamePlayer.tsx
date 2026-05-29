import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getGame, type Game } from '../services/api'
import './GamePlayer.css'

type GameEvent =
  | { type: 'game_started'; gameId?: string }
  | { type: 'question_answered'; correct: boolean; score: number; question?: number }
  | { type: 'score_updated'; score: number }
  | { type: 'game_finished'; score: number; [key: string]: unknown }
  | { type: 'ready'; [key: string]: unknown }
  | { type: 'request_state'; [key: string]: unknown }
  | { type: 'pause'; reason?: string; [key: string]: unknown }

type PlatformContext = {
  mode: string
  room_code?: string
  room_id?: string
  room_name?: string
  grade?: number
  subject?: string
  origin: string
}

const parseOptionalNumber = (value: string | null): number | undefined => {
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isNaN(parsed) ? undefined : parsed
}

export default function GamePlayer() {
  const { gameId } = useParams<{ gameId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [iframeLoaded, setIframeLoaded] = useState(false)
  const [iframeError, setIframeError] = useState(false)
  const [events, setEvents] = useState<GameEvent[]>([])
  const [score, setScore] = useState<number | null>(null)
  const [gameStarted, setGameStarted] = useState(false)
  const [gameFinished, setGameFinished] = useState(false)
  const [gameReady, setGameReady] = useState(false)

  const context = useMemo<PlatformContext>(() => {
    return {
      mode: searchParams.get('mode') ?? 'solo',
      room_code: searchParams.get('room_code') ?? undefined,
      room_id: searchParams.get('room_id') ?? undefined,
      room_name: searchParams.get('room_name') ?? undefined,
      grade: parseOptionalNumber(searchParams.get('grade')),
      subject: searchParams.get('subject') ?? undefined,
      origin: searchParams.get('origin') ?? 'catalog',
    }
  }, [searchParams])

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

      let normalizedType = msg.type
      if (msg.type === 'edulab_event' && typeof msg.event === 'string') {
        normalizedType = msg.event
      }

      const normalizedMessage = { ...msg, type: normalizedType }

      const gameEvent = normalizedMessage as unknown as GameEvent

      switch (normalizedType) {
        case 'ready':
          setGameReady(true)
          if (iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage(
              { type: 'platform_state', score, started: gameStarted, finished: gameFinished },
              window.location.origin,
            )
          }
          break
        case 'request_state':
          if (iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage(
              { type: 'platform_state', score, started: gameStarted, finished: gameFinished },
              window.location.origin,
            )
          }
          break
        case 'pause':
          console.info('[EduLab Runner] pause requested by game', normalizedMessage)
          break
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
      console.info('[EduLab Runner] game event:', normalizedType, normalizedMessage)
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [gameFinished, gameStarted, score])

  // Send initial context to the game once iframe loads
  function handleIframeLoad() {
    setIframeLoaded(true)
    setIframeError(false)
    setGameReady(false)
    if (iframeRef.current?.contentWindow && game) {
      iframeRef.current.contentWindow.postMessage(
        {
          type: 'platform_context',
          schema_version: '1.1',
          game: {
            id: game.id,
            name: game.name,
            subject: game.subject,
            grades: game.school_grades,
          },
          context,
        },
        window.location.origin,
      )
      console.info('[EduLab Runner] context sent to game', { gameId: game.id, context })
    }
  }

  function handleIframeError() {
    setIframeLoaded(false)
    setIframeError(true)
  }

  const roomChip = context.room_code ? `Sala ${context.room_code}` : null

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
          {roomChip && (
            <span className="player-room-badge">{roomChip}</span>
          )}
          <span className="player-origin-badge">origem: {context.origin}</span>
          {gameReady && (
            <span className="player-status-badge player-status-ready">✅ Pronto</span>
          )}
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
