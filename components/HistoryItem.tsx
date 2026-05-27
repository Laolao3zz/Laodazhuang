
import React, { useState } from 'react';
import { Calendar, CheckCircle2, Trash2, Timer, Footprints, Coffee, Armchair, Ghost, Mountain } from 'lucide-react';
import { HistoryItemType } from '../types';

interface HistoryItemProps {
  item: HistoryItemType;
  onDelete: (item: { type: 'history'; data: HistoryItemType }) => void;
  onEdit?: (item: HistoryItemType) => void;
}

const HistoryItem: React.FC<HistoryItemProps> = ({ item, onDelete, onEdit }) => {
  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete({ type: 'history', data: item });
  };

  const handleEdit = () => {
      if (onEdit) onEdit(item);
  }

  // type === 'cardio' 是主信号；老数据 planName 兜底
  const isCardio = item.type === 'cardio' || (item.planName && (item.planName.includes('有氧') || item.planName.includes('爬坡') || item.planName.includes('跑步')));
  const isRest = item.type === 'rest';
  const isLazy = item.type === 'lazy';

  const displayNote = item.note || item.metrics?.note;

  const dateObj = new Date(item.date);
  const dateDisplay = `${dateObj.getMonth() + 1}月${dateObj.getDate()}日`;

  return (
    <div onClick={handleEdit} className={`p-4 rounded-2xl border relative group transition-all hover:shadow-md cursor-pointer
        ${isLazy ? 'bg-slate-100 border-slate-200' : 'bg-white border-slate-100 shadow-sm'}
    `}>
      <button
        onClick={handleDelete}
        className="absolute top-2 right-2 p-2 bg-slate-100 text-slate-400 hover:bg-red-500 hover:text-white rounded-full transition-all z-10 shadow-sm cursor-pointer active:scale-90 opacity-0 group-hover:opacity-100"
        title="删除记录"
      >
        <Trash2 size={16} />
      </button>

      <div className="flex justify-between items-start">
        <div className="flex items-start gap-4 w-full">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm shrink-0 ${
            isRest ? 'bg-blue-50 text-blue-500' :
            isLazy ? 'bg-slate-200 text-slate-500' :
            isCardio ? 'bg-emerald-50 text-emerald-500' :
            'bg-orange-50 text-orange-500'
          }`}>
            {isRest ? <Coffee size={24} /> :
             isLazy ? <Ghost size={24} /> :
             isCardio ? <Mountain size={24} /> :
             <CheckCircle2 size={24} />}
          </div>

          <div className="flex-1 min-w-0 pt-0.5">
             <div className="flex justify-between items-center mb-0.5">
                <p className={`font-black text-base tracking-tight truncate ${isLazy ? 'text-slate-500 line-through decoration-2 decoration-slate-300' : 'text-slate-800'}`}>
                    {isRest ? '休息日' : isLazy ? '摸鱼日' : isCardio ? (item.planName || '爬坡') : item.planName}
                </p>
                <span className="text-[10px] font-bold text-slate-300 tabular-nums">{dateDisplay}</span>
             </div>

             <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-400">
                {isRest ? (
                    <span>主动恢复</span>
                ) : isLazy ? (
                    <span className="text-slate-400">罪恶感: 100%</span>
                ) : isCardio ? (
                    <>
                        {item.metrics?.duration ? <span className="flex items-center gap-0.5"><Timer size={10}/> {item.metrics.duration}m</span> : null}
                        {item.metrics?.incline && <span>坡 {item.metrics.incline}%</span>}
                        {item.metrics?.speed && <span>{item.metrics.speed} km/h</span>}
                        {item.metrics?.distance && <span>{item.metrics.distance} km</span>}
                        {item.metrics?.avgHeartRate && <span>❤ {item.metrics.avgHeartRate}</span>}
                    </>
                ) : (
                    <>
                        {item.metrics?.volume ? <span>{Math.round(item.metrics.volume / 100) / 10}吨</span> : null}
                        {item.metrics?.duration ? <span className="flex items-center gap-0.5"><Timer size={10}/> {item.metrics.duration}m</span> : null}
                        {item.metrics?.avgHeartRate && <span>❤ {item.metrics.avgHeartRate}</span>}
                        {item.linkedWorkoutTs && <span className="text-emerald-500">+ 爬坡</span>}
                    </>
                )}
             </div>

             {displayNote && (
                <div className={`mt-3 p-3 rounded-xl text-xs font-medium leading-relaxed relative ${isLazy ? 'bg-white text-slate-500 border border-slate-200' : 'bg-slate-50 text-slate-500'}`}>
                    {displayNote}
                </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HistoryItem;