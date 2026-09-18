import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { SignalPoint } from '../../types/telemetry';
import { useTheme } from '../../hooks/useTheme';

interface SignalChartProps {
  rawPoints: SignalPoint[];
  filteredPoints?: SignalPoint[];
  title?: string;
  threshold?: number;
  height?: string | number;
  yAxisName?: string;
}

export const SignalChart: React.FC<SignalChartProps> = ({
  rawPoints,
  filteredPoints,
  title,
  threshold,
  height = 280,
  yAxisName = 'Amplitud (dB)',
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

    // Colores dependientes del tema
    const titleColor = isDark ? '#f1f5f9' : '#334155';
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const axisLineColor = isDark ? 'rgba(255, 255, 255, 0.15)' : '#cbd5e1';
    const splitLineColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(226, 232, 240, 0.6)';
    const tooltipBg = isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)';
    const tooltipBorder = isDark ? 'rgba(255, 255, 255, 0.15)' : '#e2e8f0';
    const tooltipText = isDark ? '#f8fafc' : '#0f172a';

    // Formatear tiempos relativos o timestamps
    const rawData = rawPoints.map((p) => {
      const d = new Date(p.timestamp);
      return [
        `${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}.${Math.floor(d.getMilliseconds() / 100)}`,
        p.value,
      ];
    });

    const filteredData = (filteredPoints || []).map((p) => {
      const d = new Date(p.timestamp);
      return [
        `${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}.${Math.floor(d.getMilliseconds() / 100)}`,
        p.value,
      ];
    });

    const seriesList: echarts.SeriesOption[] = [
      {
        name: 'Señal Cruda',
        type: 'line',
        data: rawData,
        showSymbol: false,
        smooth: false,
        lineStyle: {
          width: 1.2,
          color: isDark ? 'rgba(56, 189, 248, 0.45)' : 'rgba(14, 165, 233, 0.45)',
        },
        itemStyle: {
          color: isDark ? '#38bdf8' : '#0ea5e9',
        },
      },
    ];

    if (filteredPoints && filteredPoints.length > 0) {
      seriesList.push({
        name: 'Señal Filtrada',
        type: 'line',
        data: filteredData,
        showSymbol: false,
        smooth: true,
        lineStyle: {
          width: 2.2,
          color: isDark ? '#38bdf8' : '#0284c7',
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: isDark ? 'rgba(56, 189, 248, 0.22)' : 'rgba(2, 132, 199, 0.18)' },
            { offset: 1, color: 'rgba(2, 132, 199, 0.0)' },
          ]),
        },
        markLine: threshold
          ? {
              symbol: 'none',
              silent: true,
              data: [
                {
                  yAxis: threshold,
                  name: 'Umbral',
                  lineStyle: {
                    color: '#ef4444',
                    type: 'dashed',
                    width: 1.5,
                  },
                  label: {
                    formatter: `Umbral: ${threshold}`,
                    position: 'end',
                    fontSize: 10,
                    color: '#ef4444',
                  },
                },
              ],
            }
          : undefined,
      });
    }

    const option: echarts.EChartsOption = {
      title: title
        ? {
            text: title,
            textStyle: {
              fontSize: 12,
              fontWeight: 500,
              color: titleColor,
            },
            left: 10,
            top: 5,
          }
        : undefined,
      tooltip: {
        trigger: 'axis',
        backgroundColor: tooltipBg,
        borderColor: tooltipBorder,
        textStyle: {
          color: tooltipText,
          fontSize: 12,
        },
      },
      legend: {
        data: filteredPoints && filteredPoints.length > 0 ? ['Señal Cruda', 'Señal Filtrada'] : ['Señal Cruda'],
        right: 15,
        top: 5,
        textStyle: {
          color: textColor,
          fontSize: 11,
        },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: title ? '18%' : '14%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        axisLine: { lineStyle: { color: axisLineColor } },
        axisLabel: {
          color: textColor,
          fontSize: 10,
          interval: Math.max(1, Math.floor(rawPoints.length / 6)),
        },
      },
      yAxis: {
        type: 'value',
        name: yAxisName,
        nameTextStyle: {
          color: textColor,
          fontSize: 10,
        },
        splitLine: {
          lineStyle: {
            color: splitLineColor,
            type: 'dashed',
          },
        },
        axisLabel: {
          color: textColor,
          fontSize: 10,
        },
      },
      series: seriesList,
      animationDuration: 0,
    };

    chartInstance.current.setOption(option);
  }, [rawPoints, filteredPoints, title, threshold, yAxisName, isDark]);

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
