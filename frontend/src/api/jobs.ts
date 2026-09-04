import { apiClient } from './client';

export interface StageRecord {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'skipped' | 'failed';
  detail?: string;
}

export interface JobStatusResponse {
  job_id: string;
  status: 'uploaded' | 'processing' | 'completed' | 'failed' | 'needs_more_views';
  current_stage: string | null;
  progress: number;
  stages: StageRecord[];
  warnings: string[];
  error: string | null;
  file_count: number;
  normalized_count: number;
  coverage_score?: number;
  coverage_gaps?: string[];
  usable_count?: number;
  feature_count?: number;
  object_found?: boolean;
  preview_url?: string;
  confidence?: number;
  reconstruction_warnings?: string[];
  measurements?: any[];
  scale?: any;
}

export interface KnownDimension {
  label: string;
  value: number;
}

export const createJob = async (
  mode: 'photo' | 'video',
  units: string,
  dimensions: KnownDimension[],
  thickness: number,
  files: File[]
): Promise<{ job_id: string }> => {
  const formData = new FormData();
  formData.append('mode', mode);
  formData.append('units', units);
  formData.append('known_dimensions', JSON.stringify(dimensions));
  formData.append('thickness', String(thickness));
  files.forEach(f => formData.append('files', f));

  return apiClient('/jobs', {
    method: 'POST',
    body: formData,
  });
};

export const startProcessing = async (jobId: string): Promise<{ status: string }> => {
  return apiClient(`/jobs/${jobId}/process`, { method: 'POST' });
};

export const getJobStatus = async (jobId: string): Promise<any> => {
  return apiClient(`/jobs/${jobId}/status`);
};

export const getJobs = async (limit: number = 50, status?: string): Promise<{ jobs: any[] }> => {
  let url = `/jobs?limit=${limit}`;
  if (status) url += `&status=${status}`;
  return apiClient(url);
};

export const addPhotos = async (jobId: string, files: File[]): Promise<any> => {
  const formData = new FormData();
  files.forEach(f => formData.append('files', f));
  return apiClient(`/jobs/${jobId}/files`, {
    method: 'POST',
    body: formData,
  });
};
