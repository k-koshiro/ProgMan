import { useState } from 'react';
import { useScheduleStore } from '../store/useScheduleStore';

function UploadExcel({ projectId }: { projectId?: number }) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { fetchSchedules } = useScheduleStore();

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setResult(null);
    setError(null);
    setFile(e.target.files?.[0] || null);
  };

  const onUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (projectId) fd.append('projectId', String(projectId));
      const res = await fetch('/progress-manager/api/upload/excel', {
        method: 'POST',
        body: fd
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'アップロードに失敗しました');
      setResult(json);
      // 取り込み成功時は最新スケジュールを取得
      if (projectId) {
        try { await fetchSchedules(projectId); } catch {}
      }
    } catch (e: any) {
      setError(e.message || 'アップロードに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow mb-6">
      <h2 className="text-lg font-semibold mb-3">Excel 取り込み（アップロード）</h2>
      <div className="flex items-center gap-3">
        <input
          type="file"
          accept=".xlsx,.xlsm,.xls"
          onChange={onChange}
          className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
        <button
          onClick={onUpload}
          disabled={!file || loading}
          className={`px-4 py-2 rounded text-white ${loading || !file ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {loading ? 'アップロード中…' : 'アップロード'}
        </button>
      </div>
      {error && <p className="text-red-600 mt-3 text-sm">{error}</p>}
      {result && (
        <div className="mt-3 text-sm text-gray-700">
          <p>保存名: <span className="font-mono">{result.filename}</span></p>
          <p>元ファイル: {result.originalname}</p>
          <p>サイズ: {result.size} bytes</p>
          <p className="text-gray-500">{result.hint}</p>
        </div>
      )}
    </div>
  );
}

export default UploadExcel;
