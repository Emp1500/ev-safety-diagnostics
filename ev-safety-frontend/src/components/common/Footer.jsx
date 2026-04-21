export default function Footer() {
  return (
    <footer style={{
      background: '#030706',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      padding: '28px clamp(24px,5vw,96px)',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12,
    }}>
      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.04em' }}>
        © NLPC 2026
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#5ed29c', display: 'inline-block' }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.06em' }}>
          EV Safety &amp; Diagnostics
        </span>
      </div>
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.04em' }}>All rights reserved</span>
    </footer>
  );
}
