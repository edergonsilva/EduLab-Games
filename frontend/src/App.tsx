import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom'
import { LibraryPage } from './pages/LibraryPage'
import { JoinRoomPage } from './pages/JoinRoomPage'
import { RunnerPage } from './pages/RunnerPage'

function Shell() {
  const location = useLocation()
  const isRunner = location.pathname === '/runner'

  return (
    <>
      {!isRunner && (
        <header
          style={{
            borderBottom: '1px solid #e2e8f0',
            background: '#fff',
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <div
            style={{
              maxWidth: 1100,
              margin: '0 auto',
              padding: '14px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <strong>EduLab Games</strong>
            <nav style={{ display: 'flex', gap: 12, fontSize: 14 }}>
              <Link to="/">Professor / Biblioteca</Link>
              <Link to="/join">Entrar na sala</Link>
            </nav>
          </div>
        </header>
      )}
      <Routes>
        <Route path="/" element={<LibraryPage />} />
        <Route path="/join" element={<JoinRoomPage />} />
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
