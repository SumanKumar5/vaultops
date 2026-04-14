import { api } from "./client";

export interface AuditEvent {
  id: number;
  actor_type: string;
  actor_id: string;
  actor_ip: string;
  event_type: string;
  resource_id: string;
  resource_type: string;
  metadata: Record<string, unknown>;
  occurred_at: string;
}

export const auditApi = {
  list: (
    orgId: string,
    params?: {
      actor_id?: string;
      event_type?: string;
      project_id?: string;
      from?: string;
      to?: string;
      page?: number;
      limit?: number;
    },
  ) =>
    api
      .get<{
        data: AuditEvent[];
        total: number;
        page: number;
        limit: number;
      }>(`/orgs/${orgId}/audit`, { params })
      .then((r) => r.data),

  verify: (orgId: string) =>
    api
      .get<{
        valid: boolean;
        first_broken_at?: number;
      }>(`/orgs/${orgId}/audit/verify`)
      .then((r) => r.data),
};
