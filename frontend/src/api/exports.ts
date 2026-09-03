import { client } from './client';

export interface ExportFile {
  kind: string;
  filename: string;
  url: string | null;
  ready: boolean;
  size?: number;
  description?: string;
}

export interface ExportsResponse {
  files: ExportFile[];
}

export async function getJobExports(jobId: string): Promise<ExportsResponse> {
  return client(`/jobs/${jobId}/exports`);
}

export async function getJobDrawing(jobId: string): Promise<any> {
  return client(`/jobs/${jobId}/drawing`);
}
