import { Routes, Route, NavLink } from 'react-router-dom';
import FX from './components/FX.jsx';
import Home from './pages/Home.jsx';
import Toss from './pages/Toss.jsx';
import Admin from './pages/Admin.jsx';
import Match from './pages/Match.jsx';

export default function App() {
  return (
    <>
      <FX />
      <nav>
        <b>VALO<em>VETO</em></b>
        <NavLink to="/">Home</NavLink>
        <NavLink to="/toss">Coin Toss</NavLink>
        <NavLink to="/admin">Admin</NavLink>
      </nav>
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/toss" element={<Toss />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/m/:id" element={<Match />} />
          <Route path="/m/:id/:token" element={<Match />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
    </>
  );
}
