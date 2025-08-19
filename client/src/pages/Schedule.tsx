import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useScheduleStore } from '../store/useScheduleStore';
import ScheduleTable from '../components/ScheduleTable';

function Schedule() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
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
    selectProject
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
          <p className="text-gray-600 mt-1">進捗管理スケジュール</p>
        </div>
        <button
          onClick={() => navigate('/projects')}
          className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
        >
          製番一覧へ
        </button>
      </div>

      <ScheduleTable
        schedules={schedules}
        onUpdateSchedule={handleUpdateSchedule}
      />
    </div>
  );
}

export default Schedule;