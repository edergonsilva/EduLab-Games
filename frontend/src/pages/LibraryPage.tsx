import { useEffect, useState } from 'react'
import type { Game, ImportResult } from '../api/games'
import { listGames } from '../api/games'
import { GameCatalog } from '../components/GameCatalog'
import { GameImport } from '../components/GameImport'

export function LibraryPage() {
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadGames() {
    try {
      setGames(await listGames())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadGames()
  }, [])

  function handleImported(result: ImportResult) {
    setGames((prev) => {
      const without = prev.filter((g) => g.slug !== result.game.slug)
      return [result.game, ...without]
    })
  }

  function handleDeleted(slug: string) {
    setGames((prev) => prev.filter((g) => g.slug !== slug))
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>📚 EduLab Games</h1>
      <p style={{ color: '#64748b', marginBottom: 24 }}>
        Plataforma de jogos educacionais para laboratórios de informática
      </p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, marginBottom: 12 }}>Importar jogo</h2>
        <GameImport onImported={handleImported} />
      </section>

      <section>
        <h2 style={{ fontSize: 16, marginBottom: 12 }}>
          Biblioteca ({games.length} {games.length === 1 ? 'jogo' : 'jogos'})
        </h2>
        {loading && <p style={{ color: '#64748b' }}>Carregando…</p>}
        {error && <p style={{ color: '#dc2626' }}>Erro: {error}</p>}
        {!loading && !error && (
          <GameCatalog games={games} onDelete={handleDeleted} />
        )}
      </section>
    </div>
  )
}
