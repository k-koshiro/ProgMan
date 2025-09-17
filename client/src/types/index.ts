export interface Project {
  id: number;
  name: string;
  base_date?: string;
  created_at: string;
}

export interface Schedule {
  id: number;
  project_id: number;
  category: string;
  item: string;
  owner?: string;
  start_date?: string;
  duration?: number;
  end_date?: string;
  progress?: number;
  actual_start?: string;
  actual_duration?: number;
  actual_end?: string;
  sort_order: number;
  updated_at?: string;
}

export interface UploadResult {
  ok?: boolean;
  filename: string;
  originalname: string;
  mimetype: string;
  size: number;
  savedPath: string;
  projectId?: number;
  imported?: number;
  updatedCount?: number;
}

export interface CommentEntry {
  id?: number;
  project_id: number;
  owner: string;
  comment_date: string; // yyyy-MM-dd
  body: string;
  updated_at?: string;
}

export interface CommentPage {
  id?: number;
  project_id: number;
  comment_date: string;
  created_at?: string;
}

export type ProgressStatus = 'smooth' | 'caution' | 'danger' | 'idle';

export interface CategoryProgress {
  id?: number;
  project_id: number;
  category: string;
  progress_date: string; // yyyy-MM-dd
  status: ProgressStatus;
  updated_at?: string;
}
