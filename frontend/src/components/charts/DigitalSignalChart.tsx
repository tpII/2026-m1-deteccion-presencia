import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { SignalPoint } from '../../types/telemetry';
import { useTheme } from '../../hooks/useTheme';

interface DigitalSignalChartProps {
  points: SignalPoint[];
  title?: string;
  height?: string | number;
}

export const DigitalSignalChart: React.FC<DigitalSignalChartProps> = ({
  points,
  title = 'Cronograma Digital PIR (0: Ausencia / 1: Detección)',
  height = 240,
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
    if (!chartInstance.current) return;

    const titleColor = isDark ? '#f1f5f9' : '#334155';
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const axisLineColor = isDark ? 'rgba(255, 255, 255, 0.15)' : '#cbd5e1';
    const splitLineColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(226, 232, 240, 0.6)';
    const tooltipBg = isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)';
    const tooltipBorder = isDark ? 'rgba(255, 255, 255, 0.15)' : '#e2e8f0';
    const tooltipText = isDark ? '#f8fafc' : '#0f172a';

    const data = points.map((p) => {
      const d = new Date(p.timestamp);
      return [
        `${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}.${Math.floor(d.getMilliseconds() / 100)}`,
        p.value >= 0.5 ? 1 : 0,
      ];
    });

    const option: echarts.EChartsOption = {
      title: {
        text: title,
        textStyle: {
          fontSize: 12,
          fontWeight: 500,
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
          if (!params || !params[0]) return '';
          const val = params[0].value[1];
          const time = params[0].value[0];
          const color = val === 1 ? (isDark ? '#34d399' : '#10b981') : (isDark ? '#94a3b8' : '#64748b');
          return `<strong>${time}</strong><br/>Estado: <span style="color: ${color}; font-weight: 600;">${val === 1 ? 'PRESENCIA (1)' : 'AUSENCIA (0)'}</span>`;
        },
      },
      grid: {
        left: '4%',
        right: '4%',
        bottom: '5%',
        top: '20%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        axisLine: { lineStyle: { color: axisLineColor } },
        axisLabel: {
          color: textColor,
          fontSize: 10,
          interval: Math.max(1, Math.floor(points.length / 6)),
        },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 1,
        interval: 1,
        axisLabel: {
          formatter: (val: number) => (val === 1 ? '1 (Presencia)' : '0 (Ausencia)'),
          color: textColor,
          fontSize: 10,
        },
        splitLine: {
          lineStyle: {
            color: splitLineColor,
            type: 'dashed',
          },
        },
      },
      series: [
        {
          name: 'Nivel Lógico PIR',
          type: 'line',
          step: 'end',
          data: data,
          showSymbol: false,
          lineStyle: {
            width: 2.5,
            color: isDark ? '#34d399' : '#10b981',
          },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: isDark ? 'rgba(16, 185, 129, 0.35)' : 'rgba(16, 185, 129, 0.25)' },
              { offset: 1, color: 'rgba(16, 185, 129, 0.02)' },
            ]),
          },
        },
      ],
      animationDuration: 0,
    };

    chartInstance.current.setOption(option);
  }, [points, title, isDark]);

  return (
    <div
      ref={chartRef}
      style={{
        width: '100%',
        height: typeof height === 'number' ? `${height}px` : height,
      }}
    />
  );
};
