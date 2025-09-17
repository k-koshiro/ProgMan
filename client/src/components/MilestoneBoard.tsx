import { useMemo } from 'react';
import { format } from 'date-fns';

export interface MilestoneBoardItem {
  id?: number | string;
  name: string;
  date?: string | null; // yyyy-MM-dd
}

interface Props {
  items: MilestoneBoardItem[];
}

const colorPalette = [
  'bg-purple-600',
  'bg-red-600',
  'bg-orange-500',
  'bg-amber-500',
  'bg-green-600',
  'bg-emerald-600',
  'bg-cyan-600',
  'bg-blue-600',
  'bg-indigo-600',
  'bg-fuchsia-600',
  'bg-rose-600',
  'bg-slate-800',
  'bg-yellow-500',
  'bg-lime-600',
  'bg-teal-600',
];

function formatJP(date?: string | null): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}/${m}/${day}`;
}

export default function MilestoneBoard({ items }: Props) {
  const colored = useMemo(
    () => items.map((it, i) => ({ ...it, color: colorPalette[i % colorPalette.length] })),
    [items]
  );

  // 項目数に応じて動的にサイズを計算
  const itemCount = colored.length;
  const getItemWidth = () => {
    if (itemCount === 0) return 'flex-1';
    if (itemCount <= 3) return 'min-w-0 flex-1 max-w-[200px]';
    if (itemCount <= 5) return 'min-w-0 flex-1 max-w-[150px]';
    if (itemCount <= 7) return 'min-w-0 flex-1 max-w-[120px]';
    return 'min-w-0 flex-1 max-w-[100px]';
  };

  const getTextSize = () => {
    if (itemCount <= 3) return 'text-sm';
    if (itemCount <= 5) return 'text-xs';
    return 'text-[11px]';
  };

  const getPadding = () => {
    if (itemCount <= 3) return 'px-3 py-2';
    if (itemCount <= 5) return 'px-2 py-2';
    return 'px-1 py-2';
  };

  const itemWidthClass = getItemWidth();
  const textSizeClass = getTextSize();
  const paddingClass = getPadding();

  return (
    <div className="mb-4 w-full">
      <div className="border border-gray-800 rounded bg-white overflow-hidden">
        {/* 1行目: 項目 */}
        <div className="flex">
          <div className="w-20 sm:w-24 md:w-28 min-w-[5rem] text-center font-bold py-2 bg-purple-200 border-r border-gray-800 select-none text-xs sm:text-sm">
            項目
          </div>
          {colored.map((it, i) => (
            <div
              key={`${it.id ?? it.name}-head-${i}`}
              className={`${it.color} text-white ${textSizeClass} font-semibold ${paddingClass} ${itemWidthClass} text-center border-l border-gray-800 truncate`}
              title={it.name}
            >
              <span className="block truncate">{it.name}</span>
            </div>
          ))}
        </div>
        {/* 2行目: 予定日 */}
        <div className="flex border-t border-gray-800">
          <div className="w-20 sm:w-24 md:w-28 min-w-[5rem] text-center font-semibold py-2 bg-purple-100 border-r border-gray-800 select-none text-xs sm:text-sm">
            予定日
          </div>
          {colored.map((it, i) => (
            <div
              key={`${it.id ?? it.name}-date-${i}`}
              className={`${itemWidthClass} text-center ${paddingClass} border-l border-gray-800 text-[11px] sm:text-xs text-gray-900 truncate`}
            >
              <span className="block truncate">{formatJP(it.date)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

