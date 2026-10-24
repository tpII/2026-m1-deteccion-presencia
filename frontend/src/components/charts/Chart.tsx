import { useEffect, useRef } from 'react';
import type { EChartsOption } from 'echarts';
import { init } from '../../services/charts';

interface ChartProps {
  option: EChartsOption;
  height: string | number;
}

export function Chart({ option, height }: ChartProps) {
  const container = useRef<HTMLDivElement>(null);
  const chart = useRef<ReturnType<typeof init> | null>(null);

  useEffect(() => {
    if (!container.current) return;
    const instance = init(container.current, 'v5');
    chart.current = instance;
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      instance.dispose();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    chart.current?.setOption(option, { notMerge: true });
  }, [option]);

  return <div ref={container} style={{ width: '100%', height }} />;
}
