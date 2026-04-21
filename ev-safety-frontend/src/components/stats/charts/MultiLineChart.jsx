import { useEffect, useRef } from 'react';
import { Chart } from 'chart.js/auto';
import { CHART_DEFAULTS } from './chartDefaults';

export default function MultiLineChart({ datasets, labels, height = 160 }) {
  const canvasRef = useRef(null);
  const chartRef  = useRef(null);

  // Create chart once on mount
  useEffect(() => {
    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels: labels ?? [],
        datasets: datasets ?? [],
      },
      options: {
        ...CHART_DEFAULTS,
        plugins: {
          ...CHART_DEFAULTS.plugins,
          legend: {
            display: true,
            labels: { color: 'rgba(255,255,255,0.5)', boxWidth: 10, font: { size: 11 } },
          },
        },
      },
    });
    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Patch all datasets on every update — no recreate
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !datasets?.length || !labels?.length) return;
    chart.data.labels = labels;
    datasets.forEach((ds, i) => {
      if (chart.data.datasets[i]) {
        chart.data.datasets[i].data = ds.data;
      }
    });
    chart.update('none');
  }, [datasets, labels]);

  return <div style={{ height }}><canvas ref={canvasRef} /></div>;
}
