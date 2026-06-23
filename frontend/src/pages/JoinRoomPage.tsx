import { FormEvent, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { joinRoom } from '../api/rooms'

export function JoinRoomPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const initialRoomCode = useMemo(() => searchParams.get('room') ?? '', [searchParams])
  const [roomCode, setRoomCode] = useState(initialRoomCode)
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const result = await joinRoom(roomCode.trim().toUpperCase(), {
        display_name: displayName.trim() || undefined,
      })
      setMessage(result.message)
      navigate(result.runner_url)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '32px 16px' }}>
      <h1 style={{ marginTop: 0 }}>Entrar na sala</h1>
      <p style={{ color: '#64748b', marginBottom: 24 }}>
        Informe o código da sala e, se quiser, um nome/apelido para o professor acompanhar seu progresso.
      </p>

      <form
        onSubmit={handleSubmit}
        style={{
          display: 'grid',
          gap: 12,
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: 20,
          background: '#fff',
        }}
      >
        <label style={{ display: 'grid', gap: 6 }}>
          <span>Código da sala</span>
          <input
            value={roomCode}
            onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
            placeholder="Ex.: AB12CD"
            required
            style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
          />
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span>Nome ou apelido (opcional)</span>
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Ex.: Ana"
            style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            border: 'none',
            background: '#2563eb',
            color: '#fff',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          {loading ? 'Entrando…' : 'Entrar e abrir atividade'}
        </button>

        {message && <p style={{ margin: 0, color: '#166534' }}>{message}</p>}
        {error && <p style={{ margin: 0, color: '#dc2626' }}>Erro: {error}</p>}
      </form>
    </div>
  )
}
