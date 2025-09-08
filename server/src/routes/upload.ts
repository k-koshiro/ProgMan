import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';
import { replaceSchedulesFromExcel } from '../db/queries.js';
import { getProjectById, getSchedulesByProject } from '../db/queries.js';
import fs from 'fs';

const router = express.Router();

// 保存先: server/src/data/uploads （開発時は server カレント想定）
const __filename = fileURLToPath(import.meta.url || '');
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '../data', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext);
    cb(null, `${base}_${ts}${ext}`);
  }
});

const excelMime = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel.sheet.macroEnabled.12', // .xlsm
  'application/vnd.ms-excel' // .xls (古い形式)
]);

const allowedExt = new Set(['.xlsx', '.xlsm', '.xls']);

const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  // ブラウザ/OSにより octet-stream になるケースを許容
  if (excelMime.has(file.mimetype) || file.mimetype === 'application/octet-stream' || allowedExt.has(ext)) {
    return cb(null, true);
  }
  cb(new Error(`Excel ファイルのみ許可されます (.xlsx/.xlsm/.xls) - received mimetype=${file.mimetype}, ext=${ext}`));
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 20 * 1024 * 1024 } });

// 最小実装: 受け取り→保存→メタ情報返却（解析は後続）
router.post('/excel', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'ファイルがありません' });
    const { filename, path: savedPath, size, mimetype, originalname } = req.file as any;
    // 任意: プロジェクトIDを一緒に受け取る（今後の解析で関連付けに使用）
    const { projectId } = req.body as { projectId?: string };

    let imported = 0;
    let updatedSchedules: any[] | null = null;

    if (!projectId) {
      return res.status(400).json({ error: 'プロジェクトIDが指定されていません' });
    }

    if (projectId) {
      // Excel解析 → DB置き換え
      const pid = Number(projectId);
      const project = await getProjectById(pid);

      let wb;
      try {
        const buf = fs.readFileSync(savedPath);
        wb = XLSX.read(buf, { type: 'buffer', cellDates: true });
      } catch (e: any) {
        console.error('XLSX read error:', e);
        return res.status(400).json({ error: `Excel読込エラー: ${e?.message || e}` });
      }
      const parseDate = (v: any): string | null => {
        if (!v) return null;
        if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
        if (typeof v === 'number') {
          // Excel serial → JS Date（1900基準）
          const d = XLSX.SSF.parse_date_code(v);
          if (!d) return null;
          const dt = new Date(Date.UTC(d.y, (d.m || 1) - 1, d.d || 1));
          return dt.toISOString().slice(0, 10);
        }
        if (typeof v === 'string') {
          const s = v.trim().replace(/[.]/g, '/');
          const yyyy = (project?.base_date ? new Date(project.base_date) : new Date()).getFullYear();
          if (/^\d{1,2}[\/-]\d{1,2}$/.test(s)) {
            const [m, d] = s.split(/[\/-]/).map(n => n.padStart(2, '0'));
            return `${yyyy}-${m}-${d}`;
          }
          const m = s.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
          if (m) return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
          const dt = new Date(s);
          if (!isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
        }
        return null;
      };
      // シートから見出し行を検出して抽出
      const pickFromSheet = (ws: XLSX.WorkSheet) => {
        const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: null, raw: false }) as any[][];
        const candidates = {
          item: new Set(['項目','タスク','工程','作業','担当','ROM名称','Item','Task']),
          start: new Set(['開始日','開始','Start','Start Date','StartDate']),
          end: new Set(['終了日','終了','End','End Date','EndDate']),
          dur: new Set(['日数','期間','工期','Duration']),
          owner: new Set(['担当','担当者','Owner','Assignee','メンバ','メンバー']),
          cat: new Set(['カテゴリ','区分','Category'])
        };
        let headerIdx = -1;
        let mapIdx: Record<string, number> | null = null;
        for (let i = 0; i < Math.min(rows.length, 50); i++) {
          const r = rows[i];
          if (!r) continue;
          const colMap: Record<string, number> = {};
          r.forEach((cell, idx) => {
            const key = (cell ?? '').toString().trim();
            if (candidates.item.has(key)) colMap.item ??= idx;
            if (candidates.start.has(key)) colMap.start ??= idx;
            if (candidates.end.has(key)) colMap.end ??= idx;
            if (candidates.dur.has(key)) colMap.dur ??= idx;
            if (candidates.owner.has(key)) colMap.owner ??= idx;
            if (candidates.cat.has(key)) colMap.category ??= idx;
          });
          if (colMap.item !== undefined && (colMap.start !== undefined || colMap.dur !== undefined)) {
            headerIdx = i;
            mapIdx = colMap;
            break;
          }
        }
        if (headerIdx === -1 || !mapIdx) return [] as any[];
        const out: any[] = [];
        for (let i = headerIdx + 1; i < rows.length; i++) {
          const r = rows[i] || [];
          const item = (r[mapIdx.item] ?? '').toString().trim();
          if (!item) continue;
          const start = mapIdx.start !== undefined ? parseDate(r[mapIdx.start]) : null;
          let duration: number | null = null;
          if (mapIdx.dur !== undefined && r[mapIdx.dur] != null) {
            const n = Number(String(r[mapIdx.dur]).replace(/[^\d.-]/g, ''));
            duration = Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : null;
          }
          if (!duration && mapIdx.end !== undefined && r[mapIdx.end] != null && start) {
            const end = parseDate(r[mapIdx.end]);
            if (end) {
              const sd = new Date(start);
              const ed = new Date(end);
              const diff = Math.round((ed.getTime() - sd.getTime()) / (24*3600*1000)) + 1;
              duration = diff > 0 ? diff : 1;
            }
          }
          if (!duration && start) duration = 1;

          out.push({
            category: mapIdx.category !== undefined ? (r[mapIdx.category]?.toString().trim() || null) : null,
            item,
            owner: mapIdx.owner !== undefined ? (r[mapIdx.owner]?.toString().trim() || null) : null,
            start_date: start,
            duration: duration ?? null,
            progress: 0
          });
        }
        return out;
      };

      // 複数シートを走査し、最も多く抽出できたものを採用
      let normalized: any[] = [];
      for (const sn of wb.SheetNames) {
        const ws = wb.Sheets[sn];
        const extracted = pickFromSheet(ws);
        if (extracted.length > normalized.length) normalized = extracted;
      }

      imported = normalized.length;
      try {
        if (imported > 0) {
          await replaceSchedulesFromExcel(pid, normalized);
          updatedSchedules = await getSchedulesByProject(pid);
        }
      } catch (e: any) {
        console.error('DB import error:', e);
        return res.status(500).json({ error: `DB反映で失敗: ${e?.message || e}` });
      }
    }

    return res.json({
      ok: true,
      filename,
      originalname,
      mimetype,
      size,
      savedPath,
      projectId: projectId ? Number(projectId) : undefined,
      imported,
      updatedCount: updatedSchedules?.length ?? 0
    });
  } catch (e: any) {
    console.error('Upload error:', e);
    return res.status(500).json({ error: e?.message || 'アップロードに失敗しました' });
  }
});

// Multer/その他エラーをJSONで返す
router.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err) {
    const status = err.name === 'MulterError' ? 400 : 500;
    return res.status(status).json({ error: err.message || 'アップロードエラー' });
  }
});

export default router;
