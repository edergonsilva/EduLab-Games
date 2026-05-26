import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getSubjects, getGrades, type Subject, type Grade } from '../services/api'
import './Subjects.css'

export default function Subjects() {
  const { grade } = useParams<{ grade: string }>()
  const navigate = useNavigate()

  const { data: subjects, isLoading } = useQuery<Subject[]>({
    queryKey: ['subjects'],
    queryFn: getSubjects,
  })

  const { data: grades } = useQuery<Grade[]>({
    queryKey: ['grades'],
    queryFn: getGrades,
  })

  const gradeInfo = grades?.find(g => g.id === Number(grade))

  const handleSubjectClick = (subject: Subject) => {
    navigate(`/jogos/${grade}/${subject.id}`)
  }

  return (
    <div className="page">
      <div className="breadcrumb">
        <button onClick={() => navigate('/')} className="breadcrumb-link">🏠 Início</button>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-current">{gradeInfo?.label ?? `${grade}º Ano`}</span>
      </div>

      <h2 className="page-title">
        📚 {gradeInfo?.label ?? `${grade}º Ano`}
      </h2>
      <p className="page-subtitle">Escolha a disciplina que você quer jogar!</p>

      {isLoading && (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
          ⏳ Carregando disciplinas...
        </div>
      )}

      {subjects && (
        <div className="subjects-grid">
          {subjects.map(subject => (
            <button
              key={subject.id}
              className="subject-card card card-hover"
              style={{ '--subject-color': subject.color } as React.CSSProperties}
              onClick={() => handleSubjectClick(subject)}
            >
              <span className="subject-icon">{subject.icon}</span>
              <span className="subject-label">{subject.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
