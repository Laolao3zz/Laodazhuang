import React from 'react';
import { BarChart3 } from 'lucide-react';
import { ChartDataPoint } from '../types';

interface DualLineChartProps {
  primary: ChartDataPoint[];     // 主数据：体重
  secondary: ChartDataPoint[];   // 副数据：训练容量（按日聚合）
  primaryColor?: string;
  secondaryColor?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  primarySuffix?: string;
  secondarySuffix?: string;
  height?: number;
}

/**
 * 双 Y 轴折线图：左侧体重 / 右侧训练容量
 * 用日期对齐，让用户看到"减脂期容量是不是同时在涨"。
 */
const DualLineChart: React.FC<DualLineChartProps> = ({
  primary,
  secondary,
  primaryColor = '#3b82f6',
  secondaryColor = '#f97316',
  primaryLabel = '体重',
  secondaryLabel = '容量',
  primarySuffix = 'kg',
  secondarySuffix = 't',
  height = 220,
}) => {
  if (primary.length < 2 && secondary.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center text-slate-400 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200" style={{ height: `${height}px` }}>
        <BarChart3 size={24} className="mb-2 opacity-20" />
        <span>暂无足够数据</span>
      </div>
    );
  }

  // 构建按日期对齐的合并 X 轴
  const allDates = Array.from(
    new Set([...primary.map(p => p.date), ...secondary.map(s => s.date)])
  ).sort();

  const scale = (data: ChartDataPoint[]) => {
    if (data.length < 2) return null;
    const max = Math.max(...data.map(d => d.value));
    const min = Math.min(...data.map(d => d.value));
    const range = max - min || 1;
    const pad = range * 0.2;
    return { displayMax: max + pad, displayMin: Math.max(0, min - pad), max, min };
  };

  const pScale = scale(primary);
  const sScale = scale(secondary);

  const buildPoints = (data: ChartDataPoint[], s: ReturnType<typeof scale>) => {
    if (!s) return [];
    return data.map(d => {
      const xIdx = allDates.indexOf(d.date);
      const x = (xIdx / Math.max(1, allDates.length - 1)) * 100;
      const y = 100 - ((d.value - s.displayMin) / (s.displayMax - s.displayMin)) * 100;
      return { x, y, ...d };
    });
  };

  const pPoints = buildPoints(primary, pScale);
  const sPoints = buildPoints(secondary, sScale);

  const linePath = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ');

  return (
    <div className="w-full relative select-none" style={{ height: `${height}px` }}>
      {/* Legend */}
      <div className="absolute top-0 left-0 right-0 flex justify-between text-[10px] z-10">
        <div className="flex items-center gap-1.5 bg-white/90 backdrop-blur px-2 py-1 rounded-md border border-slate-100">
          <div className="w-2 h-2 rounded-full" style={{ background: primaryColor }} />
          <span className="font-bold text-slate-600">{primaryLabel}</span>
          {primary.length > 0 && (
            <span className="font-mono font-bold ml-1" style={{ color: primaryColor }}>
              {primary[primary.length - 1].value.toFixed(1)}{primarySuffix}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 bg-white/90 backdrop-blur px-2 py-1 rounded-md border border-slate-100">
          <div className="w-2 h-2 rounded-full" style={{ background: secondaryColor }} />
          <span className="font-bold text-slate-600">{secondaryLabel}</span>
          {secondary.length > 0 && (
            <span className="font-mono font-bold ml-1" style={{ color: secondaryColor }}>
              {secondary[secondary.length - 1].value.toFixed(1)}{secondarySuffix}
            </span>
          )}
        </div>
      </div>

      <div className="absolute inset-0 pt-9 pb-6 flex items-end">
        <div className="relative w-full h-full">
          <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 overflow-visible">
            {/* Grid */}
            <line x1="0" y1="0" x2="100" y2="0" stroke="#f1f5f9" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray="4 4" />
            <line x1="0" y1="50" x2="100" y2="50" stroke="#f1f5f9" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray="4 4" />
            <line x1="0" y1="100" x2="100" y2="100" stroke="#f1f5f9" strokeWidth="1" vectorEffect="non-scaling-stroke" />

            {pPoints.length >= 2 && (
              <path d={linePath(pPoints)} fill="none" stroke={primaryColor} strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
            )}
            {sPoints.length >= 2 && (
              <path d={linePath(sPoints)} fill="none" stroke={secondaryColor} strokeWidth="2.5" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
            )}
          </svg>

          {/* Last-point dots */}
          {pPoints.length > 0 && (
            <div
              className="absolute w-3 h-3 rounded-full bg-white border-[2.5px] shadow-sm z-10 animate-pulse"
              style={{
                left: `${pPoints[pPoints.length - 1].x}%`,
                top: `${pPoints[pPoints.length - 1].y}%`,
                borderColor: primaryColor,
                transform: 'translate(-50%, -50%)',
              }}
            />
          )}
          {sPoints.length > 0 && (
            <div
              className="absolute w-3 h-3 rounded-full bg-white border-[2.5px] shadow-sm z-10"
              style={{
                left: `${sPoints[sPoints.length - 1].x}%`,
                top: `${sPoints[sPoints.length - 1].y}%`,
                borderColor: secondaryColor,
                transform: 'translate(-50%, -50%)',
              }}
            />
          )}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[10px] font-bold text-slate-300 px-1 font-mono">
        <span>{allDates[0] || ''}</span>
        <span>{allDates[allDates.length - 1] || ''}</span>
      </div>
    </div>
  );
};

export default DualLineChart;
