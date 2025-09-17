import { useMemo } from 'react';

export interface MilestoneBoardItem {
  id?: number | string;
  name: string;
  date?: string | null; // yyyy-MM-dd
}

interface Props {
  items: MilestoneBoardItem[];
}

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
  // スクリーンショットに基づく項目ごとの色設定
  const itemColorMap: Record<string, string> = {
    '開発着手': '#8064A2',
    '申請': '#8064A2',
    '開発キックオフ': '#DC2626',
    '画像協力会社選定': '#F79646',
    '画像協力会社選定会議': '#F79646',
    '役物協力会社選定': '#F79646',
    '役物協力会社選定会議': '#F79646',
    '画像協力会社決定': '#F79646',
    'G1': '#DC2626',
    '試作基板完': '#00B050',
    '画像サウンド制作開始': '#FFFF00',
    '画像/サウンド実装スケ作成': '#FFFF00',
    '4カ月スケ作成': '#FFFF00',
    '4ヵ月スケ作成': '#FFFF00',
    '経営キックオフ': '#00B050',
    '試作確認会': '#00B0F0',
    'G2': '#DC2626',
    'P試射': '#DC2626',
    'PJ試射': '#262626',
    '本部内試射': '#DC2626',
    'パラサミ試射１/営業試射１': '#262626',
    'パラサミ試射２/営業試射２': '#262626',
    'バラリミ認証': '#FFFF00',
    'バラリミ認証再': '#FFFF00',
    'G3': '#DC2626',
  };

  // その他の項目用の補完色（スクリーンショットに無い項目用）
  const fallbackColors = [
    '#8064A2',
    '#F79646',
    '#FFFF00',
    '#00B050',
    '#00B0F0',
    '#262626',
    '#DC2626',
    '#2563EB',
  ];

  const getReadableTextColor = (hex: string) => {
    const match = /^#?([a-fA-F0-9]{6})$/.exec(hex.trim());
    if (!match) return '#1f2937';
    const value = parseInt(match[1], 16);
    const r = (value >> 16) & 255;
    const g = (value >> 8) & 255;
    const b = value & 255;
    const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
    return brightness > 160 ? '#1f2937' : '#ffffff';
  };

  const colored = useMemo(
    () => {
      let fallbackIndex = 0;
      return items.map((it) => {
        const color = itemColorMap[it.name] ?? fallbackColors[fallbackIndex % fallbackColors.length];
        if (!itemColorMap[it.name]) fallbackIndex++;
        return { ...it, color, textColor: getReadableTextColor(color) };
      });
    },
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
              className={`${textSizeClass} font-semibold ${paddingClass} ${itemWidthClass} text-center border-l border-gray-800 truncate`}
              style={{ backgroundColor: it.color, color: it.textColor }}
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
              className={`${itemWidthClass} text-center ${paddingClass} border-l border-gray-800 text-[11px] sm:text-xs truncate`}
              style={{ backgroundColor: it.color, color: it.textColor }}
            >
              <span className="block truncate">{formatJP(it.date)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

