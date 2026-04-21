const BRANDS = [
  { name: 'TESLA',  sub: 'Motors' },
  { name: 'BYD',    sub: 'Electric' },
  { name: 'NIO',    sub: 'Technology' },
  { name: 'ATHER',  sub: 'Energy' },
  { name: 'TATA',   sub: 'EV' },
  { name: 'RIVIAN', sub: 'Automotive' },
];

export default function EVLogos() {
  return (
    <div style={{ padding: '56px 0 48px', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <p className="section-label" style={{ textAlign: 'center', marginBottom: 32 }}>
        Trusted by leading EV manufacturers
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '32px 48px', justifyContent: 'center', alignItems: 'center' }}>
        {BRANDS.map(b => (
          <div
            key={b.name}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 0.35, transition: 'opacity 0.2s', cursor: 'default' }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '0.35')}
          >
            <span style={{ fontFamily: '"Plus Jakarta Sans",sans-serif', fontWeight: 800, fontSize: 18, letterSpacing: '0.12em', color: 'white' }}>
              {b.name}
            </span>
            <span style={{ fontSize: 9, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginTop: 2 }}>
              {b.sub}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
