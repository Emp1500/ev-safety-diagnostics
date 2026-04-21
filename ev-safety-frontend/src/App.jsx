import { useState } from 'react';
import Navbar from './components/common/Navbar';
import Footer from './components/common/Footer';
import HomePage from './components/home/HomePage';
import StatsPage from './components/stats/StatsPage';
import PricingPage from './components/pricing/PricingPage';

export default function App() {
  const [page, setPage] = useState('home');

  return (
    <div style={{ minHeight: '100vh', background: '#050908', display: 'flex', flexDirection: 'column' }}>
      <Navbar page={page} setPage={setPage} />

      <main style={{ flex: 1 }}>
        {page === 'home'    && <HomePage    setPage={setPage} />}
        {page === 'stats'   && <StatsPage />}
        {page === 'pricing' && <PricingPage />}
      </main>

      <Footer />
    </div>
  );
}
