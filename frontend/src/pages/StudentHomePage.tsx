import { useEffect, useMemo, useState } from 'react'
import { listGames, type Game } from '../api/games'
import { userErrorMessage } from '../api/errors'
import { Badge, Button, Card, PageContainer, PageHeader, SectionHeading } from '../components/ui'
import { GameBanner } from '../components/GameBanner'
import { StudentMascot } from '../components/StudentMascot'

function gradeLabels(grade?: string) {
  if (!grade) return ['Ano não informado']

  return grade.split(/[;,|]/).map((part) => {
    const label = part.trim()
    const number = label.match(/\d+/)?.[0]
    return number ? `${Number(number)}º ano` : label
  }).filter(Boolean)
}

function formatSubject(subject?: string) {
  if (!subject) return 'Disciplina não informada'
  return subject
    .replace(/[-_]+/g, ' ')
    .replace(/(^|\s)(\p{L})/gu, (_match, prefix, letter) => `${prefix}${letter.toLocaleUpperCase('pt-BR')}`)
}

export function StudentHomePage() {
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedGrade, setSelectedGrade] = useState<string | null>(null)
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null)

  useEffect(() => {
    listGames()
      .then(setGames)
      .catch((err: unknown) => setError(userErrorMessage(err, 'Não foi possível carregar os jogos.')))
      .finally(() => setLoading(false))
  }, [])

  const grades = useMemo(() => {
    const labels = new Set(games.flatMap((game) => gradeLabels(game.grade)))
    return [...labels].sort((a, b) => {
      const aNumber = Number(a.match(/^\d+/)?.[0] ?? Number.MAX_SAFE_INTEGER)
      const bNumber = Number(b.match(/^\d+/)?.[0] ?? Number.MAX_SAFE_INTEGER)
      return aNumber - bNumber || a.localeCompare(b, 'pt-BR')
    })
  }, [games])

  const subjects = useMemo(() => {
    if (!selectedGrade) return []
    return [...new Set(
      games
        .filter((game) => gradeLabels(game.grade).includes(selectedGrade))
        .map((game) => (game.subject || '').trim()),
    )].sort((a, b) => formatSubject(a).localeCompare(formatSubject(b), 'pt-BR'))
  }, [games, selectedGrade])

  const visibleGames = useMemo(() => games.filter((game) => (
    selectedGrade !== null
    && selectedSubject !== null
    && gradeLabels(game.grade).includes(selectedGrade)
    && (game.subject || '').trim() === selectedSubject
  )).sort((a, b) => a.title.localeCompare(b.title, 'pt-BR')), [games, selectedGrade, selectedSubject])

  function chooseGrade(grade: string) {
    setSelectedGrade(grade)
    setSelectedSubject(null)
  }

  return (
    <PageContainer>
      <PageHeader eyebrow="Espaço do aluno" title="O que vamos aprender hoje?" description="Escolha seu ano e sua disciplina para encontrar um jogo." mascot={<StudentMascot />} />

        {error && <Card className="border-red-200 bg-red-50 p-4 text-sm text-danger" role="alert">Não foi possível carregar os jogos: {error}</Card>}
        {loading && <p className="text-sm text-muted">Carregando jogos…</p>}
        {!loading && !error && games.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted">Ainda não há jogos disponíveis.</Card>
        )}

        {!loading && !error && games.length > 0 && (
          <>
            <section aria-labelledby="grade-heading" className="mb-9">
              <SectionHeading title="1. Escolha seu ano" description={`${grades.length} ${grades.length === 1 ? 'ano disponível' : 'anos disponíveis'}`} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {grades.map((grade) => (
                  <Button
                    key={grade}
                    variant="secondary"
                    type="button"
                    aria-pressed={selectedGrade === grade}
                    onClick={() => chooseGrade(grade)}
                    className={`min-h-20 flex-col items-start justify-center text-left ${selectedGrade === grade ? 'border-brand bg-brand-soft text-brand-dark' : ''}`}
                  >
                    <span className="text-base font-bold">{grade}</span>
                    <span className="text-xs font-normal text-muted">
                      {games.filter((game) => gradeLabels(game.grade).includes(grade)).length} jogos
                    </span>
                  </Button>
                ))}
              </div>
            </section>

            {selectedGrade && (
              <section aria-labelledby="subject-heading" className="mb-9">
                <SectionHeading title="2. Escolha a disciplina" />
                {subjects.length === 0 ? (
                  <p className="text-sm text-muted">Nenhuma disciplina disponível para este ano.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {subjects.map((subject) => (
                      <Button
                        key={subject}
                        variant="secondary"
                        type="button"
                        aria-pressed={selectedSubject === subject}
                        onClick={() => setSelectedSubject(subject)}
                        className={`min-h-20 flex-col items-start justify-center text-left ${selectedSubject === subject ? 'border-brand bg-brand-soft text-brand-dark' : ''}`}
                      >
                        <span className="text-sm font-bold">{formatSubject(subject)}</span>
                        <span className="text-xs font-normal text-muted">
                          {games.filter((game) => gradeLabels(game.grade).includes(selectedGrade) && (game.subject || '').trim() === subject).length} jogos
                        </span>
                      </Button>
                    ))}
                  </div>
                )}
              </section>
            )}

            {selectedSubject !== null && (
              <section aria-labelledby="games-heading">
                <SectionHeading title="3. Escolha um jogo" />
                {visibleGames.length === 0 ? (
                  <p className="text-sm text-muted">Nenhum jogo encontrado nesta disciplina.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {visibleGames.map((game) => (
                      <a
                        key={game.slug}
                        href={game.entry_url}
                        target="_blank"
                        rel="noreferrer"
                        className="group flex min-w-0 flex-col overflow-hidden rounded-lg border border-line bg-white text-ink no-underline shadow-panel transition-colors hover:border-brand/50"
                      >
                        <GameBanner game={game} />
                        <span className="flex flex-1 flex-col p-4">
                          <strong className="font-display text-lg font-semibold leading-6 group-hover:text-brand-dark">{game.title}</strong>
                          <span className="mt-2 min-h-12 text-sm leading-6 text-muted">{game.description || 'Sem descrição cadastrada.'}</span>
                          <span className="mt-4 self-start"><Badge tone="brand">Jogar ↗</Badge></span>
                        </span>
                      </a>
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}
    </PageContainer>
  )
}