import { useEffect, useRef } from 'react';
import { Chart } from 'chart.js/auto';
import { CHART_DEFAULTS } from './chartDefaults';

export default function LineChart({ data, labels, label, color = '#5ed29c', yMin, yMax, height = 160, fill = true }) {
  const canvasRef = useRef(null);
  const chartRef  = useRef(null);

  // Create chart once on mount
  useEffect(() => {
    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels: labels ?? [],
        datasets: [{
          label,
          data: data ?? [],
          borderColor: color,
          backgroundColor: fill ? `${color}18` : 'transparent',
          fill,
          tension: 0.4,
          pointRadius: 0,
          borderWidth: 2,
        }],
      },
      options: {
        ...CHART_DEFAULTS,
        scales: {
          ...CHART_DEFAULTS.scales,
          y: { ...CHART_DEFAULTS.scales.y, min: yMin, max: yMax },
        },
      },
    });
    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Patch data on every update — no destroy/recreate, no flicker during live streaming
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !data?.length || !labels?.length) return;
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.update('none'); // instant, no animation — critical for 500 ms streaming
  }, [data, labels]);

  return <div style={{ height }}><canvas ref={canvasRef} /></div>;
}
