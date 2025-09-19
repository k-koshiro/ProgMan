import { useEffect, useMemo, useRef, useState } from 'react';
import type { AxiosError } from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import { useScheduleStore } from '../store/useScheduleStore';
import { useCommentStore } from '../store/useCommentStore';
import type { CommentEntry, ProgressStatus } from '../types';
import MilestoneBoard from '../components/MilestoneBoard';
import DateManager from '../components/DateManager';

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const fullDateFormatter = new Intl.DateTimeFormat('ja-JP');

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

// 進捗状態の設定
const progressOptions: Array<{ value: ProgressStatus; label: string; bgColor: string; borderColor: string; textColor: string }> = [
  { value: 'smooth', label: '順調', bgColor: 'bg-cyan-100', borderColor: 'border-cyan-400', textColor: 'text-cyan-900' },
  { value: 'caution', label: '注意', bgColor: 'bg-yellow-100', borderColor: 'border-yellow-400', textColor: 'text-yellow-900' },
  { value: 'danger', label: '危険', bgColor: 'bg-red-100', borderColor: 'border-red-400', textColor: 'text-red-900' },
  { value: 'idle', label: '無作業', bgColor: 'bg-gray-50', borderColor: 'border-gray-300', textColor: 'text-gray-700' },
];

const getProgressStyle = (status: ProgressStatus | undefined) => {
  const option = progressOptions.find(opt => opt.value === (status || 'idle'));
  return option || progressOptions[3]; // デフォルトは無作業
};

const DEFAULT_LEFT_SECTIONS = ['出玉', 'デザイン', 'メカ', 'ハード', 'ゲージ'];
const DEFAULT_RIGHT_SECTIONS = ['企画', '画像', 'サブソフト', 'メインソフト', 'サウンド'];

const normalizeSectionName = (name: string) => {
  const trimmed = name.trim();
  if (!trimmed) return '';
  if (trimmed === 'メイン') return 'メインソフト';
  if (trimmed === 'サブ') return 'サブソフト';
  if (trimmed === 'デバック' || trimmed === 'デバッグ') return 'サブソフト';
  return trimmed;
};

