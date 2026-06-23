import { useState } from 'react'
import type { Game } from '../api/games'
import { deleteGame } from '../api/games'

interface Props {
  games: Game[]
  onDelete: (slug: string) => void
}

export function GameCatalog({ games, onDelete }: Props) {
  const [deleting, setDeleting] = useState<string | null>(null)

  async function handleDelete(slug: string) {
    if (!confirm(`Remover o jogo "${slug}" e todos os seus artefatos?`)) return
    setDeleting(slug)
    try {
      await deleteGame(slug)
      onDelete(slug)
    } catch {
      alert('Erro ao remover o jogo.')
    } finally {
      setDeleting(null)
    }
  }

  if (games.length === 0) {
    return (
      <p style={{ color: '#64748b', textAlign: 'center', padding: 32 }}>
        Nenhum jogo importado ainda. Use o painel acima para importar um pacote <code>.edugame</code>.
      </p>
    )
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 16,
      }}
    >
      {games.map((game) => (
        <div
          key={game.slug}
          style={{
            border: '1px solid #e2e8f0',
            borderRadius: 10,
            padding: 16,
            background: '#fff',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          }}
        >
          {game.thumbnail && (
            <img
              src={game.thumbnail}
              alt={game.title}
              style={{ width: '100%', borderRadius: 6, marginBottom: 10, objectFit: 'cover', height: 120 }}
            />
          )}
          <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>{game.title}</h3>
          <span
            style={{
              display: 'inline-block',
              fontSize: 11,
              color: '#6366f1',
              background: '#eef2ff',
              borderRadius: 4,
              padding: '1px 7px',
              marginBottom: 8,
            }}
          >
            v{game.version}
          </span>
          {game.description && (
            <p style={{ fontSize: 13, color: '#475569', margin: '0 0 12px' }}>{game.description}</p>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <a
              href={game.entry_url}
              target="_blank"
              rel="noreferrer"
              style={{
                flex: 1,
                textAlign: 'center',
                padding: '6px 0',
                background: '#6366f1',
                color: '#fff',
                borderRadius: 6,
                textDecoration: 'none',
                fontSize: 13,
              }}
            >
              ▶ Jogar
            </a>
            <button
              onClick={() => handleDelete(game.slug)}
              disabled={deleting === game.slug}
              style={{
                padding: '6px 10px',
                background: '#fee2e2',
                color: '#dc2626',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              {deleting === game.slug ? '…' : '🗑'}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
