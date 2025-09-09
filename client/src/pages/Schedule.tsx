import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useScheduleStore } from '../store/useScheduleStore';
import ScheduleTable from '../components/ScheduleTable';
import UploadExcel from '../components/UploadExcel';

function Schedule() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [isEditingBaseDate, setIsEditingBaseDate] = useState(false);
  const [editBaseDate, setEditBaseDate] = useState('');
  const {
    projects,
    currentProject,
    schedules,
    loading,
    error,
    fetchSchedules,
    updateSchedule,
    connectSocket,
    disconnectSocket,
    fetchProjects,
    selectProject,
    updateProject
  } = useScheduleStore();

  useEffect(() => {
    if (!projectId) {
      navigate('/projects');
      return;
    }

    // プロジェクトIDが数値でない場合はリダイレクト
    const projectIdNum = parseInt(projectId);
    if (isNaN(projectIdNum)) {
      navigate('/projects');
      return;
    }

    const loadData = async () => {
      await fetchProjects();
      await fetchSchedules(projectIdNum);
      connectSocket();
    };

    loadData();

    return () => {
      disconnectSocket();
    };
  }, [projectId]);

  // プロジェクト情報を取得して currentProject を設定
  useEffect(() => {
    if (projects.length > 0 && projectId) {
      const projectIdNum = parseInt(projectId);
      if (isNaN(projectIdNum)) {
        navigate('/projects');
        return;
      }
      
      const project = projects.find(p => p.id === projectIdNum);
      if (!project) {
        // プロジェクトが見つからない場合はプロジェクト一覧へリダイレクト
        navigate('/projects');
        return;
      }
      
      if (!currentProject || currentProject.id !== project.id) {
        selectProject(project);
      }
    }
  }, [projects, projectId, currentProject, selectProject, navigate]);

  const handleUpdateSchedule = async (schedule: any) => {
    console.log('Updating schedule:', schedule);
    updateSchedule(schedule);
  };

  const handleStartEditBaseDate = () => {
    setEditBaseDate(currentProject?.base_date || '');
    setIsEditingBaseDate(true);
  };

  const handleSaveBaseDate = async () => {
    if (currentProject) {
      await updateProject(currentProject.id, currentProject.name, editBaseDate || undefined);
      // 基準日変更に伴う日付シフトが行われるため、最新スケジュールを取得
      await fetchSchedules(currentProject.id);
      await fetchProjects();
      setIsEditingBaseDate(false);
    }
  };

  const handleCancelEditBaseDate = () => {
    setIsEditingBaseDate(false);
    setEditBaseDate('');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
        <button
          onClick={() => navigate('/projects')}
          className="mt-4 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
        >
          製番一覧に戻る
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            {currentProject?.name || `プロジェクト ${projectId}`}
          </h1>
          <div className="flex gap-4 items-center mt-1">
            <p className="text-gray-600">進捗管理スケジュール</p>
            {isEditingBaseDate ? (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">基準日:</span>
                <input
                  type="date"
                  value={editBaseDate}
                  onChange={(e) => setEditBaseDate(e.target.value)}
                  className="px-2 py-1 text-sm border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleSaveBaseDate}
                  className="px-2 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                >
                  保存
                </button>
                <button
                  onClick={handleCancelEditBaseDate}
                  className="px-2 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600"
                >
                  キャンセル
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {currentProject?.base_date ? (
                  <div className="flex items-center gap-2 bg-blue-50 px-3 py-1 rounded">
                    <span className="text-sm font-medium text-gray-700">基準日:</span>
                    <span className="text-sm font-semibold text-blue-700">
                      {new Date(currentProject.base_date).toLocaleDateString('ja-JP')}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-gray-50 px-3 py-1 rounded">
                    <span className="text-sm text-gray-500">基準日未設定</span>
                  </div>
                )}
                <button
                  onClick={handleStartEditBaseDate}
                  className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 p-1 rounded transition-colors"
                  title="基準日を編集"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
        <button
          onClick={() => navigate('/projects')}
          className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
        >
          製番一覧へ
        </button>
      </div>

      {/* 初回のみ表示（スケジュール未作成時） */}
      {schedules.length === 0 && (
        <UploadExcel projectId={currentProject?.id} />
      )}

      <ScheduleTable
        schedules={schedules}
        onUpdateSchedule={handleUpdateSchedule}
      />
    </div>
  );
}

export default Schedule;
