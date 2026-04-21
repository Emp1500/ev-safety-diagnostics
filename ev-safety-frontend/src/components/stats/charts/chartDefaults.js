/** Shared Chart.js options applied to all charts in the dashboard */
export const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#0f1f18',
      titleColor: '#5ed29c',
      bodyColor: 'rgba(255,255,255,0.8)',
      borderColor: 'rgba(94,210,156,0.3)',
      borderWidth: 1,
    },
  },
  scales: {
    x: {
      grid: { color: 'rgba(255,255,255,0.04)' },
      ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 11 } },
    },
    y: {
      grid: { color: 'rgba(255,255,255,0.04)' },
      ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 11 } },
    },
  },
};
