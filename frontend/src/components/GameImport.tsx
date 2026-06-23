import React, { useRef, useState } from 'react'
import type { ImportResult } from '../api/games'
import { importGame } from '../api/games'

interface Props {
  onImported: (result: ImportResult) => void
}

export function GameImport({ onImported }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)

  async function handleFile(file: File) {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await importGame(file)
      setResult(res)
      onImported(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      style={{
        border: '2px dashed #6366f1',
        borderRadius: 12,
        padding: 32,
        textAlign: 'center',
        background: '#f8fafc',
        cursor: 'pointer',
      }}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".edugame"
        style={{ display: 'none' }}
        onChange={handleChange}
      />
      {loading ? (
        <p style={{ color: '#6366f1' }}>⏳ Importando pacote…</p>
      ) : (
        <>
          <p style={{ fontSize: 16, marginBottom: 8 }}>
            📦 Clique ou arraste um arquivo <code>.edugame</code> aqui
          </p>
          <p style={{ color: '#64748b', fontSize: 13 }}>
            Se um jogo com o mesmo identificador já existir, os artefatos anteriores serão removidos
            antes da importação.
          </p>
        </>
      )}
      {error && (
        <p style={{ color: '#dc2626', marginTop: 12, fontWeight: 500 }}>❌ {error}</p>
      )}
      {result && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 8,
            background: result.replaced ? '#fef9c3' : '#dcfce7',
            color: result.replaced ? '#713f12' : '#14532d',
            textAlign: 'left',
          }}
        >
          <strong>{result.replaced ? '🔄 Substituído' : '✅ Importado'}:</strong>{' '}
          {result.game.title} v{result.game.version}
          <br />
          <small>{result.message}</small>
        </div>
      )}
    </div>
  )
}
