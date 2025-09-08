import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useScheduleStore } from '../store/useScheduleStore';

function ProjectList() {
  const navigate = useNavigate();
  const { projects, loading, error, fetchProjects, createProject, updateProject, deleteProject } = useScheduleStore();
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectBaseDate, setNewProjectBaseDate] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingProject, setEditingProject] = useState<{
    id: number | null;
    name: string;
    base_date: string;
  }>({ id: null, name: '', base_date: '' });
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; projectId: number | null; projectName: string }>({
    show: false,
    projectId: null,
    projectName: ''
  });

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreateProject = async () => {
    if (newProjectName.trim()) {
      await createProject(newProjectName, newProjectBaseDate || undefined);
      setNewProjectName('');
      setNewProjectBaseDate('');
      setShowCreateForm(false);
    }
  };

  const handleSelectProject = (projectId: number) => {
    navigate(`/schedule/${projectId}`);
  };

  const handleDeleteClick = (e: React.MouseEvent, projectId: number, projectName: string) => {
    e.stopPropagation();
    setDeleteConfirm({ show: true, projectId, projectName });
  };

  const handleDeleteConfirm = async () => {
    if (deleteConfirm.projectId) {
      await deleteProject(deleteConfirm.projectId);
      setDeleteConfirm({ show: false, projectId: null, projectName: '' });
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm({ show: false, projectId: null, projectName: '' });
  };

  const handleEditClick = (e: React.MouseEvent, project: { id: number; name: string; base_date?: string }) => {
    e.stopPropagation();
    setEditingProject({ 
      id: project.id, 
      name: project.name, 
      base_date: project.base_date || '' 
    });
  };

  const handleUpdateProject = async () => {
    if (editingProject.id && editingProject.name.trim()) {
      await updateProject(
        editingProject.id, 
        editingProject.name, 
        editingProject.base_date || undefined
      );
      setEditingProject({ id: null, name: '', base_date: '' });
    }
  };

  const handleEditCancel = () => {
    setEditingProject({ id: null, name: '', base_date: '' });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">製番一覧</h1>
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
          >
            新規プロジェクト作成
          </button>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {showCreateForm && (
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <h2 className="text-xl font-semibold mb-4">新規プロジェクト作成</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  プロジェクト名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="プロジェクト名を入力"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyPress={(e) => e.key === 'Enter' && handleCreateProject()}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  基準日（オプション）
                </label>
                <input
                  type="date"
                  value={newProjectBaseDate}
                  onChange={(e) => setNewProjectBaseDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCreateProject}
                  className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md transition-colors"
                >
                  作成
                </button>
                <button
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewProjectName('');
                    setNewProjectBaseDate('');
                  }}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md transition-colors"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            <p className="mt-2 text-gray-600">読み込み中...</p>
          </div>
        )}

        {!loading && projects.length === 0 && (
          <div className="bg-gray-100 rounded-lg p-8 text-center">
            <p className="text-gray-600">プロジェクトがありません</p>
            <p className="text-gray-500 text-sm mt-2">新規プロジェクトを作成してください</p>
          </div>
        )}

        <div className="grid gap-4">
          {projects.map((project) => (
            <div
              key={project.id}
              onClick={() => handleSelectProject(project.id)}
              className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer relative"
            >
              <div className="absolute top-4 right-4 flex flex-col gap-2">
                <button
                  onClick={(e) => handleDeleteClick(e, project.id, project.name)}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors"
                  title="製番を削除"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
                <button
                  onClick={(e) => handleEditClick(e, project)}
                  className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 p-2 rounded-lg transition-colors"
                  title="製番情報を編集"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                </button>
              </div>
              {editingProject.id === project.id ? (
                <div className="pr-20">
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editingProject.name}
                      onChange={(e) => setEditingProject({ ...editingProject, name: e.target.value })}
                      onClick={(e) => e.stopPropagation()}
                      onKeyPress={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter') handleUpdateProject();
                        if (e.key === 'Escape') handleEditCancel();
                      }}
                      className="text-xl font-semibold text-gray-800 border-b-2 border-blue-500 outline-none w-full"
                      autoFocus
                    />
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">基準日</label>
                      <input
                        type="date"
                        value={editingProject.base_date}
                        onChange={(e) => setEditingProject({ ...editingProject, base_date: e.target.value })}
                        onClick={(e) => e.stopPropagation()}
                        className="px-2 py-1 text-sm border border-gray-300 rounded outline-none focus:border-blue-500 w-full"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpdateProject();
                      }}
                      className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                    >
                      保存
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditCancel();
                      }}
                      className="px-3 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600"
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              ) : (
                <h3 className="text-xl font-semibold text-gray-800 pr-20">{project.name}</h3>
              )}
              <div className="text-gray-500 text-sm mt-2">
                <p>作成日: {new Date(project.created_at).toLocaleDateString('ja-JP')}</p>
                {project.base_date && (
                  <p>基準日: {new Date(project.base_date).toLocaleDateString('ja-JP')}</p>
                )}
              </div>
            </div>
          ))}
        </div>
        {deleteConfirm.show && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">プロジェクトを削除</h3>
              <p className="text-gray-600 mb-6">
                「{deleteConfirm.projectName}」を削除してもよろしいですか？<br />
                <span className="text-red-600 text-sm">この操作は取り消せません。関連するすべてのスケジュールも削除されます。</span>
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={handleDeleteCancel}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors"
                >
                  削除する
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProjectList;