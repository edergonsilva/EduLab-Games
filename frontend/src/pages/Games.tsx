import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  getGames, getSubjects, getGrades,
  type Game, type Subject, type Grade
} from '../services/api'
import './Games.css'

const MODE_LABEL: Record<string, string> = {
  solo:        '🎯 Solo',
  duelo_local: '⚔️ Duelo Local',
  sala_codigo: '🌐 Sala por Código',
}

export default function Games() {
  const { grade, subject } = useParams<{ grade: string; subject: string }>()
  const navigate = useNavigate()

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

  const gradeInfo   = grades?.find(g => g.id === Number(grade))
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
          {games.map(game => (
            <div key={game.id} className="game-card card card-hover">
              <div className="game-thumb">
                {game.thumbnail
                  ? <img src={game.thumbnail} alt={game.name} />
                  : <span className="game-thumb-placeholder">🎮</span>
                }
              </div>
              <div className="game-body">
                <h3 className="game-name">{game.name}</h3>
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
                  {game.session_required ? (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => navigate('/entrar-sala')}
                    >
                      Entrar na Sala
                    </button>
                  ) : (
                    <button className="btn btn-secondary btn-sm">
                      Jogar Agora ▶
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
