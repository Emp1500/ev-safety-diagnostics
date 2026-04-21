import { ArrowIcon } from '../common/Icons';
import VideoBackground from './VideoBackground';
import EVLogos from './EVLogos';

export default function HomePage({ setPage }) {
  return (
    <div>
      {/* ── Hero ── */}
      <div style={{ position: 'relative', minHeight: '100vh', background: '#050908', overflow: 'hidden' }}>
        <VideoBackground />

        {/* Gradient overlays */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', background: 'linear-gradient(to right,#050908 0%,rgba(5,9,8,0.6) 45%,transparent 75%)' }} />
        <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', background: 'linear-gradient(to top,#050908 0%,rgba(5,9,8,0.3) 28%,transparent 55%)' }} />

        {/* Vertical grid lines (desktop only) */}
        <div className="hidden md:block" style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none' }}>
          <div className="grid-line" style={{ left: '25%' }} />
          <div className="grid-line" style={{ left: '50%' }} />
          <div className="grid-line" style={{ left: '75%' }} />
        </div>

        {/* Hero content */}
        <div style={{ position: 'relative', zIndex: 10, minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 'clamp(24px,5vw,96px)', paddingTop: 'clamp(100px,14vw,140px)' }}>
          <div style={{ maxWidth: 680 }}>
            <p className="section-label" style={{ marginBottom: 18 }}>Next-generation Fleet Intelligence</p>
            <h1 style={{ fontFamily: '"Inter",sans-serif', fontWeight: 800, fontSize: 'clamp(38px,5.8vw,70px)', color: 'white', lineHeight: 1.0, letterSpacing: '-0.03em', textTransform: 'uppercase', marginBottom: 22 }}>
              REAL-TIME EV SAFETY &amp; DIAGNOSTICS<span style={{ color: '#5ed29c' }}>.</span>
            </h1>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.68)', maxWidth: 500, lineHeight: 1.8, marginBottom: 36 }}>
              Monitor battery health, detect anomalies, and prevent failures across your entire electric fleet — all from one unified dashboard.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button className="btn-primary" onClick={() => setPage('stats')}>
                View Dashboard <ArrowIcon />
              </button>
              <button className="btn-outline" onClick={() => setPage('pricing')}>
                See Pricing
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Brand logos strip ── */}
      <div style={{ background: '#050908' }}>
        <div style={{ padding: '0 clamp(24px,5vw,96px)' }}>
          <EVLogos />
        </div>
      </div>
    </div>
  );
}
