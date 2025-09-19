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

  // 日付を降順（新しい順）でソート
  const pageDates = commentPages
    .map(p => p.comment_date)
    .sort((a, b) => b.localeCompare(a));

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
          </div>
          {loading && (
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
              <span className="text-blue-600 font-medium">読み込み中</span>
            </div>
          )}
        </div>

        {/* 日付選択とアクション */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            {pageDates.length === 0 ? (
              <div className="text-sm text-gray-500 py-2">コメントページがありません</div>
            ) : (
              <div className="flex items-center gap-3">
                {/* 日付プルダウン */}
                <div className="relative">
                  <select
                    value={selectedDate || ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        onSelectDate(e.target.value);
                      }
                    }}
                    className="appearance-none bg-blue-50 border-2 border-blue-400 text-blue-700 font-medium rounded-lg px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer hover:bg-blue-100 transition-colors min-w-[200px]"
                    aria-label="コメント日付を選択"
                  >
                    <option value="" disabled>
                      日付を選択
                    </option>
                    {pageDates.map(date => (
                      <option key={date} value={date}>
                        {formatDateLabel(date)}
                        {date === latestDate ? ' (最新)' : ''}
                      </option>
                    ))}
                  </select>
                  {/* カスタム矢印アイコン */}
                  <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
                    <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* 削除ボタン（選択中の日付がある場合のみ表示） */}
                {selectedDate && (
                  <button
                    onClick={() => onDeletePage()}
                    className="flex items-center gap-1 rounded-lg bg-red-50 border-2 border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100 hover:border-red-400 transition-all"
                    title={`${formatDateLabel(selectedDate)}を削除`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span>削除</span>
                  </button>
                )}
              </div>
            )}

            {/* 新規作成ボタン */}
            <button
              onClick={() => setShowNewPageForm(!showNewPageForm)}
              className={`
                rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200 border-2
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
              日付を選択してコメントを編集してください
            </p>
          </div>
        )}

        {/* コメントページなし時のメッセージ */}
        {!selectedDate && pageDates.length === 0 && (
          <div className="mt-4 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-6 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
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