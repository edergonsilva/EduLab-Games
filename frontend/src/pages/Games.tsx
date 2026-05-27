import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  getGames, getSubjects, getGrades,
  type Game, type Subject, type Grade,
} from '../services/api'
import './Games.css'

const MODE_LABEL: Record<string, string> = {
  solo: '🎯 Solo',
  duelo_local: '⚔️ Duelo Local',
  sala_codigo: '🌐 Sala por Código',
}

export default function Games() {
  const { grade, subject } = useParams<{ grade: string; subject: string }>()
  const navigate = useNavigate()
  const [brokenThumbs, setBrokenThumbs] = useState<Record<string, boolean>>({})

  const { data: games, isLoading } = useQuery<Game[]>({
    queryKey: ['games', grade, subject],
    queryFn: () => getGames({ grade: Number(grade), subject }),
  })

  const { data: subjects } = useQuery<Subject[]>({
    queryKey: ['subjects'],
    queryFn: getSubjects,
  })

  const { data: grades } = useQuery<Grade[]>({
    queryKey: ['grades'],
    queryFn: getGrades,
  })

  const gradeInfo = grades?.find(g => g.id === Number(grade))
  const subjectInfo = subjects?.find(s => s.id === subject)

  return (
    <div className="page">
      <div className="breadcrumb">
        <button onClick={() => navigate('/')} className="breadcrumb-link">🏠 Início</button>
        <span className="breadcrumb-sep">›</span>
        <button onClick={() => navigate(`/disciplinas/${grade}`)} className="breadcrumb-link">
          {gradeInfo?.label ?? `${grade}º Ano`}
        </button>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-current">
          {subjectInfo ? `${subjectInfo.icon} ${subjectInfo.label}` : subject}
        </span>
      </div>

      <h2 className="page-title">
        {subjectInfo ? `${subjectInfo.icon} ${subjectInfo.label}` : '🎮 Jogos'}
      </h2>
      <p className="page-subtitle">Escolha um jogo e divirta-se aprendendo!</p>

      {isLoading && (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
          ⏳ Carregando jogos...
        </div>
      )}

      {games && games.length === 0 && (
        <div className="empty-state">
          😔 Nenhum jogo disponível para esta disciplina ainda.<br />
          <small>Em breve novos jogos serão adicionados!</small>
        </div>
      )}

      {games && games.length > 0 && (
        <div className="games-grid">
          {games.map(game => {
            const gameCardKey = `${game.source}-${game.id}-${game.version}`
            const supportsRoomMode = game.mode.includes('sala_codigo')
            const supportsDirectPlay = game.mode.some(mode => mode !== 'sala_codigo')
            const showImage = game.thumbnail && !brokenThumbs[gameCardKey]

            return (
              <div key={gameCardKey} className="game-card card card-hover">
                <div className="game-thumb">
                  {showImage ? (
                    <img
                      src={game.thumbnail ?? undefined}
                      alt={game.name}
                      onError={() => setBrokenThumbs(current => ({ ...current, [gameCardKey]: true }))}
                    />
                  ) : (
                    <span className="game-thumb-placeholder">🎮</span>
                  )}
                </div>
                <div className="game-body">
                  <div className="game-header">
                    <h3 className="game-name">{game.name}</h3>
                    <span className={`badge ${game.source === 'imported' ? 'badge-yellow' : 'badge-purple'}`}>
                      {game.source === 'imported' ? 'Importado' : 'Base'}
                    </span>
                  </div>
                  <p className="game-description">{game.description}</p>
                  <div className="game-modes">
                    {game.mode.map(m => (
                      <span key={m} className="badge badge-purple">{MODE_LABEL[m] ?? m}</span>
                    ))}
                  </div>
                  <div className="game-meta">
                    <span className="game-meta-item">⏱ {game.estimated_duration_minutes} min</span>
                    <span className="game-meta-item">👥 {game.min_players}–{game.max_players} jogador(es)</span>
                  </div>
                  <div className="game-footer">
                    <small className="game-credits">Por {game.developer}</small>
                    <div className="game-actions">
                      {supportsDirectPlay && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => navigate(`/jogar/${game.id}`)}
                        >
                          Jogar Agora ▶
                        </button>
                      )}
                      {supportsRoomMode && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => navigate('/entrar-sala')}
                        >
                          {game.session_required && !supportsDirectPlay ? 'Entrar na Sala' : 'Usar código de sala'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
