import { api } from "./client";

export interface SecretMeta {
  id: string;
  project_id: string;
  environment: string;
  key_name: string;
  version: number;
  is_current: boolean;
  created_by: string;
  created_at: string;
  rotated_at: string | null;
  expires_at: string | null;
  tags: string[];
}

export interface SecretWithValue extends SecretMeta {
  value: string;
}

export interface ChangeRequest {
  id: string;
  project_id: string;
  environment: string;
  requested_by: string;
  requester_email?: string;
  status: "pending" | "approved" | "rejected" | "applied" | "expired";
  changes: Array<{ key_name: string }>;
  review_note?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  expires_at: string;
  applied_at?: string;
  created_at: string;
}

export const secretsApi = {
  list: (projectId: string, environment: string, search?: string) =>
    api
      .get<{ data: SecretMeta[] }>(`/projects/${projectId}/secrets`, {
        params: { environment, search },
      })
      .then((r) => r.data.data),

  get: (
    projectId: string,
    keyName: string,
    environment: string,
    version?: number,
  ) =>
    api
      .get<{ data: SecretWithValue }>(
        `/projects/${projectId}/secrets/${keyName}`,
        {
          params: { environment, version },
        },
      )
      .then((r) => r.data.data),

  write: (
    projectId: string,
    keyName: string,
    body: {
      environment: string;
      value: string;
      tags?: string[];
      expires_at?: string;
    },
  ) =>
    api
      .put<{
        data: SecretMeta | ChangeRequest;
      }>(`/projects/${projectId}/secrets/${keyName}`, body)
      .then((r) => ({ data: r.data.data, status: r.status })),

  delete: (projectId: string, keyName: string, environment: string) =>
    api.delete(`/projects/${projectId}/secrets/${keyName}`, {
      data: { environment },
    }),

  history: (projectId: string, keyName: string, environment: string) =>
    api
      .get<{ data: SecretMeta[] }>(
        `/projects/${projectId}/secrets/${keyName}/history`,
        {
          params: { environment },
        },
      )
      .then((r) => r.data.data),

  rollback: (
    projectId: string,
    keyName: string,
    environment: string,
    target_version: number,
  ) =>
    api
      .post(`/projects/${projectId}/secrets/${keyName}/rollback`, {
        environment,
        target_version,
      })
      .then((r) => r.data.data),

  bulkExport: (
    projectId: string,
    environment: string,
    format: "env" | "json" | "yaml",
  ) =>
    api
      .post(
        `/projects/${projectId}/secrets/bulk-export`,
        { environment, format },
        { responseType: "text" },
      )
      .then((r) => r.data as string),

  listChangeRequests: (projectId: string, status?: string) =>
    api
      .get<{
        data: ChangeRequest[];
      }>(`/projects/${projectId}/change-requests`, { params: { status } })
      .then((r) => r.data.data),

  approveChangeRequest: (projectId: string, id: string) =>
    api
      .post(`/projects/${projectId}/change-requests/${id}/approve`)
      .then((r) => r.data.data),

  rejectChangeRequest: (projectId: string, id: string, review_note: string) =>
    api
      .post(`/projects/${projectId}/change-requests/${id}/reject`, {
        review_note,
      })
      .then((r) => r.data.data),
};
