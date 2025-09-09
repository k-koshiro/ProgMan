import { useCallback, useRef, useState } from 'react';
import axios, { AxiosError } from 'axios';
import { useScheduleStore } from '../store/useScheduleStore';
import type { UploadResult } from '../types';

function UploadExcel({ projectId }: { projectId?: number }) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { fetchSchedules, fetchProjects } = useScheduleStore();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const accept = '.xlsx,.xlsm,.xls';

  const formatSize = useCallback((bytes?: number) => {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    const kb = bytes / 1024;
    return `${kb.toFixed(0)} KB`;
  }, []);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setResult(null);
    setError(null);
    setFile(e.target.files?.[0] || null);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setResult(null);
    setError(null);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const onUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (projectId) fd.append('projectId', String(projectId));
      const { data } = await axios.post<UploadResult>('/progress-manager/api/upload/excel', fd);
      setResult(data);
      // 取り込み成功時は最新スケジュールを取得
      if (projectId) {
        try {
          await fetchSchedules(projectId);
          await fetchProjects(); // 基準日更新の反映
        } catch {}
      }
    } catch (e: unknown) {
      const err = e as AxiosError<{ error?: string }>;
      setError(err.response?.data?.error || err.message || 'アップロードに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow mb-6">
      <h2 className="text-lg font-semibold mb-3">Excel 取り込み</h2>

      {/* ステップ1: ファイル選択 or ドロップ */}
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        className={`border-2 border-dashed rounded-md p-4 mb-3 transition-colors ${file ? 'border-green-300 bg-green-50/40' : 'border-gray-300 hover:border-blue-300 hover:bg-blue-50/30'}`}
      >
        {!file ? (
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-gray-700">
              <p className="font-medium">1. ファイルを選択</p>
              <p className="text-gray-500">.xlsx / .xlsm を選ぶか、ここにドラッグ＆ドロップ</p>
            </div>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="shrink-0 px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
            >
              ファイルを選ぶ
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm">
              <p className="font-medium text-gray-800">選択中: <span className="font-mono break-all">{file.name}</span></p>
              <p className="text-gray-500">{formatSize(file.size)}・{file.type || 'application/octet-stream'}</p>
            </div>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="shrink-0 px-3 py-2 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
            >
              別のファイルを選ぶ
            </button>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={onChange}
          className="hidden"
        />
      </div>

      {/* ステップ2: 取り込み実行 */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-gray-700">
          <p className="font-medium">2. 取り込みを実行</p>
          <p className="text-gray-500">先頭の開始日を基準日に設定し、スケジュールを取り込みます</p>
        </div>
        <button
          onClick={onUpload}
          disabled={!file || loading}
          className={`px-4 py-2 rounded-md text-white ${loading || !file ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
        >
          {loading ? '取り込み中…' : '取り込む'}
        </button>
      </div>

      {error && <p className="text-red-600 mt-3 text-sm">{error}</p>}
      {result && (
        <div className="mt-3 text-sm text-gray-700">
          <p>保存名: <span className="font-mono break-all">{result.filename}</span></p>
          <p>元ファイル: {result.originalname}（{formatSize(result.size)}）</p>
          {result.imported !== undefined && (
            <p>取り込み件数: {result.imported}（更新後 {result.updatedCount} 行）</p>
          )}
        </div>
      )}
    </div>
  );
}

export default UploadExcel;
