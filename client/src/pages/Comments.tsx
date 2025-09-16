import { useEffect, useMemo, useRef, useState } from 'react';
import type { AxiosError } from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import { useScheduleStore } from '../store/useScheduleStore';
import { useCommentStore } from '../store/useCommentStore';
import type { CommentEntry, Schedule } from '../types';
import MilestoneBoard from '../components/MilestoneBoard';

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const fullDateFormatter = new Intl.DateTimeFormat('ja-JP');
const shortDateFormatter = new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' });

function groupByOwner(comments: CommentEntry[]): Record<string, CommentEntry[]> {
  return comments.reduce((acc, c) => {
    if (!acc[c.owner]) acc[c.owner] = [];
    acc[c.owner].push(c);
    return acc;
  }, {} as Record<string, CommentEntry[]>);
}

const formatDateLabel = (date: string | null | undefined, formatter = fullDateFormatter) => {
  if (!date || !isoDatePattern.test(date)) return '—';
  return formatter.format(new Date(`${date}T00:00:00`));
};

function CommentsPage() {
  const { projectId, date: routeDate } = useParams<{ projectId: string; date?: string }>();
  const navigate = useNavigate();
  const pid = projectId ? Number.parseInt(projectId, 10) : NaN;

  const { projects, currentProject, schedules, fetchProjects, fetchSchedules, selectProject } = useScheduleStore();
  const {
    comments,
    commentPages,
    latestDate,
    loading,
    error,
    fetchCommentPages,
    fetchComments,
    createCommentPage,
    deleteCommentPage,
    upsertComment,
    connectSocket,
    disconnectSocket,
  } = useCommentStore();

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [ownerFilter, setOwnerFilter] = useState('');
  const [fixedLeft, setFixedLeft] = useState<string[] | null>(null);
  const [fixedRight, setFixedRight] = useState<string[] | null>(null);
  const [OVERALL_KEY, setOverallKey] = useState<string>('__OVERALL__');
  const [overallLabel, setOverallLabel] = useState<string>('全体報告');
  const [newPageDate, setNewPageDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [localMessage, setLocalMessage] = useState<string | null>(null);

  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const selectedDate = routeDate && isoDatePattern.test(routeDate) ? routeDate : '';
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  useEffect(() => {
    if (!projectId || Number.isNaN(pid)) {
      navigate('/projects');
      return;
    }
    let disposed = false;
    const load = async () => {
      await fetchProjects();
      await fetchSchedules(pid);
      try {
        await fetchCommentPages(pid);
      } catch (e) {
        if (!disposed) console.error('Failed to load comment pages', e);
      }
      try {
        const res = await fetch('/progress-manager/api/comments/sections');
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json?.left) && json.left.length) setFixedLeft(json.left);
          if (Array.isArray(json?.right) && json.right.length) setFixedRight(json.right);
          if (typeof json?.overallKey === 'string') setOverallKey(json.overallKey);
          if (typeof json?.overallLabel === 'string') setOverallLabel(json.overallLabel);
        }
      } catch (e) {
        console.warn('sections load failed', e);
      }
      setFixedLeft(prev => prev ?? ['全体報告', 'デザイン', 'メカ', 'ハード', 'ゲージ', 'プロマネ'].filter(x => x !== '全体報告'));
      setFixedRight(prev => prev ?? ['企画', '画像', '出玉', 'サブ', 'メイン']);
    };
    load();
    return () => {
      disposed = true;
      disconnectSocket();
    };
  }, [projectId, pid, fetchProjects, fetchSchedules, fetchCommentPages, disconnectSocket, navigate]);

  useEffect(() => {
    if (projects.length > 0 && pid) {
      const proj = projects.find(p => p.id === pid);
      if (proj && (!currentProject || currentProject.id !== proj.id)) selectProject(proj);
    }
  }, [projects, pid, currentProject, selectProject]);

  useEffect(() => {
    if (selectedDate) setNewPageDate(selectedDate);
    else setNewPageDate(today);
  }, [selectedDate, today]);

  useEffect(() => {
    if (!projectId || Number.isNaN(pid)) return;
    if (commentPages.length === 0) {
      if (selectedDate) navigate(`/comments/${projectId}`, { replace: true });
      return;
    }
    const latest = commentPages[0]?.comment_date;
    if (!selectedDate) {
      if (latest) navigate(`/comments/${projectId}/${latest}`, { replace: true });
      return;
    }
    const exists = commentPages.some(p => p.comment_date === selectedDate);
    if (!exists && latest) {
      navigate(`/comments/${projectId}/${latest}`, { replace: true });
    }
  }, [commentPages, projectId, pid, selectedDate, navigate]);

  useEffect(() => {
    if (!projectId || Number.isNaN(pid) || !selectedDate) return;
    let cancelled = false;
    const load = async () => {
      try {
        await fetchComments(pid, selectedDate);
        if (!cancelled) setLocalMessage(null);
      } catch (e) {
        if (cancelled) return;
        const status = (e as AxiosError)?.response?.status;
        if (status === 404) {
          setLocalMessage('指定した日付のコメントページが存在しません。新規作成してください。');
        } else {
          setLocalMessage('コメントの取得に失敗しました。');
        }
      }
    };
    load();
    connectSocket(pid, selectedDate);
    return () => {
      cancelled = true;
    };
  }, [projectId, pid, selectedDate, fetchComments, connectSocket]);

  const ownersLeft = useMemo(() => {
    let list: string[] = fixedLeft ?? [];
    if (!list.length) {
      const dyn = Array.from(new Set(schedules.map(s => (s.owner || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ja'));
      list = dyn.slice(0, Math.ceil(dyn.length / 2));
    }
    if (ownerFilter.trim()) list = list.filter(o => o.includes(ownerFilter.trim()));
    return list;
  }, [fixedLeft, schedules, ownerFilter]);

  const ownersRight = useMemo(() => {
    let list: string[] = fixedRight ?? [];
    if (!list.length) {
      const dyn = Array.from(new Set(schedules.map(s => (s.owner || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ja'));
      list = dyn.slice(Math.ceil(dyn.length / 2));
    }
    if (ownerFilter.trim()) list = list.filter(o => o.includes(ownerFilter.trim()));
    return list;
  }, [fixedRight, schedules, ownerFilter]);

  const commentsByOwner = useMemo(() => groupByOwner(comments), [comments]);

  const milestone = useMemo(() => {
    const dates = schedules.reduce(
      (acc, s) => {
        if (s.start_date) acc.minStart = acc.minStart ? (acc.minStart < s.start_date ? acc.minStart : s.start_date) : s.start_date;
        if (s.end_date) acc.maxEnd = acc.maxEnd ? (acc.maxEnd > s.end_date ? acc.maxEnd : s.end_date) : s.end_date;
        return acc;
      },
      { minStart: undefined as string | undefined, maxEnd: undefined as string | undefined }
    );
    return {
      base: currentProject?.base_date,
      start: dates.minStart,
      end: dates.maxEnd,
    };
  }, [schedules, currentProject]);

  const keyOf = (owner: string, date: string) => `${owner}|${date}`;
  const canEdit = Boolean(selectedDate && !Number.isNaN(pid));

  const handleChange = (owner: string, value: string) => {
    if (!selectedDate) return;
    setDrafts(prev => ({ ...prev, [keyOf(owner, selectedDate)]: value }));
  };

  const scheduleSave = (owner: string, value: string) => {
    if (!selectedDate || Number.isNaN(pid)) return;
    const tkey = keyOf(owner, selectedDate);
    const map = timersRef.current;
    const existing = map.get(tkey);
    if (existing) clearTimeout(existing);
    setSaving(prev => ({ ...prev, [tkey]: true }));
    const timeoutId = setTimeout(async () => {
      try {
        await upsertComment({ project_id: pid, owner, body: value, comment_date: selectedDate });
      } finally {
        setSaving(prev => ({ ...prev, [tkey]: false }));
      }
    }, 1000);
    map.set(tkey, timeoutId);
  };

  const getValueForSelected = (owner: string) => {
    if (!selectedDate) return '';
    const key = keyOf(owner, selectedDate);
    const draft = drafts[key];
    if (typeof draft === 'string') return draft;
    const found = commentsByOwner[owner]?.find(c => c.comment_date === selectedDate);
    return found?.body ?? '';
  };

  const handleSelectDate = (value: string) => {
    if (!projectId || !isoDatePattern.test(value)) return;
    navigate(`/comments/${projectId}/${value}`);
  };

  const handleCreatePage = async () => {
    if (!projectId || Number.isNaN(pid) || !isoDatePattern.test(newPageDate)) {
      setLocalMessage('日付を正しく選択してください。');
      return;
    }
    try {
      await createCommentPage(pid, newPageDate);
      setLocalMessage(null);
      navigate(`/comments/${projectId}/${newPageDate}`);
    } catch (e) {
      const status = (e as AxiosError)?.response?.status;
      if (status === 409) {
        setLocalMessage('既に同じ日付のコメントページが存在します。');
      } else {
        setLocalMessage('コメントページの作成に失敗しました。');
      }
    }
  };

  const handleDeletePage = async () => {
    if (!projectId || Number.isNaN(pid) || !selectedDate) return;
    const confirmed = window.confirm(`${formatDateLabel(selectedDate)}版のコメントページを削除します。よろしいですか？`);
    if (!confirmed) return;
    try {
      await deleteCommentPage(pid, selectedDate);
      setLocalMessage('コメントページを削除しました。');
    } catch (e) {
      console.error('delete comment page error', e);
      setLocalMessage('コメントページの削除に失敗しました。');
    }
  };

  const pageDates = useMemo(() => commentPages.map(p => p.comment_date), [commentPages]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{currentProject?.name || `プロジェクト ${projectId}`}</h1>
          <div className="mt-1 flex flex-wrap gap-3 text-sm text-gray-700">
            <span className="bg-blue-50 px-2 py-0.5 rounded">基準日: {formatDateLabel(milestone.base)}</span>
            <span className="bg-gray-50 px-2 py-0.5 rounded">予定開始: {formatDateLabel(milestone.start)}</span>
            <span className="bg-gray-50 px-2 py-0.5 rounded">予定完了: {formatDateLabel(milestone.end)}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate(`/schedule/${projectId}`)} className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md transition-colors">進捗管理表へ</button>
          <button onClick={() => navigate('/projects')} className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md transition-colors">製番一覧へ</button>
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-700">
          <span>最新進捗日: {formatDateLabel(latestDate, shortDateFormatter)}</span>
          {selectedDate && latestDate && selectedDate !== latestDate && (
            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">表示中: {formatDateLabel(selectedDate, shortDateFormatter)}</span>
          )}
          {loading && <span className="text-xs text-blue-600">読み込み中…</span>}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {pageDates.length === 0 ? (
            <span className="text-sm text-gray-600">まだコメントページがありません。日付を選択して作成してください。</span>
          ) : (
            pageDates.map(date => (
              <button
                key={date}
                onClick={() => handleSelectDate(date)}
                className={`px-3 py-1 text-sm rounded-md border transition-colors ${date === selectedDate ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'}`}
              >
                {formatDateLabel(date, shortDateFormatter)}
              </button>
            ))
          )}
        </div>
        <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center">
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={newPageDate}
              max="9999-12-31"
              onChange={(e) => setNewPageDate(e.target.value)}
              className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleCreatePage}
              className="bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-md text-sm transition-colors"
            >
              {`${formatDateLabel(newPageDate, shortDateFormatter)}バージョンのコメントページを新規作成`}
            </button>
          </div>
          <div className="flex items-center gap-2 md:ml-auto">
            <label className="text-sm text-gray-700">担当フィルタ</label>
            <input
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              placeholder="例: 佐藤"
              className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {selectedDate && (
            <button
              onClick={handleDeletePage}
              className="text-sm text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-md border border-red-200 transition-colors"
            >
              {`${formatDateLabel(selectedDate, shortDateFormatter)}バージョンを削除`}
            </button>
          )}
        </div>
        {(localMessage || error) && (
          <div className="mt-3 text-sm text-red-600">{localMessage || error}</div>
        )}
      </div>

      {selectedDate ? (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700">対象日</label>
            <input
              type="date"
              value={selectedDate}
              max="9999-12-31"
              onChange={(e) => handleSelectDate(e.target.value)}
              className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      ) : (
        <div className="mb-6 rounded-md border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
          日付ページを選択または作成するとコメントを編集できます。
        </div>
      )}

      {schedules.some((s: Schedule) => (s.category || '').trim() === 'マイルストーン') && (
        <MilestoneBoard
          items={schedules
            .filter(s => (s.category || '').trim() === 'マイルストーン')
            .map(s => ({ id: s.id, name: s.item, date: s.start_date }))}
        />
      )}

      <div className="mb-6 mt-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow-md hover:shadow-lg transition-shadow p-5 border border-blue-200">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-blue-900">{overallLabel}</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">{formatDateLabel(selectedDate)} のコメント</span>
            {selectedDate && saving[keyOf(OVERALL_KEY, selectedDate)] && (
              <span className="text-xs text-blue-600">保存中…</span>
            )}
          </div>
        </div>
        <textarea
          className={`w-full min-h-[160px] border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 ${!canEdit ? 'bg-gray-100 cursor-not-allowed' : ''}`}
          placeholder="全体の進捗・課題・リスク・支援要請などを記入"
          value={getValueForSelected(OVERALL_KEY)}
          onChange={(e) => {
            handleChange(OVERALL_KEY, e.target.value);
            scheduleSave(OVERALL_KEY, e.target.value);
          }}
          disabled={!canEdit}
        />
      </div>

      {(ownersLeft.length === 0 && ownersRight.length === 0) ? (
        <div className="text-gray-600">担当が未登録です。進捗管理表で担当を設定してください。</div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-6">
            {ownersLeft.map(owner => (
              <div key={`L-${owner}`} className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold text-gray-800">{owner}</h2>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{formatDateLabel(selectedDate)} のコメント</span>
                    {selectedDate && saving[keyOf(owner, selectedDate)] && (
                      <span className="text-xs text-blue-600">保存中…</span>
                    )}
                  </div>
                </div>
                <textarea
                  className={`w-full min-h-[96px] border border-gray-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${!canEdit ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                  placeholder="本日の進捗・課題・所要支援などを記入"
                  value={getValueForSelected(owner)}
                  onChange={(e) => {
                    handleChange(owner, e.target.value);
                    scheduleSave(owner, e.target.value);
                  }}
                  disabled={!canEdit}
                />
              </div>
            ))}
          </div>
          <div className="space-y-6">
            {ownersRight.map(owner => (
              <div key={`R-${owner}`} className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold text-gray-800">{owner}</h2>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{formatDateLabel(selectedDate)} のコメント</span>
                    {selectedDate && saving[keyOf(owner, selectedDate)] && (
                      <span className="text-xs text-blue-600">保存中…</span>
                    )}
                  </div>
                </div>
                <textarea
                  className={`w-full min-h-[96px] border border-gray-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${!canEdit ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                  placeholder="本日の進捗・課題・所要支援などを記入"
                  value={getValueForSelected(owner)}
                  onChange={(e) => {
                    handleChange(owner, e.target.value);
                    scheduleSave(owner, e.target.value);
                  }}
                  disabled={!canEdit}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default CommentsPage;
