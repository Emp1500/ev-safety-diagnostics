import { useState } from 'react';
import { MenuIcon, XIcon } from './Icons';

const NAV_ITEMS = ['HOME', 'STATS', 'PRICING'];

export default function Navbar({ page, setPage }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const navigate = (target) => {
    setPage(target.toLowerCase());
    setMenuOpen(false);
  };

  return (
    <>
      <header style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'rgba(5,9,8,0.85)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '0 clamp(24px,5vw,96px)',
        height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {/* Logo */}
        <div onClick={() => navigate('home')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/EV logo.png" alt="NLPC Logo" style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 10 }} />
          <span style={{ fontFamily: '"Plus Jakarta Sans",sans-serif', fontWeight: 800, fontSize: 15, color: 'white', letterSpacing: '0.04em' }}>
            EV Safety and Diagnostics
          </span>
        </div>

        {/* Desktop nav */}
        <nav className="hidden md:flex" style={{ gap: 32 }}>
          {NAV_ITEMS.map(n => (
            <span
              key={n}
              className={`nav-link${page === n.toLowerCase() ? ' active' : ''}`}
              onClick={() => navigate(n)}
            >
              {n}
            </span>
          ))}
        </nav>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMenuOpen(o => !o)}
          className="flex md:hidden"
          style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: 4 }}
        >
          {menuOpen ? <XIcon /> : <MenuIcon />}
        </button>
      </header>

      {/* Mobile overlay */}
      {menuOpen && (
        <div className="mobile-overlay">
          {NAV_ITEMS.map(n => (
            <span key={n} onClick={() => navigate(n)}>{n}</span>
          ))}
        </div>
      )}
    </>
  );
}
