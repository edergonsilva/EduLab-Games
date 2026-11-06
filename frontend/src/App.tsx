import { useEffect, useState, type ReactNode } from 'react'
import { BrowserRouter, Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { getTeacherSession, logoutTeacher, type Teacher } from './api/auth'
import { BrandMark, Button, cx } from './components/ui'
import { LibraryPage } from './pages/LibraryPage'
import { JoinRoomPage } from './pages/JoinRoomPage'
import { LobbyPage } from './pages/LobbyPage'
import { RunnerPage } from './pages/RunnerPage'
import { StudentHomePage } from './pages/StudentHomePage'
import { TeacherAuthPage } from './pages/TeacherAuthPage'
import { GameCreatorPage } from './pages/GameCreatorPage'

function ProtectedTeacherPage({ children }: { children: (teacher: Teacher) => ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [teacher, setTeacher] = useState<Teacher | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getTeacherSession()
      .then(setTeacher)
      .catch(() => setTeacher(null))
      .finally(() => setLoading(false))
  }, [])

  async function handleLogout() {
    await logoutTeacher()
    navigate('/professor/entrar', { replace: true })
  }

  if (loading) return <p className="p-6 text-sm text-muted">Carregando sua sessão…</p>
  if (!teacher) return <Navigate to="/professor/entrar" replace state={{ from: location.pathname }} />

  return (
    <>
      <div className="border-b border-line bg-brand-pale">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm sm:px-6 lg:px-8">
          <span className="text-muted">Olá, <strong className="text-ink">{teacher.name}</strong>{teacher.school_name ? ` · ${teacher.school_name}` : ''}</span>
          <Button onClick={() => void handleLogout()} size="sm" variant="secondary">Sair da conta</Button>
        </div>
      </div>
      {children(teacher)}
    </>
  )
}

function Shell() {
  const location = useLocation()
  const isRunner = location.pathname === '/runner'
  const navLinkClass = ({ isActive }: { isActive: boolean }) => cx(
    'rounded-md px-3 py-2 text-sm font-semibold transition-colors',
    isActive ? 'bg-brand-soft text-brand-dark' : 'text-muted hover:bg-canvas hover:text-ink',
  )

  return (
    <>
      {!isRunner && (
        <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <Link aria-label="EduLab Games, início" className="flex items-center gap-3 text-ink no-underline" to="/">
              <BrandMark />
              <span>
                <strong className="block font-display text-base font-semibold leading-5">EduLab</strong>
                <span className="block text-xs text-muted">Games de aprendizagem</span>
              </span>
            </Link>
            <nav aria-label="Navegação principal" className="flex flex-wrap items-center gap-1">
              <NavLink className={navLinkClass} end to="/">Aluno</NavLink>
              <NavLink className={navLinkClass} to="/professor/biblioteca">Professor</NavLink>
              <NavLink className={navLinkClass} to="/join">Entrar na sala</NavLink>
            </nav>
          </div>
          <script src="https://cdn.jsdelivr.net/npm/eruda"></script>
          <script>eruda.init();</script>
        </header>
      )}
      <Routes>
        <Route path="/" element={<StudentHomePage />} />
        <Route path="/professor/entrar" element={<TeacherAuthPage />} />
        <Route path="/professor/biblioteca" element={<ProtectedTeacherPage>{(teacher) => <LibraryPage teacherId={teacher.id} />}</ProtectedTeacherPage>} />
        <Route path="/professor/criador-de-jogos" element={<ProtectedTeacherPage>{() => <GameCreatorPage />}</ProtectedTeacherPage>} />
        <Route path="/join" element={<JoinRoomPage />} />
        <Route path="/sala/:code/lobby" element={<LobbyPage />} />
        <Route path="/runner" element={<RunnerPage />} />
      </Routes>
    </>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  )
}

export default App
