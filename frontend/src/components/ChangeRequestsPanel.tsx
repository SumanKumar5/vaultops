import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle,
  XCircle,
  Clock,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { useState } from "react";
import { secretsApi, type ChangeRequest } from "../api/secrets";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";
import { Input } from "./ui/Input";
import { formatDate, timeAgo } from "../lib/utils";

interface ChangeRequestsPanelProps {
  projectId: string;
}

function statusBadge(status: ChangeRequest["status"]) {
  const map = {
    pending: <Badge variant="warning">pending</Badge>,
    applied: <Badge variant="success">applied</Badge>,
    rejected: <Badge variant="danger">rejected</Badge>,
    expired: <Badge variant="default">expired</Badge>,
    approved: <Badge variant="info">approved</Badge>,
  };
  return map[status] ?? <Badge>{status}</Badge>;
}

export function ChangeRequestsPanel({ projectId }: ChangeRequestsPanelProps) {
  const queryClient = useQueryClient();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["change-requests", projectId],
    queryFn: () => secretsApi.listChangeRequests(projectId),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => secretsApi.approveChangeRequest(projectId, id),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["change-requests", projectId],
      }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      secretsApi.rejectChangeRequest(projectId, id, note),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["change-requests", projectId],
      });
      setRejectingId(null);
      setRejectNote("");
    },
  });

  const pending = requests.filter((r) => r.status === "pending");
  const past = requests.filter((r) => r.status !== "pending");

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-20 bg-surface-2 border border-border rounded-xl animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">
            Pending Approval
          </h3>
          {pending.length > 0 && (
            <Badge variant="warning">{pending.length} pending</Badge>
          )}
        </div>

        {pending.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 bg-surface-2 border border-border rounded-xl gap-2">
            <CheckCircle size={24} className="text-success" />
            <p className="text-sm text-text-secondary font-medium">All clear</p>
            <p className="text-xs text-text-muted">
              No pending change requests
            </p>
          </div>
        ) : (
          pending.map((cr) => (
            <div
              key={cr.id}
              className="bg-surface-2 border border-warning/20 rounded-xl p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center flex-shrink-0">
                    <Clock size={14} className="text-warning" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {cr.changes?.map((c) => (
                        <span
                          key={c.key_name}
                          className="text-sm font-mono font-medium text-text-primary"
                        >
                          {c.key_name}
                        </span>
                      ))}
                      <Badge variant="warning">{cr.environment}</Badge>
                    </div>
                    <p className="text-xs text-text-muted mt-1">
                      Requested by{" "}
                      {cr.requester_email ?? cr.requested_by.slice(0, 8)} ·{" "}
                      {timeAgo(cr.created_at)}
                    </p>
                    <p className="text-xs text-text-muted">
                      Expires {formatDate(cr.expires_at)}
                    </p>
                  </div>
                </div>
                {statusBadge(cr.status)}
              </div>

              <div className="flex items-center gap-2 pt-1 border-t border-border">
                <Button
                  variant="success"
                  size="sm"
                  icon={<CheckCircle size={13} />}
                  loading={
                    approveMutation.isPending &&
                    approveMutation.variables === cr.id
                  }
                  onClick={() => approveMutation.mutate(cr.id)}
                >
                  Approve
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  icon={<XCircle size={13} />}
                  onClick={() => {
                    setRejectingId(cr.id);
                    setRejectNote("");
                  }}
                >
                  Reject
                </Button>
              </div>

              {approveMutation.isError &&
                approveMutation.variables === cr.id && (
                  <p className="text-xs text-danger">
                    {approveMutation.error.message}
                  </p>
                )}
            </div>
          ))
        )}
      </div>

      {past.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-text-secondary">
            Recent Activity
          </h3>
          <div className="bg-surface-2 border border-border rounded-xl divide-y divide-border">
            {past.slice(0, 10).map((cr) => (
              <div
                key={cr.id}
                className="flex items-center justify-between px-4 py-3 gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <ChevronRight
                    size={14}
                    className="text-text-muted flex-shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-text-primary truncate">
                        {cr.changes?.[0]?.key_name ?? "—"}
                      </span>
                      <Badge variant="default">{cr.environment}</Badge>
                    </div>
                    <p className="text-xs text-text-muted mt-0.5">
                      {timeAgo(cr.created_at)}
                    </p>
                  </div>
                </div>
                {statusBadge(cr.status)}
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal
        open={rejectingId !== null}
        onClose={() => setRejectingId(null)}
        title="Reject Change Request"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-danger/5 border border-danger/20 rounded-lg">
            <AlertTriangle
              size={15}
              className="text-danger mt-0.5 flex-shrink-0"
            />
            <p className="text-sm text-text-secondary">
              Provide a reason for rejection. This will be visible to the
              requester.
            </p>
          </div>
          <Input
            label="Rejection Reason"
            placeholder="e.g. Value does not meet security requirements"
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
          />
          <div className="flex gap-3">
            <Button
              variant="danger"
              icon={<XCircle size={13} />}
              loading={rejectMutation.isPending}
              disabled={!rejectNote.trim()}
              onClick={() =>
                rejectingId &&
                rejectMutation.mutate({ id: rejectingId, note: rejectNote })
              }
            >
              Reject
            </Button>
            <Button variant="ghost" onClick={() => setRejectingId(null)}>
              Cancel
            </Button>
          </div>
          {rejectMutation.isError && (
            <p className="text-xs text-danger">
              {rejectMutation.error.message}
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
