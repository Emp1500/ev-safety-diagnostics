import { ArrowIcon, CheckIcon } from '../common/Icons';

const PLANS = [
  {
    name: 'Basic', price: '₹999', period: '/month', tag: null,
    desc: 'For small fleets getting started with EV monitoring.',
    features: ['Up to 5 vehicles', 'Core sensor monitoring', 'Email alerts', '7-day data history', 'Standard support'],
  },
  {
    name: 'Pro', price: '₹2,499', period: '/month', tag: 'Most Popular',
    desc: 'Everything you need to manage a growing fleet at scale.',
    features: ['Up to 25 vehicles', 'Real-time diagnostics', 'SMS + email alerts', '90-day data history', 'Incident map access', 'Analytics dashboard', 'Priority support'],
  },
  {
    name: 'Enterprise', price: '₹9,999', period: '/month', tag: null,
    desc: 'Custom deployments for large-scale commercial fleets.',
    features: ['Unlimited vehicles', 'Advanced AI anomaly detection', 'Custom integrations & APIs', 'Unlimited data history', 'On-premise deployment option', 'Dedicated account manager', '24/7 SLA support'],
  },
];

export default function PricingPage() {
  return (
    <div style={{ background: '#050908', minHeight: '100vh', padding: '80px clamp(24px,5vw,96px)' }}>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 64 }}>
        <p className="section-label" style={{ marginBottom: 12 }}>Simple, transparent pricing</p>
        <h2 style={{ fontSize: 'clamp(32px,4vw,54px)', fontWeight: 800, color: 'white', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
          Plans for every fleet<span style={{ color: '#5ed29c' }}>.</span>
        </h2>
        <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', marginTop: 14, maxWidth: 480, margin: '14px auto 0' }}>
          Start free for 14 days. No credit card required. Cancel anytime.
        </p>
      </div>

      {/* Pricing cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 20, maxWidth: 1000, margin: '0 auto' }}>
        {PLANS.map(p => (
          <div key={p.name} className={`price-card${p.tag ? ' featured' : ''}`} style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
            {p.tag && (
              <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: '#5ed29c', color: '#050908', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '4px 16px', borderRadius: 999 }}>
                {p.tag}
              </div>
            )}
            <div style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>{p.name}</span>
            </div>
            <div style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 'clamp(38px,4.5vw,52px)', fontWeight: 900, color: p.tag ? '#5ed29c' : 'white', letterSpacing: '-0.03em' }}>{p.price}</span>
              <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginLeft: 4 }}>{p.period}</span>
            </div>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, marginBottom: 28 }}>{p.desc}</p>
            <div className="section-divider" style={{ marginBottom: 24 }} />
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
              {p.features.map(f => (
                <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>
                  <span style={{ color: '#5ed29c', flexShrink: 0 }}><CheckIcon /></span>{f}
                </li>
              ))}
            </ul>
            <button className={p.tag ? 'btn-primary' : 'btn-outline'} style={{ width: '100%', justifyContent: 'center' }}>
              Get Started <ArrowIcon />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
