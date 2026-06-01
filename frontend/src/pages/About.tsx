import { useNavigate } from 'react-router-dom'
import './About.css'

export default function About() {
  const navigate = useNavigate()

  return (
    <div className="page about-page">
      <div className="about-hero card">
        <div className="about-logo">🎮</div>
        <h1 className="about-title">EduLab Games</h1>
        <p className="about-version">versão 0.1.0 — MVP Bootstrap</p>
        <p className="about-tagline">
          Plataforma de jogos educativos para laboratórios de informática escolares.
        </p>
      </div>

      <div className="about-grid">
        <div className="card about-section">
          <h3>👤 Créditos da Plataforma</h3>
          <div className="credits-block">
            <p className="credits-name">Ederson Gonçalves da Silva</p>
            <p className="credits-role">Idealizador e Desenvolvedor</p>
          </div>
        </div>

        <div className="card about-section">
          <h3>🎯 Objetivo</h3>
          <p>
            O <strong>EduLab Games</strong> é uma plataforma <em>local-first</em> para tornar
            o aprendizado mais divertido e engajador nos laboratórios de informática escolares.
          </p>
          <p>
            Alunos do 1º ao 9º ano podem jogar jogos educativos organizados por disciplina,
            de forma solo, em duelo local ou em salas por código (estilo Kahoot).
          </p>
        </div>

        <div className="card about-section">
          <h3>📦 Módulos de Jogo (.edugame)</h3>
          <p>
            Os jogos são distribuídos como pacotes <code>.edugame</code> — arquivos ZIP com
            manifesto padronizado. Isso permite que diferentes desenvolvedores criem e
            compartilhem jogos para a plataforma.
          </p>
          <p>
            Consulte a documentação em <code>docs/edugame-spec.md</code> para saber como
            criar seu próprio módulo de jogo.
          </p>
        </div>

        <div className="card about-section">
          <h3>🕹️ Modos de Jogo</h3>
          <ul className="about-list">
            <li>🎯 <strong>Solo</strong> — jogo individual, sem código de sala</li>
            <li>⚔️ <strong>Duelo Local</strong> — 2 jogadores no mesmo computador</li>
            <li>🌐 <strong>Sala por Código</strong> — múltiplos computadores via código único</li>
          </ul>
        </div>

        <div className="card about-section">
          <h3>📚 Disciplinas</h3>
          <ul className="about-list disciplines-list">
            <li>🔢 Matemática</li>
            <li>📖 Língua Portuguesa</li>
            <li>🌎 Língua Estrangeira - Inglês</li>
            <li>📜 História</li>
            <li>🗺️ Geografia</li>
            <li>🔬 Ciências</li>
            <li>🎨 Artes</li>
            <li>✨ Ensino Religioso</li>
            <li>⚽ Educação Física</li>
            <li>🚀 Projeto Integrador</li>
            <li>🎵 Musicalização</li>
          </ul>
        </div>

        <div className="card about-section">
          <h3>⚙️ Tecnologias</h3>
          <ul className="about-list">
            <li>🐍 Backend: Python + FastAPI</li>
            <li>⚛️ Frontend: React + Vite + TypeScript</li>
            <li>🐳 Infraestrutura: Docker Compose</li>
            <li>💾 Armazenamento: JSON / SQLite (MVP)</li>
          </ul>
        </div>
      </div>

      <div className="about-footer">
        <p>
          🌟 Esta plataforma foi desenvolvida com 💜 para os alunos e professores das
          escolas municipais de Itajaí e região.
        </p>
        <p className="about-footer-note">
          Os créditos de cada jogo pertencem aos respectivos desenvolvedores dos módulos.
        </p>
        <button onClick={() => navigate('/')} className="btn btn-primary btn-lg" style={{ marginTop: '1rem' }}>
          ← Voltar ao Início
        </button>
      </div>
    </div>
  )
}
