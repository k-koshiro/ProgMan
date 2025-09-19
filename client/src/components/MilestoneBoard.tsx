import { useMemo, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import type { MilestoneEstimate } from '../types';

export interface MilestoneBoardItem {
  id?: number | string;
  name: string;
  date?: string | null; // yyyy-MM-dd
}

interface Props {
  items: MilestoneBoardItem[];
  projectId: number;
  editable?: boolean;
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

// 日付差分を計算して遅れ日数を返す
function calculateDelay(plannedDate: string | null | undefined, estimateDate: string | null | undefined): number | null {
  if (!plannedDate || !estimateDate) return null;

  const planned = new Date(plannedDate);
  const estimate = new Date(estimateDate);

  if (isNaN(planned.getTime()) || isNaN(estimate.getTime())) return null;

  const diffTime = estimate.getTime() - planned.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

// 遅れ日数の表示文字列を生成
function formatDelay(days: number | null): { text: string; color: string } {
  if (days === null || days === 0) return { text: '', color: '' };

  if (days > 0) {
    return {
      text: `遅れ ${days} 日`,
      color: '#DC2626' // 赤色
    };
  } else {
    return {
      text: `前倒し ${Math.abs(days)} 日`,
      color: '#00B050' // 緑色
    };
  }
}

export default function MilestoneBoard({ items, projectId, editable = false }: Props) {
  const [estimates, setEstimates] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [saveTimers, setSaveTimers] = useState<Record<number, ReturnType<typeof setTimeout>>>({});

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

  // 見込み日データを取得
  useEffect(() => {
    if (!projectId) return;

    const fetchEstimates = async () => {
      setLoading(true);
      try {
        const response = await axios.get(`/progress-manager/api/schedules/${projectId}/milestone-estimates`);
        const estimatesData: MilestoneEstimate[] = response.data;

        const estimatesMap: Record<number, string> = {};
        estimatesData.forEach(est => {
          if (est.estimate_date) {
            estimatesMap[est.schedule_id] = est.estimate_date;
          }
        });

        setEstimates(estimatesMap);
      } catch (error) {
        console.error('Failed to fetch milestone estimates:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEstimates();
  }, [projectId]);

  // 見込み日を更新（デバウンス付き）
  const updateEstimate = useCallback((scheduleId: number, estimateDate: string) => {
    // タイマーをクリア
    if (saveTimers[scheduleId]) {
      clearTimeout(saveTimers[scheduleId]);
    }

    // 新しいタイマーを設定
    const timer = setTimeout(async () => {
      try {
        await axios.put(
          `/progress-manager/api/schedules/${projectId}/milestone-estimates/${scheduleId}`,
          { estimate_date: estimateDate || null }
        );
      } catch (error) {
        console.error('Failed to update milestone estimate:', error);
      }
    }, 1000); // 1秒後に保存

    setSaveTimers(prev => ({ ...prev, [scheduleId]: timer }));
  }, [projectId, saveTimers]);

  const handleEstimateChange = (scheduleId: number, value: string) => {
    setEstimates(prev => ({ ...prev, [scheduleId]: value }));
    if (editable) {
      updateEstimate(scheduleId, value);
    }
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
          {colored.map((it, i) => {
            // 長い項目名を改行で分割
            const displayName = it.name
              .replace('パラサミ試射１/営業試射１', 'パラサミ試射１/\n営業試射１')
              .replace('パラサミ試射２/営業試射２', 'パラサミ試射２/\n営業試射２')
              .replace('画像/サウンド実装スケ作成', '画像/サウンド\n実装スケ作成');

            return (
              <div
                key={`${it.id ?? it.name}-head-${i}`}
                className={`${textSizeClass} font-semibold ${paddingClass} ${itemWidthClass} text-center border-l border-gray-800`}
                style={{ backgroundColor: it.color, color: it.textColor }}
                title={it.name}
              >
                <span className="block whitespace-pre-line leading-tight">{displayName}</span>
              </div>
            );
          })}
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

        {/* 3行目: 見込み日 */}
        <div className="flex border-t border-gray-800">
          <div className="w-20 sm:w-24 md:w-28 min-w-[5rem] text-center font-semibold py-1 bg-yellow-50 border-r border-gray-800 select-none text-xs sm:text-sm">
            見込み日
          </div>
          {colored.map((it, i) => {
            const scheduleId = typeof it.id === 'number' ? it.id : 0;
            return (
              <div
                key={`${it.id ?? it.name}-estimate-${i}`}
                className={`${itemWidthClass} ${paddingClass} border-l border-gray-800`}
              >
                <input
                  type="date"
                  value={estimates[scheduleId] || ''}
                  onChange={(e) => handleEstimateChange(scheduleId, e.target.value)}
                  disabled={!editable || loading}
                  className="w-full text-[10px] sm:text-xs border-0 bg-transparent text-center focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:cursor-not-allowed"
                  style={{ backgroundColor: '#FFFBF0' }}
                />
              </div>
            );
          })}
        </div>

        {/* 4行目: 遅れ */}
        <div className="flex border-t border-gray-800">
          <div className="w-20 sm:w-24 md:w-28 min-w-[5rem] text-center font-semibold py-2 bg-red-50 border-r border-gray-800 select-none text-xs sm:text-sm">
            状態
          </div>
          {colored.map((it, i) => {
            const scheduleId = typeof it.id === 'number' ? it.id : 0;
            const delay = calculateDelay(it.date, estimates[scheduleId]);
            const delayDisplay = formatDelay(delay);

            return (
              <div
                key={`${it.id ?? it.name}-delay-${i}`}
                className={`${itemWidthClass} text-center ${paddingClass} border-l border-gray-800 text-[10px] sm:text-xs font-semibold`}
                style={{
                  backgroundColor: delay && delay > 0 ? '#FEE2E2' : delay && delay < 0 ? '#D1FAE5' : '#F9FAFB',
                  color: delayDisplay.color || '#6B7280'
                }}
              >
                <span className="block truncate">{delayDisplay.text}</span>
              </div>
            );
          })}
        </div>

        {/* PJ見込み予定日 */}
        <div className="flex border-t-2 border-gray-800 bg-orange-100">
          <div className="w-full text-center font-bold py-2 text-xs sm:text-sm">
            PJ見込み予定日
          </div>
        </div>
      </div>
    </div>
  );
}