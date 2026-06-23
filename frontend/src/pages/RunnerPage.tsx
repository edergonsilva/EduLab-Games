import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { createActivityEvent, getRunnerContext, type RunnerContext } from '../api/rooms'

export function RunnerPage() {
  const [searchParams] = useSearchParams()
  const participantId = useMemo(() => Number(searchParams.get('participant_id') ?? ''), [searchParams])
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const [context, setContext] = useState<RunnerContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [score, setScore] = useState('')
  const [participantStatus, setParticipantStatus] = useState<string>('joined')
  const [participantScore, setParticipantScore] = useState<number | null>(null)

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
        await persistEvent(result, { event_type: 'runner_opened' }, false)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
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
        void persistEvent(runnerContext, { event_type: 'game_loaded', payload }, false)
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
    announce = true,
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
    if (announce) {
      setStatusMessage(`Evento "${response.event_type}" registrado.`)
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

  async function handleSaveScore() {
    if (!context) return
    const parsedScore = Number(score)
    if (!Number.isFinite(parsedScore)) {
      setStatusMessage('Informe uma pontuação numérica válida.')
      return
    }
    await persistEvent(context, {
      event_type: 'progress',
      score: parsedScore,
      status: 'active',
      payload: { source: 'runner-manual-controls' },
    })
  }

  async function handleFinish() {
    if (!context) return
    await persistEvent(context, {
      event_type: 'completed',
      score: participantScore ?? undefined,
      status: 'finished',
      payload: { source: 'runner-manual-controls' },
    })
  }

  if (loading) {
    return <div style={{ padding: 24 }}>Carregando atividade…</div>
  }

  if (error || !context) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: '#dc2626' }}>Erro: {error ?? 'Contexto da atividade não encontrado.'}</p>
        <Link to="/join">Voltar para entrada</Link>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', minHeight: '100vh' }}>
      <div style={{ background: '#0f172a' }}>
        <iframe
          ref={iframeRef}
          src={context.game.entry_url}
          title={context.game.title}
          onLoad={postPlatformContext}
          style={{ width: '100%', height: '100vh', border: 'none', background: '#fff' }}
        />
      </div>

      <aside
        style={{
          padding: 20,
          borderLeft: '1px solid #e2e8f0',
          background: '#fff',
          display: 'grid',
          alignContent: 'start',
          gap: 16,
        }}
      >
        <div>
          <strong>{context.game.title}</strong>
          <p style={{ margin: '6px 0 0', color: '#64748b' }}>
            Sala {context.room.code} • {context.participant.display_name}
          </p>
        </div>

        <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 14 }}>
          <div style={{ display: 'grid', gap: 6, fontSize: 14 }}>
            <span>Status do participante: <strong>{participantStatus}</strong></span>
            <span>Última pontuação: <strong>{participantScore ?? '—'}</strong></span>
            <span>Schema do contexto: <strong>{context.schema_version}</strong></span>
          </div>
        </div>

        <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, display: 'grid', gap: 10 }}>
          <strong>Controles manuais do MVP</strong>
          <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>
            Use estes controles para registrar progresso/resultado mesmo quando o jogo ainda não envia eventos via <code>postMessage</code>.
          </p>
          <input
            value={score}
            onChange={(event) => setScore(event.target.value)}
            type="number"
            placeholder="Pontuação"
            style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
          />
          <button
            onClick={handleSaveScore}
            style={{ padding: '10px 12px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff' }}
          >
            Registrar pontuação
          </button>
          <button
            onClick={handleFinish}
            style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #16a34a', background: '#f0fdf4', color: '#166534' }}
          >
            Marcar como concluído
          </button>
          <button
            onClick={postPlatformContext}
            style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff' }}
          >
            Reenviar platform_context ao jogo
          </button>
        </div>

        {statusMessage && <p style={{ margin: 0, color: '#166534' }}>{statusMessage}</p>}

        <Link to={`/join?room=${context.room.code}`}>Entrar novamente com outro participante</Link>
        <Link to="/">Voltar ao painel do professor</Link>
      </aside>
    </div>
  )
}
