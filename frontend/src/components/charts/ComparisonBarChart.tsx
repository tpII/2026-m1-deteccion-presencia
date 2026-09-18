import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { CaseMetrics } from '../../types/metrics';
import { useTheme } from '../../hooks/useTheme';

interface ComparisonBarChartProps {
  metrics: CaseMetrics[];
  metricKey: 'detection_rate' | 'false_positives' | 'false_negatives' | 'average_latency_ms';
  title: string;
  unit: string;
  height?: number;
}

export const ComparisonBarChart: React.FC<ComparisonBarChartProps> = ({
  metrics,
  metricKey,
  title,
  unit,
  height = 220,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const { isDark } = useTheme();

  useEffect(() => {
    if (!chartRef.current) return;
    chartInstance.current = echarts.init(chartRef.current);

    const handleResize = () => {
      chartInstance.current?.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, []);

  useEffect(() => {
    if (!chartInstance.current || !metrics || metrics.length === 0) return;

    const titleColor = isDark ? '#f1f5f9' : '#334155';
    const textColor = isDark ? '#94a3b8' : '#475569';
    const axisLineColor = isDark ? 'rgba(255, 255, 255, 0.15)' : '#cbd5e1';
    const splitLineColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(226, 232, 240, 0.6)';
    const tooltipBg = isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)';
    const tooltipBorder = isDark ? 'rgba(255, 255, 255, 0.15)' : '#e2e8f0';
    const tooltipText = isDark ? '#f8fafc' : '#0f172a';
    const barLabelColor = isDark ? '#f1f5f9' : '#475569';

    const categories = ['PIR', 'CSI Router', 'CSI Dedicado'];
    const values = metrics.map((m) => m[metricKey]);

    const colors = [
      isDark ? '#10b981' : '#059669', // Verde PIR
      isDark ? '#38bdf8' : '#0284c7', // Azul CSI Router
      isDark ? '#818cf8' : '#6366f1', // Indigo CSI Dedicado
    ];

    const option: echarts.EChartsOption = {
      title: {
        text: title,
        textStyle: {
          fontSize: 12,
          fontWeight: 600,
          color: titleColor,
        },
        left: 10,
        top: 5,
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: tooltipBg,
        borderColor: tooltipBorder,
        textStyle: {
          color: tooltipText,
        },
        formatter: (params: any) => {
          const item = params[0];
          return `<strong>${item.name}</strong>: ${item.value} ${unit}`;
        },
      },
      grid: {
        left: '4%',
        right: '4%',
        bottom: '8%',
        top: '25%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: categories,
        axisLine: { lineStyle: { color: axisLineColor } },
        axisLabel: {
          color: textColor,
          fontSize: 11,
          fontWeight: 500,
        },
      },
      yAxis: {
        type: 'value',
        name: unit,
        nameTextStyle: { color: textColor, fontSize: 10 },
        splitLine: {
          lineStyle: { color: splitLineColor, type: 'dashed' },
        },
        axisLabel: { color: textColor, fontSize: 10 },
      },
      series: [
        {
          name: title,
          type: 'bar',
          barWidth: '40%',
          data: values.map((val, idx) => ({
            value: val,
            itemStyle: {
              color: colors[idx % colors.length],
              borderRadius: [6, 6, 0, 0],
            },
          })),
          label: {
            show: true,
            position: 'top',
            formatter: `{c} ${unit}`,
            fontSize: 10,
            color: barLabelColor,
          },
        },
      ],
    };

    chartInstance.current.setOption(option);
  }, [metrics, metricKey, title, unit, isDark]);

  return (
    <div
      ref={chartRef}
      style={{
        width: '100%',
        height: `${height}px`,
      }}
    />
  );
};
