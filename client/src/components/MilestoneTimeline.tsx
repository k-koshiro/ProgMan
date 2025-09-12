import { useMemo } from 'react';
import { format, differenceInCalendarDays } from 'date-fns';

type MilestoneItem = {
  id?: number;
  name: string;
  start?: string | null;
  end?: string | null;
};

interface MilestoneTimelineProps {
  baseDate?: string;
  items: MilestoneItem[];
  numbersOnly?: boolean; // ラベルを数字のみで表示（項目名はツールチップ）
}

const toDate = (v?: string | null): Date | null => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

const fmt = (d?: Date | null) => (d ? format(d, 'M/d') : '');

export default function MilestoneTimeline({ baseDate, items, numbersOnly = false }: MilestoneTimelineProps) {
  const { rangeStart, rangeEnd, today, base, list } = useMemo(() => {
    const base = toDate(baseDate);
    const today = new Date();
    const list = (items || [])
      .map((it) => ({ ...it, _start: toDate(it.start), _end: toDate(it.end) }))
      .filter((it) => it._start || it._end)
      .sort((a, b) => {
        const as = a._start?.getTime() ?? a._end?.getTime() ?? 0;
        const bs = b._start?.getTime() ?? b._end?.getTime() ?? 0;
        return as - bs;
      });

    const minStart = list.reduce<Date | null>((acc, it) => {
      const s = it._start || it._end;
      if (!s) return acc;
      return !acc || s < acc ? s : acc;
    }, null);

    const maxEnd = list.reduce<Date | null>((acc, it) => {
      const e = it._end || it._start;
      if (!e) return acc;
      return !acc || e > acc ? e : acc;
    }, null);

    // フォールバック: データが無い場合でも少なくとも30日幅を確保
    const rs = minStart || base || new Date(today.getTime() - 15 * 24 * 3600 * 1000);
    const re = maxEnd || new Date(rs.getTime() + 30 * 24 * 3600 * 1000);
    return { rangeStart: rs, rangeEnd: re, today, base, list };
  }, [baseDate, items]);

  const span = Math.max(1, differenceInCalendarDays(rangeEnd, rangeStart));
  const pos = (d?: Date | null) => {
    if (!d) return 0;
    const delta = differenceInCalendarDays(d, rangeStart);
    const pct = (delta / span) * 100;
    return Math.max(0, Math.min(100, pct));
  };

  const dayNum = (d?: Date | null) => (d ? d.getDate().toString() : '');

  return (
    <div className="bg-white rounded-lg shadow p-4 border border-indigo-100 mb-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-bold text-gray-900">マイルストーン</h2>
        <div className="text-xs text-gray-600">{fmt(rangeStart)} — {fmt(rangeEnd)}</div>
      </div>

      {/* タイムライン本体 */}
      <div className="relative h-2 bg-gray-200 rounded w-full">
        {/* 基準日マーカー */}
        {base && (
          <div
            className="absolute -top-4 translate-x-[-50%] text-[10px] text-blue-700"
            style={{ left: `${pos(base)}%` }}
          >
            基準
          </div>
        )}
        {base && (
          <div
            className="absolute top-0 h-2 w-2 bg-blue-500 rounded-full translate-x-[-50%]"
            style={{ left: `${pos(base)}%` }}
          />
        )}

        {/* 今日マーカー */}
        <div className="absolute -top-2 bottom-[-6px] w-[2px] bg-red-500/80 translate-x-[-50%]" style={{ left: `${pos(today)}%` }} />
      </div>

      {/* アイテム: バー/ドットとラベル */}
      <div className="relative mt-4">
        {list.map((it, idx) => {
          const left = pos(it._start || it._end);
          const widthPct = it._start && it._end ? Math.max(2, pos(it._end) - pos(it._start)) : 0;
          const isRange = !!(it._start && it._end && widthPct > 2);
          const lane = idx % 2 === 0 ? 'top' : 'bottom';
          const labelText = numbersOnly
            ? dayNum(it._start || it._end)
            : `${fmt(it._start)} ${it.name}`;
          const title = `${it.name} ${fmt(it._start)}${it._end ? ` — ${fmt(it._end)}` : ''}`;
          return (
            <div key={`${it.id || it.name}-${idx}`} className="mb-3">
              {/* バー/ドット */}
              <div className="relative h-0">
                {isRange ? (
                  <div
                    className={`absolute ${lane === 'top' ? '-top-3' : 'top-2'} h-2 bg-indigo-300 rounded`}
                    style={{ left: `${pos(it._start!)}%`, width: `${widthPct}%` }}
                  />
                ) : (
                  <div className={`absolute ${lane === 'top' ? '-top-2' : 'top-2'} h-2 w-2 bg-indigo-500 rounded-full translate-x-[-50%]`} style={{ left: `${left}%` }} />
                )}
              </div>
              {/* ラベル */}
              <div
                className={`absolute ${lane === 'top' ? '-top-7' : 'top-4'} translate-x-[-50%] flex items-center justify-center ${numbersOnly ? 'w-6 h-6 rounded-full bg-white border border-gray-300 text-[11px] font-semibold' : 'whitespace-nowrap text-[11px] bg-white px-1.5 py-0.5 rounded border border-gray-200'} shadow-sm`}
                style={{ left: `${isRange ? pos(it._start!) + widthPct / 2 : left}%` }}
                title={title}
              >
                {labelText}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
