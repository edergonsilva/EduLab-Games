import { Outlet, Link, useNavigate } from 'react-router-dom'
import './Layout.css'

export default function Layout() {
  const navigate = useNavigate()

  return (
    <div className="layout">
      <header className="header">
        <div className="header-inner">
          <Link to="/" className="logo">
            <span className="logo-icon">🎮</span>
            <span className="logo-text">EduLab <strong>Games</strong></span>
          </Link>
          <nav className="nav">
            <Link to="/entrar-sala" className="nav-link">🚪 Entrar por Código</Link>
            <Link to="/professor" className="nav-link">👨‍🏫 Professor</Link>
            <Link to="/sobre" className="nav-link">ℹ️ Sobre</Link>
            <Link to="/admin" className="btn btn-secondary btn-sm">⚙️ Admin</Link>
          </nav>
          <button
            className="menu-toggle"
            aria-label="Menu"
            onClick={() => {
              document.querySelector('.nav')?.classList.toggle('nav-open')
            }}
          >
            ☰
          </button>
        </div>
      </header>

      <main className="main-content">
        <Outlet />
      </main>

      <footer className="footer">
        <div className="footer-inner">
          <p className="footer-credits">
            🌟 <strong>EduLab Games</strong> — Plataforma educativa para laboratórios escolares
          </p>
          <p className="footer-author">
            Desenvolvido por <strong>Ederson Gonçalves da Silva</strong>
          </p>
          <div className="footer-links">
            <button onClick={() => navigate('/sobre')} className="footer-link">Sobre</button>
            <button onClick={() => navigate('/admin')} className="footer-link">Administração</button>
          </div>
        </div>
      </footer>
    </div>
  )
}
