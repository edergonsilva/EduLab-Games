import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getGrades, type Grade } from '../services/api'
import './Home.css'

const GRADE_COLORS = [
  '#FF6B6B','#FF8E53','#FFCA28','#66BB6A',
  '#26C6DA','#5C6BC0','#AB47BC','#EC407A','#8D6E63',
]

export default function Home() {
  const navigate = useNavigate()
  const { data: grades, isLoading, error } = useQuery<Grade[]>({
    queryKey: ['grades'],
    queryFn: getGrades,
  })

  const handleGradeClick = (grade: Grade) => {
    navigate(`/disciplinas/${grade.id}`)
  }

  return (
    <div className="home-page">
      {/* Hero */}
      <section className="hero">
        <div className="hero-content">
          <div className="hero-emoji">🎮</div>
          <h1 className="hero-title">
            Bem-vindo ao <span className="highlight">EduLab Games</span>!
          </h1>
          <p className="hero-subtitle">
            Aprender nunca foi tão divertido! Escolha o seu ano escolar para começar.
          </p>
          <div className="hero-actions">
            <button
              className="btn btn-secondary btn-lg"
              onClick={() => navigate('/entrar-sala')}
            >
              🚪 Entrar por Código de Sala
            </button>
          </div>
        </div>
        <div className="hero-decoration">
          <span>⭐</span><span>🏆</span><span>🎯</span><span>🌟</span>
        </div>
      </section>

      {/* Grade Selection */}
      <section className="grades-section page">
        <h2 className="page-title">📚 Qual é o seu ano escolar?</h2>
        <p className="page-subtitle">Toque no seu ano para ver as disciplinas!</p>

        {isLoading && (
          <div className="loading-state">
            <div className="spinner">⏳</div>
            <p>Carregando...</p>
          </div>
        )}

        {error && (
          <div className="error-state">
            ⚠️ Não foi possível carregar os anos escolares. Verifique se o servidor está rodando.
          </div>
        )}

        {grades && (
          <div className="grades-grid">
            {grades.map((grade, i) => (
              <button
                key={grade.id}
                className="grade-card card card-hover"
                style={{ '--grade-color': GRADE_COLORS[i] } as React.CSSProperties}
                onClick={() => handleGradeClick(grade)}
              >
                <span className="grade-number">{grade.id}</span>
                <span className="grade-label">{grade.label}</span>
                <span className="grade-arrow">→</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Features strip */}
      <section className="features-strip">
        <div className="features-inner">
          <div className="feature-item">
            <span>🎯</span>
            <span>Solo</span>
          </div>
          <div className="feature-item">
            <span>⚔️</span>
            <span>Duelo Local</span>
          </div>
          <div className="feature-item">
            <span>🌐</span>
            <span>Sala por Código</span>
          </div>
          <div className="feature-item">
            <span>🏆</span>
            <span>Ranking</span>
          </div>
        </div>
      </section>
    </div>
  )
}
