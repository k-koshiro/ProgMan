import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useScheduleStore } from '../store/useScheduleStore';
import { useCommentStore } from '../store/useCommentStore';
import type { CommentEntry, Schedule } from '../types';
import MilestoneBoard from '../components/MilestoneBoard';

function groupByOwner(comments: CommentEntry[]): Record<string, CommentEntry[]> {
  return comments.reduce((acc, c) => {
    acc[c.owner] = acc[c.owner] || [];
    acc[c.owner].push(c);
    return acc;
  }, {} as Record<string, CommentEntry[]>);
}

function CommentsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const pid = projectId ? parseInt(projectId) : NaN;

  const { projects, currentProject, schedules, fetchProjects, fetchSchedules, selectProject } = useScheduleStore();
  const { comments, fetchComments, upsertComment, connectSocket, disconnectSocket } = useCommentStore();

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [ownerFilter, setOwnerFilter] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const timersRef = useRef<Map<string, any>>(new Map());
  const [fixedLeft, setFixedLeft] = useState<string[] | null>(null);
  const [fixedRight, setFixedRight] = useState<string[] | null>(null);
  const [OVERALL_KEY, setOverallKey] = useState<string>('__OVERALL__');
  const [overallLabel, setOverallLabel] = useState<string>('全体報告');

  useEffect(() => {
    if (!projectId || Number.isNaN(pid)) {
      navigate('/projects');
      return;
    }
    const load = async () => {
      await fetchProjects();
      await fetchSchedules(pid);
      await fetchComments(pid);
      connectSocket();
      // 固定セクションの取得
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
      // サーバー未設定時は固定デフォルトを適用
      setFixedLeft(prev => prev ?? ['全体報告','デザイン','メカ','ハード','ゲージ','プロマネ'].filter(x => x !== '全体報告'));
      setFixedRight(prev => prev ?? ['企画','画像','出玉','サブ','メイン']);
    };
    load();
    return () => disconnectSocket();
  }, [projectId]);

  useEffect(() => {
    if (projects.length > 0 && pid) {
      const proj = projects.find(p => p.id === pid);
      if (proj && (!currentProject || currentProject.id !== proj.id)) selectProject(proj);
    }
  }, [projects, pid]);

  // 固定があれば左右のセクションをその順で表示
  const ownersLeft = useMemo(() => {
    let list: string[] = fixedLeft ?? [];
    if (!list.length) {
      const dyn = Array.from(new Set(schedules.map(s => (s.owner || '').trim()).filter(Boolean))).sort((a,b)=>a.localeCompare(b,'ja'));
      list = dyn.slice(0, Math.ceil(dyn.length/2));
    }
    if (ownerFilter.trim()) list = list.filter(o => o.includes(ownerFilter.trim()));
    return list;
  }, [fixedLeft, schedules, ownerFilter]);

  const ownersRight = useMemo(() => {
    let list: string[] = fixedRight ?? [];
    if (!list.length) {
      const dyn = Array.from(new Set(schedules.map(s => (s.owner || '').trim()).filter(Boolean))).sort((a,b)=>a.localeCompare(b,'ja'));
      list = dyn.slice(Math.ceil(dyn.length/2));
    }
    if (ownerFilter.trim()) list = list.filter(o => o.includes(ownerFilter.trim()));
    return list;
  }, [fixedRight, schedules, ownerFilter]);

  const commentsByOwner = useMemo(() => groupByOwner(comments), [comments]);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // 直近の日付一覧（コメント履歴から抽出）
  const recentDates = useMemo(() => {
    const ds = new Set<string>(comments.map(c => c.comment_date));
    ds.add(today);
    return Array.from(ds).sort((a,b) => (a < b ? 1 : -1)).slice(0, 14);
  }, [comments, today]);

  // コメントページ上部に表示するマイルストーン（進捗表の「マイルストーン」カテゴリ）
  const milestoneBoardItems = useMemo(() => {
    return schedules
      .filter(s => (s.category || '').trim() === 'マイルストーン')
      .map(s => ({ id: s.id, name: s.item, date: s.start_date }));
  }, [schedules]);

  // overallRange は不要になったが将来の補助に残す場合はここで維持可

  // マイルストーン: 基準日、最小開始、最大終了
  const milestone = useMemo(() => {
    const dates = schedules.reduce((acc, s) => {
      if (s.start_date) acc.minStart = acc.minStart ? (acc.minStart < s.start_date ? acc.minStart : s.start_date) : s.start_date;
      if (s.end_date) acc.maxEnd = acc.maxEnd ? (acc.maxEnd > s.end_date ? acc.maxEnd : s.end_date) : s.end_date;
      return acc;
    }, { minStart: undefined as string | undefined, maxEnd: undefined as string | undefined });
    return {
      base: currentProject?.base_date,
      start: dates.minStart,
      end: dates.maxEnd,
    };
  }, [schedules, currentProject]);

  const keyOf = (owner: string, date: string) => `${owner}|${date}`;

  const handleChange = (owner: string, value: string) => {
    setDrafts(prev => ({ ...prev, [keyOf(owner, selectedDate)]: value }));
  };

  // 入力完了で自動保存（1秒デバウンス）
  const scheduleSave = (owner: string, value: string) => {
    const tkey = keyOf(owner, selectedDate);
    const map = timersRef.current;
    if (map.has(tkey)) clearTimeout(map.get(tkey));
    setSaving(prev => ({ ...prev, [tkey]: true }));
    const t = setTimeout(async () => {
      if (!Number.isNaN(pid)) {
        await upsertComment({ project_id: pid, owner, body: value, comment_date: selectedDate });
      }
      setSaving(prev => ({ ...prev, [tkey]: false }));
    }, 1000);
    map.set(tkey, t);
  };

  const getValueForSelected = (owner: string) => {
    const found = commentsByOwner[owner]?.find(c => c.comment_date === selectedDate);
    return drafts[keyOf(owner, selectedDate)] ?? found?.body ?? '';
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{currentProject?.name || `プロジェクト ${projectId}`}</h1>
          <div className="flex gap-3 text-sm text-gray-700 mt-1">
            <span className="bg-blue-50 px-2 py-0.5 rounded">基準日: {milestone.base ? new Date(milestone.base).toLocaleDateString('ja-JP') : '—'}</span>
            <span className="bg-gray-50 px-2 py-0.5 rounded">予定開始: {milestone.start ? new Date(milestone.start).toLocaleDateString('ja-JP') : '—'}</span>
            <span className="bg-gray-50 px-2 py-0.5 rounded">予定完了: {milestone.end ? new Date(milestone.end).toLocaleDateString('ja-JP') : '—'}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate(`/schedule/${projectId}`)} className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded">進捗管理表へ</button>
          <button onClick={() => navigate('/projects')} className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded">製番一覧へ</button>
        </div>
      </div>

      {/* 日付切替＆フィルタ */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-700">対象日</label>
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="px-2 py-1 text-sm border border-gray-300 rounded" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-700">最近</span>
          <div className="flex flex-wrap gap-1">
            {recentDates.map(d => (
              <button key={d} onClick={() => setSelectedDate(d)} className={`px-2 py-0.5 text-xs rounded ${d===selectedDate? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                {new Date(d).toLocaleDateString('ja-JP')}
              </button>
            ))}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <label className="text-sm text-gray-700">担当フィルタ</label>
          <input value={ownerFilter} onChange={e=>setOwnerFilter(e.target.value)} placeholder="例: 佐藤" className="px-2 py-1 text-sm border border-gray-300 rounded" />
        </div>
      </div>


      {/* マイルストーン（コメント画面上部） */}
      {milestoneBoardItems.length > 0 && (
        <MilestoneBoard items={milestoneBoardItems} />
      )}

      {/* 全体報告 */}
      <div className="mb-6 bg-white rounded-lg shadow p-5 border border-indigo-100">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-gray-900">{overallLabel}</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">{new Date(selectedDate).toLocaleDateString('ja-JP')} のコメント</span>
            {saving[keyOf(OVERALL_KEY, selectedDate)] && (
              <span className="text-xs text-blue-600">保存中…</span>
            )}
          </div>
        </div>
        <textarea
          className="w-full min-h-[160px] border border-gray-300 rounded p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="全体の進捗・課題・リスク・支援要請などを記入"
          value={getValueForSelected(OVERALL_KEY)}
          onChange={(e) => { handleChange(OVERALL_KEY, e.target.value); scheduleSave(OVERALL_KEY, e.target.value); }}
        />
        {commentsByOwner[OVERALL_KEY]?.filter(c => c.comment_date !== selectedDate).length ? (
          <div className="mt-3">
            <div className="text-sm text-gray-600 mb-1">履歴</div>
            <div className="space-y-2 max-h-48 overflow-auto">
              {commentsByOwner[OVERALL_KEY]
                .filter(c => c.comment_date !== selectedDate)
                .map(c => (
                  <div key={`${c.owner}-${c.comment_date}-${c.id}`} className="border border-gray-200 rounded p-2">
                    <div className="text-xs text-gray-500 mb-1">{new Date(c.comment_date).toLocaleDateString('ja-JP')} のコメント</div>
                    <pre className="whitespace-pre-wrap text-sm text-gray-800">{c.body}</pre>
                  </div>
                ))}
            </div>
          </div>
        ) : null}
      </div>

      {(ownersLeft.length === 0 && ownersRight.length === 0) ? (
        <div className="text-gray-600">担当が未登録です。進捗管理表で担当を設定してください。</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-6">
            {ownersLeft.map(owner => (
              <div key={`L-${owner}`} className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold text-gray-800">{owner}</h2>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{new Date(selectedDate).toLocaleDateString('ja-JP')} のコメント</span>
                    {saving[keyOf(owner, selectedDate)] && (
                      <span className="text-xs text-blue-600">保存中…</span>
                    )}
                  </div>
                </div>
                <textarea
                  className="w-full min-h-[96px] border border-gray-300 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="本日の進捗・課題・所要支援などを記入"
                  value={getValueForSelected(owner)}
                  onChange={(e) => { handleChange(owner, e.target.value); scheduleSave(owner, e.target.value); }}
                />
                {commentsByOwner[owner]?.filter(c => c.comment_date !== selectedDate).length ? (
                  <div className="mt-3">
                    <div className="text-sm text-gray-600 mb-1">履歴</div>
                    <div className="space-y-2 max-h-48 overflow-auto">
                      {commentsByOwner[owner]
                        .filter(c => c.comment_date !== selectedDate)
                        .map(c => (
                          <div key={`${c.owner}-${c.comment_date}-${c.id}`} className="border border-gray-200 rounded p-2">
                            <div className="text-xs text-gray-500 mb-1">{new Date(c.comment_date).toLocaleDateString('ja-JP')} のコメント</div>
                            <pre className="whitespace-pre-wrap text-sm text-gray-800">{c.body}</pre>
                          </div>
                        ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          <div className="space-y-6">
            {ownersRight.map(owner => (
              <div key={`R-${owner}`} className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold text-gray-800">{owner}</h2>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{new Date(selectedDate).toLocaleDateString('ja-JP')} のコメント</span>
                    {saving[keyOf(owner, selectedDate)] && (
                      <span className="text-xs text-blue-600">保存中…</span>
                    )}
                  </div>
                </div>
                <textarea
                  className="w-full min-h-[96px] border border-gray-300 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="本日の進捗・課題・所要支援などを記入"
                  value={getValueForSelected(owner)}
                  onChange={(e) => { handleChange(owner, e.target.value); scheduleSave(owner, e.target.value); }}
                />
                {commentsByOwner[owner]?.filter(c => c.comment_date !== selectedDate).length ? (
                  <div className="mt-3">
                    <div className="text-sm text-gray-600 mb-1">履歴</div>
                    <div className="space-y-2 max-h-48 overflow-auto">
                      {commentsByOwner[owner]
                        .filter(c => c.comment_date !== selectedDate)
                        .map(c => (
                          <div key={`${c.owner}-${c.comment_date}-${c.id}`} className="border border-gray-200 rounded p-2">
                            <div className="text-xs text-gray-500 mb-1">{new Date(c.comment_date).toLocaleDateString('ja-JP')} のコメント</div>
                            <pre className="whitespace-pre-wrap text-sm text-gray-800">{c.body}</pre>
                          </div>
                        ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default CommentsPage;
