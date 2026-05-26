import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout/Layout'
import Home from './pages/Home'
import Subjects from './pages/Subjects'
import Games from './pages/Games'
import JoinRoom from './pages/JoinRoom'
import Teacher from './pages/Teacher'
import Admin from './pages/Admin'
import About from './pages/About'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/disciplinas/:grade" element={<Subjects />} />
        <Route path="/jogos/:grade/:subject" element={<Games />} />
        <Route path="/entrar-sala" element={<JoinRoom />} />
        <Route path="/professor" element={<Teacher />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/sobre" element={<About />} />
      </Route>
    </Routes>
  )
}