function CommentsPage() {
  const { projectId, date: routeDate } = useParams<{ projectId: string; date?: string }>();
  const navigate = useNavigate();
  const pid = projectId ? Number.parseInt(projectId, 10) : NaN;

  const { projects, currentProject, schedules, fetchProjects, fetchSchedules, selectProject } = useScheduleStore();
  const {
    comments,
    commentPages,
    categoryProgress,
    latestDate,
    loading,
    error,
    fetchCommentPages,
    fetchComments,
    fetchCategoryProgress,
    updateCategoryProgress,
    createCommentPage,
    deleteCommentPage,
    upsertComment,
    connectSocket,
    disconnectSocket,
  } = useCommentStore();

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [fixedLeft, setFixedLeft] = useState<string[]>(DEFAULT_LEFT_SECTIONS);
  const [fixedRight, setFixedRight] = useState<string[]>(DEFAULT_RIGHT_SECTIONS);
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
        await fetchCategoryProgress(pid, selectedDate);
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
  }, [projectId, pid, selectedDate, fetchComments, fetchCategoryProgress, connectSocket]);

  const commentsByOwner = useMemo(() => groupByOwner(comments), [comments]);

  // カテゴリごとの担当者一覧を構築
  const categoryOwnersMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    const excludedCategories = ['プロマネ', '検査技術', '企画システム'];

    schedules.forEach(schedule => {
      const normalizedCategory = normalizeSectionName(schedule.category || '');
      if (!normalizedCategory || normalizedCategory === 'マイルストーン' || normalizedCategory === OVERALL_KEY || normalizedCategory === overallLabel) {
        return;
      }

      if (excludedCategories.includes(normalizedCategory)) return;

      const owner = (schedule.owner || '').trim();
      if (!map.has(normalizedCategory)) {
        map.set(normalizedCategory, new Set());
      }
      if (owner) {
        map.get(normalizedCategory)?.add(owner);
      }
    });

    const result: Record<string, string[]> = {};
    map.forEach((owners, category) => {
      result[category] = Array.from(owners).sort((a, b) => a.localeCompare(b, 'ja'));
    });
    return result;
  }, [schedules, OVERALL_KEY, overallLabel]);

  const sectionLists = useMemo(() => {
    const excludedCategories = ['プロマネ', '検査技術', '企画システム'];
    const rightOrder = DEFAULT_RIGHT_SECTIONS;

    const sanitize = (input: string[] | null | undefined) => {
      const normalizedList: string[] = [];
      (input ?? []).forEach(rawName => {
        const name = normalizeSectionName(rawName);
        if (!name || name === OVERALL_KEY || name === overallLabel) return;
        if (excludedCategories.includes(name)) return;
        if (!normalizedList.includes(name)) normalizedList.push(name);
      });
      return normalizedList;
    };

    let baseLeft = sanitize(fixedLeft);
    const orderedLeft: string[] = [];
    DEFAULT_LEFT_SECTIONS.forEach(name => {
      if (!orderedLeft.includes(name)) orderedLeft.push(name);
    });
    baseLeft
      .filter(name => !DEFAULT_LEFT_SECTIONS.includes(name))
      .forEach(name => {
        if (!orderedLeft.includes(name)) orderedLeft.push(name);
      });
    baseLeft = orderedLeft;

    let baseRight = sanitize(fixedRight);

    if (baseRight.length === 0) {
      baseRight = [...rightOrder];
    } else {
      const orderedItems: string[] = [];
      const remainingItems: string[] = [];

      baseRight.forEach(item => {
        if (rightOrder.includes(item)) {
          orderedItems.push(item);
        } else {
          remainingItems.push(item);
        }
      });

      const sortedOrderedItems = rightOrder.filter(item => orderedItems.includes(item));
      baseRight = [...sortedOrderedItems, ...remainingItems];

      rightOrder.forEach(item => {
        if (!baseRight.includes(item)) {
          baseRight.push(item);
        }
      });
    }

    const ensureSection = (section: string) => {
      const name = normalizeSectionName(section);
      if (!name || name === OVERALL_KEY || name === overallLabel) return;
      if (excludedCategories.includes(name)) return;
      if (baseLeft.includes(name) || baseRight.includes(name)) return;

      if (rightOrder.includes(name)) {
        const index = rightOrder.indexOf(name);
        const insertPosition = baseRight.findIndex(item => rightOrder.indexOf(item) > index);
        if (insertPosition === -1) {
          baseRight.push(name);
        } else {
          baseRight.splice(insertPosition, 0, name);
        }
      } else if (baseLeft.length <= baseRight.length) {
        baseLeft.push(name);
      } else {
        baseRight.push(name);
      }
    };

    const scheduleCategories = Array.from(new Set(
      schedules
        .map(s => normalizeSectionName(s.category || ''))
        .filter(category => category && category !== 'マイルストーン' && !excludedCategories.includes(category))
    ));

    scheduleCategories.forEach(ensureSection);

    Object.keys(commentsByOwner).forEach(owner => {
      const mappedOwner = normalizeSectionName(owner);
      if (!mappedOwner || excludedCategories.includes(mappedOwner)) return;
      ensureSection(mappedOwner);
    });

    return { left: baseLeft, right: baseRight };
  }, [fixedLeft, fixedRight, schedules, commentsByOwner, OVERALL_KEY, overallLabel]);

  const { left: sectionListsLeft, right: sectionListsRight } = sectionLists;

  const sectionsLeft = sectionListsLeft;
  const sectionsRight = sectionListsRight;

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

  const handleProgressChange = async (category: string, status: ProgressStatus) => {
    if (!selectedDate || Number.isNaN(pid)) return;
    try {
      await updateCategoryProgress(pid, category, selectedDate, status);
    } catch (e) {
      console.error('progress update error', e);
    }
  };

  const getCategoryProgress = (category: string): ProgressStatus => {
    if (!selectedDate) return 'idle';
    const progress = categoryProgress.find(
      p => p.category === category && p.progress_date === selectedDate
    );
    return progress?.status || 'idle';
  };


  const milestoneBoardSection = useMemo(() => {
    // 固定表示する14項目（スクリーンショットの並び順に準拠）
    const fixedItems = [
      '開発着手',
      '開発キックオフ',
      '経営キックオフ',
      'G1',
      '試作確認会',
      '画像/サウンド実装スケ作成',
      '4カ月スケ作成',
      'G2',
      'PJ試射',
      '本部内試射',
      'パラサミ試射１/営業試射１',
      'パラサミ試射２/営業試射２',
      'G3',
      '申請'
    ];

    // マイルストーンカテゴリのスケジュールからデータを取得
    const milestoneSchedules = schedules
      .filter(s => (s.category || '').trim() === 'マイルストーン');

    // 固定項目ごとに対応するスケジュールデータを探して順番に配置
    const milestoneItems = fixedItems.map(itemName => {
      const schedule = milestoneSchedules.find(s => (s.item || '').trim() === itemName);
      return {
        id: schedule?.id || itemName, // スケジュールが見つからない場合は項目名をIDとして使用
        name: itemName,
        date: schedule?.start_date || null // スケジュールが見つからない場合はnull
      };
    });

    return <MilestoneBoard items={milestoneItems} projectId={pid} editable={true} />;
  }, [schedules]);


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

      {milestoneBoardSection}

      <DateManager
        commentPages={commentPages}
        selectedDate={selectedDate}
        latestDate={latestDate}
        loading={loading}
        error={error}
        localMessage={localMessage}
        newPageDate={newPageDate}
        onSelectDate={handleSelectDate}
        onCreatePage={handleCreatePage}
        onDeletePage={handleDeletePage}
        onNewPageDateChange={setNewPageDate}
      />

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

      {(sectionsLeft.length === 0 && sectionsRight.length === 0) ? (
        <div className="text-gray-600">表示できるカテゴリがありません。進捗管理表でカテゴリと担当者を設定してください。</div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-6">
            {sectionsLeft.map(section => {
              const ownerNames = categoryOwnersMap[section];
              const ownerLabel = ownerNames && ownerNames.length > 0 ? ownerNames.join('、') : null;
              const progressStatus = getCategoryProgress(section);
              const progressStyle = getProgressStyle(progressStatus);
              return (
                <div key={`L-${section}`} className={`${progressStyle.bgColor} rounded-lg shadow-md hover:shadow-lg transition-shadow p-4 border-2 ${progressStyle.borderColor}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1">
                      <h2 className={`text-lg font-semibold ${progressStyle.textColor}`}>
                        {section}
                        <span className="ml-2 text-sm font-normal opacity-75">
                          （担当: {ownerLabel ?? '未設定'}）
                        </span>
                      </h2>
                    </div>
                    <select
                      value={progressStatus}
                      onChange={(e) => handleProgressChange(section, e.target.value as ProgressStatus)}
                      className={`ml-2 px-2 py-1 text-sm rounded-md border ${progressStyle.borderColor} ${progressStyle.bgColor} ${progressStyle.textColor} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                      disabled={!canEdit}
                    >
                      {progressOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">{formatDateLabel(selectedDate)} のコメント</span>
                      {selectedDate && saving[keyOf(section, selectedDate)] && (
                        <span className="text-xs text-blue-600">保存中…</span>
                      )}
                    </div>
                  </div>
                  <textarea
                    className={`w-full min-h-[96px] border border-gray-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${!canEdit ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                    placeholder="本日の進捗・課題・所要支援などを記入"
                    value={getValueForSelected(section)}
                    onChange={(e) => {
                      handleChange(section, e.target.value);
                      scheduleSave(section, e.target.value);
                    }}
                    disabled={!canEdit}
                  />
                </div>
              );
            })}
          </div>
          <div className="space-y-6">
            {sectionsRight.map(section => {
              const ownerNames = categoryOwnersMap[section];
              const ownerLabel = ownerNames && ownerNames.length > 0 ? ownerNames.join('、') : null;
              const progressStatus = getCategoryProgress(section);
              const progressStyle = getProgressStyle(progressStatus);
              return (
                <div key={`R-${section}`} className={`${progressStyle.bgColor} rounded-lg shadow-md hover:shadow-lg transition-shadow p-4 border-2 ${progressStyle.borderColor}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1">
                      <h2 className={`text-lg font-semibold ${progressStyle.textColor}`}>
                        {section}
                        <span className="ml-2 text-sm font-normal opacity-75">
                          （担当: {ownerLabel ?? '未設定'}）
                        </span>
                      </h2>
                    </div>
                    <select
                      value={progressStatus}
                      onChange={(e) => handleProgressChange(section, e.target.value as ProgressStatus)}
                      className={`ml-2 px-2 py-1 text-sm rounded-md border ${progressStyle.borderColor} ${progressStyle.bgColor} ${progressStyle.textColor} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                      disabled={!canEdit}
                    >
                      {progressOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">{formatDateLabel(selectedDate)} のコメント</span>
                      {selectedDate && saving[keyOf(section, selectedDate)] && (
                        <span className="text-xs text-blue-600">保存中…</span>
                      )}
                    </div>
                  </div>
                  <textarea
                    className={`w-full min-h-[96px] border border-gray-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${!canEdit ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                    placeholder="本日の進捗・課題・所要支援などを記入"
                    value={getValueForSelected(section)}
                    onChange={(e) => {
                      handleChange(section, e.target.value);
                      scheduleSave(section, e.target.value);
                    }}
                    disabled={!canEdit}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default CommentsPage;
