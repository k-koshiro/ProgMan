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

  return (
    <div className="overflow-x-auto mb-4">
      <div className="inline-block min-w-full">
        <div className="border border-gray-800 rounded bg-white">
          {/* 1行目: 項目 */}
          <div className="flex">
            <div className="w-28 min-w-[7rem] text-center font-bold py-2 bg-purple-200 border-r border-gray-800 select-none">
              項目
            </div>
            {colored.map((it, i) => (
              <div
                key={`${it.id ?? it.name}-head-${i}`}
                className={`${it.color} text-white text-xs md:text-sm font-semibold px-3 py-2 min-w-[8rem] text-center border-l border-gray-800`}
                title={it.name}
              >
                {it.name}
              </div>
            ))}
          </div>
          {/* 2行目: 予定日 */}
          <div className="flex border-t border-gray-800">
            <div className="w-28 min-w-[7rem] text-center font-semibold py-2 bg-purple-100 border-r border-gray-800 select-none">
              予定日
            </div>
            {colored.map((it, i) => (
              <div
                key={`${it.id ?? it.name}-date-${i}`}
                className="min-w-[8rem] text-center px-3 py-2 border-l border-gray-800 text-[13px] text-gray-900"
              >
                {formatJP(it.date)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

