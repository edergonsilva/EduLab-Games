import { FormEvent, useState } from 'react'
import type { Game, GameMetadataUpdate } from '../api/games'
import { deleteGame, updateGameMetadata } from '../api/games'
import { Badge, Button, Card, Field, Input, Modal, Textarea } from './ui'

interface Props {
  games: Game[]
  teacherId: number
  onDelete: (slug: string) => void
  onUpdate: (game: Game) => void
}

export function GameCatalog({ games, teacherId, onDelete, onUpdate }: Props) {
  const [deleting, setDeleting] = useState<string | null>(null)
  const [editingGame, setEditingGame] = useState<Game | null>(null)
  const [editValues, setEditValues] = useState<GameMetadataUpdate>({
    title: '', description: '', grade: '', subject: '', is_public: false,
  })
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  function startEditing(game: Game) {
    setEditingGame(game)
    setEditValues({
      title: game.title,
      description: game.description ?? '',
      grade: game.grade ?? '',
      subject: game.subject ?? '',
      is_public: game.is_public,
    })
    setEditError(null)
  }

  async function saveMetadata(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingGame) return
    setSaving(true)
    setEditError(null)
    try {
      const updatedGame = await updateGameMetadata(editingGame.slug, {
        ...editValues,
        title: editValues.title.trim(),
        description: editValues.description.trim(),
        grade: editValues.grade.trim(),
        subject: editValues.subject.trim(),
      })
      onUpdate(updatedGame)
      setEditingGame(null)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

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
      <p className="rounded-lg border border-dashed border-line bg-white px-6 py-10 text-center text-sm text-muted">
        Nenhum jogo importado ainda. Use o painel acima para importar um pacote <code>.edugame</code>.
      </p>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {games.map((game) => (
        <Card key={game.slug} className="flex flex-col overflow-hidden p-4">
          {game.thumbnail && (
            <img
              src={game.thumbnail}
              alt={game.title}
              className="mb-4 aspect-[16/7] w-full rounded-md bg-canvas object-cover"
            />
          )}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <Badge>v{game.version}</Badge>
            <Badge tone={game.is_public ? 'brand' : 'neutral'}>{game.is_public ? 'Público' : 'Privado'}</Badge>
          </div>
          <h3 className="font-display text-lg font-semibold leading-6 text-ink">{game.title}</h3>
          {game.description && <p className="mb-4 mt-2 line-clamp-3 text-sm leading-6 text-muted">{game.description}</p>}
          <div className="mt-auto flex flex-wrap gap-2 pt-4">
            <a
              href={game.entry_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-10 flex-1 items-center justify-center rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white no-underline transition-colors hover:bg-brand-dark"
            >
              Jogar
            </a>
            {game.teacher_id === teacherId && (
              <>
                <Button
                  onClick={() => startEditing(game)}
                  variant="secondary"
                  size="sm">
                  Editar
                </Button>
                <Button
                  aria-label={`Excluir ${game.title}`}
                  onClick={() => handleDelete(game.slug)}
                  disabled={deleting === game.slug}
                  variant="danger"
                  size="sm">
                  {deleting === game.slug ? '…' : 'Excluir'}
                </Button>
              </>
            )}
          </div>
        </Card>
      ))}
      {editingGame && (
        <Modal labelledBy="edit-game-title" onClose={() => { if (!saving) setEditingGame(null) }}>
          <h2 id="edit-game-title" className="font-display text-xl font-semibold text-ink">Editar informações</h2>
          <p className="mb-5 mt-1 text-sm text-muted">{editingGame.title} · v{editingGame.version}</p>
          <form onSubmit={saveMetadata} className="grid gap-4">
            <Field label="Nome do jogo"><Input maxLength={200} onChange={(event) => setEditValues((values) => ({ ...values, title: event.target.value }))} required value={editValues.title} /></Field>
            <Field label="Descrição"><Textarea maxLength={2000} onChange={(event) => setEditValues((values) => ({ ...values, description: event.target.value }))} rows={3} value={editValues.description} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Ano da turma"><Input maxLength={100} onChange={(event) => setEditValues((values) => ({ ...values, grade: event.target.value }))} placeholder="Ex.: 2º ano" value={editValues.grade} /></Field>
              <Field label="Disciplina"><Input maxLength={100} onChange={(event) => setEditValues((values) => ({ ...values, subject: event.target.value }))} placeholder="Ex.: Matemática" value={editValues.subject} /></Field>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-ink">
              <input checked={editValues.is_public} onChange={(event) => setEditValues((values) => ({ ...values, is_public: event.target.checked }))} type="checkbox" className="size-4 rounded border-line text-brand focus:ring-brand" />
              Disponibilizar este jogo publicamente
            </label>
            {editError && <p role="alert" className="m-0 text-sm text-danger">{editError}</p>}
            <div className="mt-2 flex flex-wrap justify-end gap-2">
              <Button disabled={saving} onClick={() => setEditingGame(null)} type="button" variant="secondary">Cancelar</Button>
              <Button disabled={saving} type="submit">{saving ? 'Salvando…' : 'Salvar alterações'}</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
