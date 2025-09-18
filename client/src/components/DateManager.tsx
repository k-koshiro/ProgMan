import { useState } from 'react';
import type { CommentPage } from '../types';

interface DateManagerProps {
  commentPages: CommentPage[];
  selectedDate: string;
  latestDate: string | null;
  loading: boolean;
  error: string | null;
  localMessage: string | null;
  newPageDate: string;
  onSelectDate: (date: string) => void;
  onCreatePage: () => void;
  onDeletePage: () => void;
  onNewPageDateChange: (date: string) => void;
}

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const shortDateFormatter = new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' });

const formatDateLabel = (date: string | null | undefined) => {
  if (!date || !isoDatePattern.test(date)) return '—';
  return shortDateFormatter.format(new Date(`${date}T00:00:00`));
};

function DateManager({
  commentPages,
  selectedDate,
  latestDate,
  loading,
  error,
  localMessage,
  newPageDate,
  onSelectDate,
  onCreatePage,
  onDeletePage,
  onNewPageDateChange,
}: DateManagerProps) {
  const [showNewPageForm, setShowNewPageForm] = useState(false);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  const pageDates = commentPages.map(p => p.comment_date);

  const handleDeleteDate = (date: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (date === selectedDate) {
      onDeletePage();
    }
  };

  const handleCreatePage = () => {
    onCreatePage();
    setShowNewPageForm(false);
  };

  return (
    <div className="mb-6">
      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-md hover:shadow-lg transition-shadow">
        {/* ステータス行 */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4 text-sm">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-gray-600">最新進捗日:</span>
              <span className="font-semibold text-blue-600">{formatDateLabel(latestDate)}</span>
            </div>
            {selectedDate && (
              <div className="flex items-center gap-2">
                <span className="text-gray-600">表示中:</span>
                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                  {formatDateLabel(selectedDate)}
                </span>
              </div>
            )}
          </div>
          {loading && (
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
              <span className="text-blue-600 font-medium">読み込み中</span>
            </div>
          )}
        </div>

        {/* 日付タブ */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {pageDates.length === 0 ? (
              <div className="text-sm text-gray-500 py-2">コメントページがありません</div>
            ) : (
              pageDates.map(date => (
                <div
                  key={date}
                  className="relative group"
                  onMouseEnter={() => setHoveredDate(date)}
                  onMouseLeave={() => setHoveredDate(null)}
                >
                  <button
                    onClick={() => onSelectDate(date)}
                    className={`
                      relative rounded-full px-4 py-2.5 text-sm font-medium transition-all duration-200
                      border-2 min-w-[80px] text-center
                      ${date === selectedDate
                        ? 'bg-blue-500 text-white border-blue-500 shadow-lg scale-105'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50 hover:scale-102'
                      }
                      ${date === latestDate && date !== selectedDate ? 'ring-2 ring-blue-300 ring-offset-1' : ''}
                    `}
                  >
                    {formatDateLabel(date)}
                    {date === latestDate && date !== selectedDate && (
                      <span className="absolute -top-2 -right-2 rounded-full bg-blue-500 px-2 py-0.5 text-xs text-white font-bold shadow-md">
                        最新
                      </span>
                    )}
                  </button>

                  {/* 削除ボタン（ホバー時のみ表示） */}
                  {hoveredDate === date && date === selectedDate && (
                    <button
                      onClick={(e) => handleDeleteDate(date, e)}
                      className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-sm text-white hover:bg-red-600 transition-all duration-200 shadow-lg"
                      title="この日付のページを削除"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))
            )}

            {/* 新規作成ボタン */}
            <button
              onClick={() => setShowNewPageForm(!showNewPageForm)}
              className={`
                rounded-full px-5 py-2.5 text-sm font-medium transition-all duration-200 border-2
                ${showNewPageForm
                  ? 'bg-green-500 text-white border-green-500 shadow-lg'
                  : 'bg-white text-green-600 border-green-500 hover:bg-green-500 hover:text-white shadow-md hover:shadow-lg'
                }
              `}
            >
              {showNewPageForm ? '× 閉じる' : '+ 新規作成'}
            </button>
          </div>

          {/* 新規作成フォーム */}
          {showNewPageForm && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 p-4 shadow-inner">
              <span className="text-sm font-semibold text-green-800">作成日:</span>
              <input
                type="date"
                value={newPageDate}
                max="9999-12-31"
                onChange={(e) => onNewPageDateChange(e.target.value)}
                className="rounded-md border-2 border-green-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreatePage}
                  className="rounded-md bg-green-500 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-green-600 hover:scale-105 shadow-md"
                >
                  作成
                </button>
                <button
                  onClick={() => setShowNewPageForm(false)}
                  className="rounded-md bg-gray-400 px-3 py-2 text-sm font-medium text-white transition-all hover:bg-gray-500 shadow-md"
                >
                  キャンセル
                </button>
              </div>
            </div>
          )}
        </div>

        {/* エラーメッセージ */}
        {(localMessage || error) && (
          <div className="mt-4 rounded-lg bg-red-50 border-2 border-red-200 p-4 shadow-inner">
            <div className="flex items-center gap-2">
              <span className="text-red-500 text-lg">⚠</span>
              <p className="text-sm text-red-700 font-medium">{localMessage || error}</p>
            </div>
          </div>
        )}

        {/* 日付未選択時のメッセージ */}
        {!selectedDate && pageDates.length > 0 && (
          <div className="mt-4 rounded-lg bg-blue-50 border-2 border-blue-200 p-4 text-center shadow-inner">
            <p className="text-sm text-blue-700 font-medium">
              📅 日付タブを選択してコメントを編集してください
            </p>
          </div>
        )}

        {/* コメントページなし時のメッセージ */}
        {!selectedDate && pageDates.length === 0 && (
          <div className="mt-4 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-6 text-center">
            <div className="text-gray-400 text-3xl mb-2">📝</div>
            <p className="text-sm text-gray-600 mb-2 font-medium">
              コメントページがありません
            </p>
            <p className="text-xs text-gray-500">
              「+ 新規作成」ボタンから最初のページを作成してください
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default DateManager;