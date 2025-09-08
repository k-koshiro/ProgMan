export interface Project {
  id?: number;
  name: string;
  base_date?: string;
  created_at?: string;
}

export interface Schedule {
  id?: number;
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