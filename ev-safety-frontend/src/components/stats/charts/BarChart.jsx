import { useEffect, useRef } from 'react';
import { Chart } from 'chart.js/auto';
import { CHART_DEFAULTS } from './chartDefaults';

export default function BarChart({ data, labels, color = '#5ed29c', height = 160 }) {
  const canvasRef = useRef(null);
  const chartRef  = useRef(null);

  // Create chart once on mount
  useEffect(() => {
    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels: labels ?? [],
        datasets: [{
          data: data ?? [],
          backgroundColor: `${color}55`,
          borderColor: color,
          borderWidth: 1,
          borderRadius: 6,
        }],
      },
      options: { ...CHART_DEFAULTS },
    });
    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Patch data on every update — no recreate
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !data?.length || !labels?.length) return;
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.update('none');
  }, [data, labels]);

  return <div style={{ height }}><canvas ref={canvasRef} /></div>;
}
