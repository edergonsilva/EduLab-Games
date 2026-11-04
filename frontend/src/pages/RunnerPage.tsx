import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { createActivityEvent, getRunnerContext, type RunnerContext } from '../api/rooms'
import { Badge, Card, Mascot } from '../components/ui'
import { userErrorMessage } from '../api/errors'

export function RunnerPage() {
  const [searchParams] = useSearchParams()
  const participantId = useMemo(() => Number(searchParams.get('participant_id') ?? ''), [searchParams])
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const [context, setContext] = useState<RunnerContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [participantStatus, setParticipantStatus] = useState<string>('joined')
  const [participantScore, setParticipantScore] = useState<number | null>(null)
  const gameUrl = useMemo(() => {
    if (!context) return ''
    const url = new URL(context.game.entry_url, window.location.origin)
    const accessToken = searchParams.get('access_token')
    if (accessToken) url.searchParams.set('access_token', accessToken)
    return url.toString()
  }, [context, searchParams])

  useEffect(() => {
    if (!Number.isFinite(participantId) || participantId <= 0) {
      setError('participant_id inválido.')
      setLoading(false)
      return
    }

    let cancelled = false
    async function loadContext() {
      setLoading(true)
      setError(null)
      try {
        const result = await getRunnerContext(participantId)
        if (cancelled) return
        setContext(result)
        setParticipantStatus(result.participant.status)
        setParticipantScore(result.participant.last_score ?? null)
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
  }, [participantId])

  useEffect(() => {
    if (!context) return
    const runnerContext = context

    function handleMessage(event: MessageEvent) {
      if (event.source !== iframeRef.current?.contentWindow) return
      if (!event.data || typeof event.data !== 'object') return

      const payload = event.data as Record<string, unknown>
      if (payload.type === 'platform_ready' || payload.type === 'game_loaded') {
        void persistEvent(runnerContext, { event_type: 'game_loaded', payload })
        return
      }

      if (payload.type === 'activity_event' || payload.type === 'edulab.activity.event') {
        void persistEvent(runnerContext, {
          event_type: String(payload.event_type ?? 'progress'),
          score: typeof payload.score === 'number' ? payload.score : undefined,
          status: typeof payload.status === 'string' ? payload.status : undefined,
          payload,
        })
        return
      }

      if (payload.type === 'activity_result' || payload.type === 'edulab.activity.result') {
        void persistEvent(runnerContext, {
          event_type: 'result',
          score: typeof payload.score === 'number' ? payload.score : undefined,
          status: 'finished',
          payload,
        })
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [context])

  async function persistEvent(
    runnerContext: RunnerContext,
    payload: {
      event_type: string
      score?: number
      status?: string
      payload?: Record<string, unknown>
    },
  ) {
    const response = await createActivityEvent(runnerContext.activity.id, {
      participant_id: runnerContext.participant.id,
      display_name: runnerContext.participant.display_name,
      ...payload,
    })

    if (response.status) {
      setParticipantStatus(response.status)
    }
    if (typeof response.score === 'number') {
      setParticipantScore(response.score)
    }
  }

  function postPlatformContext() {
    if (!context || !iframeRef.current?.contentWindow) return
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
    }

    iframeRef.current.contentWindow.postMessage(platformContext, '*')
    window.setTimeout(() => iframeRef.current?.contentWindow?.postMessage(platformContext, '*'), 500)
  }

  if (loading) {
    return <main className="grid min-h-screen place-items-center bg-canvas p-6 text-sm text-muted">Carregando atividade…</main>
  }

  if (error || !context) {
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
        <iframe
          ref={iframeRef}
          src={gameUrl}
          title={context.game.title}
          onLoad={postPlatformContext}
          className="block h-[65vh] w-full border-0 bg-white lg:h-screen"
        />
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
            <Badge tone={participantStatus === 'finished' ? 'brand' : 'accent'}>{participantStatus}</Badge>
          </div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted">Última pontuação</span>
            <strong className="font-display text-xl tabular-nums text-ink">{participantScore ?? '—'}</strong>
          </div>
        </Card>

        <Link className="text-sm font-semibold text-brand no-underline hover:underline" to="/">Voltar ao início</Link>
      </aside>
    </main>
  )
}
