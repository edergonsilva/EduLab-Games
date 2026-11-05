import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { createActivityEvent, getRunnerContext, type RunnerContext } from '../api/rooms'
import { Badge, Card, Mascot } from '../components/ui'
import { userErrorMessage } from '../api/errors'
import { getRoomLobby } from '../api/rooms'
import { subscribeToRooms } from '../api/realtime'

export function RunnerPage() {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const sessionNonce = useMemo(() => crypto.randomUUID(), [])
  const [context, setContext] = useState<RunnerContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [participantStatus, setParticipantStatus] = useState<string>('waiting')
  const [participantScore, setParticipantScore] = useState<number | null>(null)
  const [participantProgress, setParticipantProgress] = useState<{ current: number; total: number } | null>(null)
  const [roomFinished, setRoomFinished] = useState(false)
  const [communicationError, setCommunicationError] = useState<string | null>(null)
  const isFinished = participantStatus === 'completed'
  const gameUrl = useMemo(() => {
    if (!context || !context.game) return ''
    const url = new URL(context.game.entry_url, window.location.origin)
    return url.toString()
  }, [context])
  const gameOrigin = useMemo(
    () => context?.game ? new URL(context.game.entry_url, window.location.origin).origin : '',
    [context],
  )

  useEffect(() => {
    let cancelled = false
    async function loadContext() {
      setLoading(true)
      setError(null)
      try {
        const result = await getRunnerContext()
        if (cancelled) return
        if (!result.game) {
          throw new Error('Jogo da atividade não encontrado.')
        }
        setContext(result)
        setParticipantStatus(result.participant.status)
        setParticipantScore(result.participant.last_score ?? null)
        if (result.participant.progress_current !== null && result.participant.progress_total) {
          setParticipantProgress({
            current: result.participant.progress_current ?? 0,
            total: result.participant.progress_total,
          })
        }
        await persistEvent(result, { event_type: 'runner_opened' })
      } catch (err) {
        if (!cancelled) {
          setError(userErrorMessage(err, 'Não foi possível abrir a atividade.'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadContext()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!context) return
    const roomCode = context.room.code

    async function reloadRoomState() {
      try {
        const state = await getRoomLobby(roomCode)
        if (state.room.status === 'finished') setRoomFinished(true)
      } catch (err) {
        setCommunicationError(userErrorMessage(err, 'Não foi possível atualizar o estado da sala.'))
      }
    }

    const unsubscribe = subscribeToRooms(
      [roomCode],
      (eventName, payload) => {
        if (eventName !== 'activity.finished') return
        const event = payload as { room_code?: string }
        if (event.room_code === roomCode) {
          setRoomFinished(true)
          iframeRef.current?.contentWindow?.postMessage({
            namespace: 'edulab.sdk',
            type: 'activity.finish',
            session: { roomId: context.room.id, participantId: context.participant.id, nonce: sessionNonce },
          }, gameOrigin)
        }
      },
      () => void reloadRoomState(),
    )
    const interval = window.setInterval(() => void reloadRoomState(), 15000)
    return () => {
      unsubscribe()
      window.clearInterval(interval)
    }
  }, [context, gameOrigin, sessionNonce])

  useEffect(() => {
    if (!context) return
    const runnerContext = context

    function handleMessage(event: MessageEvent) {
      if (event.source !== iframeRef.current?.contentWindow || event.origin !== gameOrigin) return
      if (!event.data || typeof event.data !== 'object') return

      const payload = event.data as Record<string, unknown>
      if (payload.namespace === 'edulab.sdk') {
        const messageSession = payload.session as Record<string, unknown> | undefined
        if (
          messageSession?.nonce !== sessionNonce
          || messageSession.roomId !== runnerContext.room.id
          || messageSession.participantId !== runnerContext.participant.id
          || roomFinished
        ) return
        const body = payload.payload && typeof payload.payload === 'object'
          ? payload.payload as Record<string, unknown>
          : {}
        if (payload.type === 'score') {
          void persistEvent(runnerContext, {
            event_type: 'score',
            score: typeof body.score === 'number' ? body.score : undefined,
            payload: body,
          })
        } else if (payload.type === 'progress') {
          const progress = body.progress && typeof body.progress === 'object'
            ? body.progress as Record<string, unknown>
            : body
          void persistEvent(runnerContext, {
            event_type: 'progress',
            score: typeof body.score === 'number' ? body.score : undefined,
            progress: typeof progress.current === 'number' && typeof progress.total === 'number'
              ? { current: progress.current, total: progress.total }
              : undefined,
            payload: body,
          })
        } else if (payload.type === 'completed') {
          void persistEvent(runnerContext, {
            event_type: 'completed',
            score: typeof body.score === 'number' ? body.score : undefined,
            payload: body,
          })
        } else if (payload.type === 'error') {
          void persistEvent(runnerContext, { event_type: 'error', payload: body })
        }
        return
      }

      if (roomFinished) return
      if (payload.type === 'platform_ready' || payload.type === 'game_loaded') {
        void persistEvent(runnerContext, { event_type: 'game_loaded', payload })
        return
      }

      if (payload.type === 'activity_event' || payload.type === 'edulab.activity.event') {
        void persistEvent(runnerContext, {
          event_type: String(payload.event_type ?? 'progress'),
          score: typeof payload.score === 'number' ? payload.score : undefined,
          progress: payload.progress && typeof payload.progress === 'object'
            ? payload.progress as { current: number; total: number }
            : undefined,
          payload,
        })
        return
      }

      if (payload.type === 'activity_result' || payload.type === 'edulab.activity.result') {
        void persistEvent(runnerContext, {
          event_type: 'completed',
          score: typeof payload.score === 'number' ? payload.score : undefined,
          payload,
        })
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [context, gameOrigin, roomFinished, sessionNonce])

  async function persistEvent(
    runnerContext: RunnerContext,
    payload: {
      event_type: string
      score?: number
      progress?: { current: number; total: number }
      payload?: Record<string, unknown>
    },
  ) {
    try {
      const response = await createActivityEvent(runnerContext.activity.id, payload)

      if (response.status) setParticipantStatus(response.status)
      if (typeof response.score === 'number') setParticipantScore(response.score)
      if (payload.progress) setParticipantProgress(payload.progress)
    } catch (err) {
      setCommunicationError(userErrorMessage(err, 'Não foi possível registrar o evento do jogo.'))
    }
  }

  function postPlatformContext() {
    if (!context || !context.game || !iframeRef.current?.contentWindow) return
    const platformContext = {
      type: 'platform_context',
      schema_version: context.schema_version,
      participant: {
        id: context.participant.id,
        display_name: context.participant.display_name,
        source: context.participant.source,
      },
      activity: {
        id: context.activity.id,
        status: context.activity.status,
        origin: 'room',
      },
      game: {
        slug: context.game.slug,
        title: context.game.title,
        version: context.game.version,
      },
      context: context.context,
      session: {
        roomId: context.room.id,
        participantId: context.participant.id,
        nonce: sessionNonce,
      },
    }

    const sdkInit = {
      namespace: 'edulab.sdk',
      type: 'init',
      payload: platformContext,
      session: platformContext.session,
    }
    iframeRef.current.contentWindow.postMessage(platformContext, gameOrigin)
    iframeRef.current.contentWindow.postMessage(sdkInit, gameOrigin)
    window.setTimeout(() => {
      iframeRef.current?.contentWindow?.postMessage(platformContext, gameOrigin)
      iframeRef.current?.contentWindow?.postMessage(sdkInit, gameOrigin)
    }, 500)
  }

  if (loading) {
    return <main className="grid min-h-screen place-items-center bg-canvas p-6 text-sm text-muted">Carregando atividade…</main>
  }

  if (error || !context || !context.game) {
    return (
      <main className="mx-auto grid min-h-screen max-w-xl content-center gap-4 bg-canvas p-6">
        <Card role="alert" className="border-red-200 bg-red-50 p-4 text-sm text-danger">Erro: {error ?? 'Contexto da atividade não encontrado.'}</Card>
        <Link className="text-sm font-semibold text-brand no-underline hover:underline" to="/join">Voltar para entrada</Link>
      </main>
    )
  }

  return (
    <main className="grid min-h-screen grid-cols-1 bg-ink lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-h-[65vh] bg-ink lg:min-h-screen">
        {roomFinished ? (
          <div className="grid min-h-[65vh] place-items-center bg-canvas p-6 text-center lg:min-h-screen">
            <div>
              <h2 className="font-display text-2xl font-semibold text-ink">Atividade encerrada</h2>
              <p className="mt-2 text-sm text-muted">O professor encerrou esta sala. Seus resultados foram mantidos.</p>
            </div>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            src={gameUrl}
            title={context.game.title}
            onLoad={postPlatformContext}
            sandbox="allow-scripts allow-same-origin allow-forms allow-pointer-lock"
            className="block h-[65vh] w-full border-0 bg-white lg:h-screen"
          />
        )}
      </div>

      <aside className="grid content-start gap-5 border-t border-line bg-white p-5 lg:border-l lg:border-t-0 lg:p-6">
        <div>
          <p className="mb-2 text-xs font-bold uppercase text-brand">Atividade em andamento</p>
          <div className="flex items-center justify-between gap-3">
            <h1 className="font-display text-xl font-semibold text-ink">{context.game.title}</h1>
            <Mascot className="h-14 w-11" />
          </div>
          <p className="mt-2 text-sm text-muted">
            Sala <strong className="font-mono text-ink">{context.room.code}</strong> · {context.participant.display_name}
          </p>
        </div>

        <Card className="grid gap-3 p-4">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted">Seu status</span>
            <Badge tone={isFinished || roomFinished ? 'brand' : 'accent'}>{roomFinished ? 'Sala encerrada' : participantStatus}</Badge>
          </div>
          {participantProgress && (
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted">Progresso</span>
              <strong className="tabular-nums text-ink">{participantProgress.current}/{participantProgress.total}</strong>
            </div>
          )}
          {communicationError && <p role="alert" className="m-0 text-xs text-danger">{communicationError}</p>}
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted">Última pontuação</span>
            <strong className="font-display text-xl tabular-nums text-ink">{participantScore ?? '—'}</strong>
          </div>
          {isFinished && (
            <div className="rounded-md border border-brand/30 bg-brand-pale p-3 text-sm text-brand-dark">
              Atividade concluída. Aguarde o professor para ver o resultado final da sala.
            </div>
          )}
        </Card>

        <Link className="text-sm font-semibold text-brand no-underline hover:underline" to="/">Voltar ao início</Link>
      </aside>
    </main>
  )
}
