import React, { useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { RiskHistory, WarningLevel } from '../types';
import { formatPercent } from '../utils/format';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface RiskCurveChartProps {
  history: RiskHistory[];
  warningLine?: number;
  liquidationLine?: number;
  height?: number;
}

const RiskCurveChart: React.FC<RiskCurveChartProps> = ({
  history,
  warningLine = 150,
  liquidationLine = 130,
  height = 350,
}) => {
  const chartRef = useRef<any>(null);

  const sortedHistory = [...history].sort(
    (a, b) => new Date(a.calculated_at).getTime() - new Date(b.calculated_at).getTime()
  );

  const labels = sortedHistory.map((h) => {
    const date = new Date(h.calculated_at);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  });

  const ratioData = sortedHistory.map((h) => h.maintenance_ratio);

  const getPointBackgroundColor = (level: WarningLevel) => {
    switch (level) {
      case 'normal':
        return 'rgba(82, 196, 26, 1)';
      case 'warning':
        return 'rgba(250, 173, 20, 1)';
      case 'danger':
        return 'rgba(250, 140, 22, 1)';
      case 'liquidation':
        return 'rgba(245, 34, 45, 1)';
      default:
        return 'rgba(24, 144, 255, 1)';
    }
  };

  const pointBackgroundColors = sortedHistory.map((h) =>
    getPointBackgroundColor(h.warning_level)
  );

  const data = {
    labels,
    datasets: [
      {
        label: '维持担保比例',
        data: ratioData,
        borderColor: 'rgba(24, 144, 255, 1)',
        backgroundColor: 'rgba(24, 144, 255, 0.1)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: pointBackgroundColors,
        pointBorderColor: pointBackgroundColors,
        pointRadius: 6,
        pointHoverRadius: 8,
      },
      {
        label: '预警线',
        data: Array(labels.length).fill(warningLine),
        borderColor: 'rgba(250, 173, 20, 1)',
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
      },
      {
        label: '平仓线',
        data: Array(labels.length).fill(liquidationLine),
        borderColor: 'rgba(245, 34, 45, 1)',
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: '维持担保比例变化趋势',
        font: {
          size: 16,
          weight: 'bold' as const,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleFont: { size: 14 },
        bodyFont: { size: 13 },
        callbacks: {
          label: function (context: any) {
            const value = context.parsed.y;
            const dataIndex = context.dataIndex;
            const level = sortedHistory[dataIndex]?.warning_level;
            const levelText = {
              normal: '正常',
              warning: '预警',
              danger: '警戒',
              liquidation: '平仓',
            }[level || 'normal'];
            return [`${context.dataset.label}: ${formatPercent(value)}`, `风险等级: ${levelText}`];
          },
        },
      },
    },
    scales: {
      y: {
        min: 0,
        title: {
          display: true,
          text: '维持担保比例 (%)',
          font: { size: 12 },
        },
        ticks: {
          callback: function (value: any) {
            return value + '%';
          },
        },
      },
      x: {
        title: {
          display: true,
          text: '日期',
          font: { size: 12 },
        },
      },
    },
  };

  return (
    <div style={{ height }}>
      <Line ref={chartRef} data={data} options={options} />
    </div>
  );
};

export default RiskCurveChart;
