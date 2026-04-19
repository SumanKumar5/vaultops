import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ShieldCheck,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Filter,
  Activity,
} from "lucide-react";
import { auditApi, type AuditEvent } from "../api/audit";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { formatDate } from "../lib/utils";
import { cn } from "../lib/utils";

interface AuditLogTableProps {
  orgId: string;
  projectId?: string;
}

function eventVariant(
  type: string,
): "success" | "danger" | "warning" | "info" | "default" {
  if (type.includes("READ")) return "info";
  if (type.includes("EXPORT")) return "info";
  if (type.includes("WRITTEN")) return "success";
  if (type.includes("ROLLBACK")) return "accent" as "default";
  if (type.includes("DELETED")) return "danger";
  if (type.includes("GRANTED") || type.includes("APPROVED")) return "success";
  if (type.includes("DENIED") || type.includes("REJECTED")) return "danger";
  if (type.includes("REQUESTED")) return "warning";
  if (type.includes("POLICY")) return "warning";
  return "default";
}

function eventColor(type: string): string {
  if (type.includes("READ") || type.includes("EXPORT"))
    return "text-info bg-info/10 border-info/20";
  if (type.includes("WRITTEN") || type.includes("ROLLBACK"))
    return "text-success bg-success/10 border-success/20";
  if (type.includes("DELETED") || type.includes("DENIED"))
    return "text-danger bg-danger/10 border-danger/20";
  if (type.includes("GRANTED"))
    return "text-success bg-success/10 border-success/20";
  if (type.includes("REQUESTED") || type.includes("POLICY"))
    return "text-warning bg-warning/10 border-warning/20";
  return "text-text-secondary bg-surface-3 border-border";
}

function VerifyBanner({ orgId }: { orgId: string }) {
  const [triggered, setTriggered] = useState(false);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["audit-verify", orgId],
    queryFn: () => auditApi.verify(orgId),
    enabled: false,
    staleTime: 0,
    gcTime: 0,
  });

  async function handleVerify() {
    setTriggered(true);
    await refetch();
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Button
        variant="secondary"
        size="sm"
        loading={isFetching}
        icon={
          triggered && data ? (
            data.valid ? (
              <ShieldCheck size={13} className="text-success" />
            ) : (
              <ShieldAlert size={13} className="text-danger" />
            )
          ) : (
            <ShieldCheck size={13} />
          )
        }
        onClick={handleVerify}
      >
        Verify Chain Integrity
      </Button>
      {triggered && data && !isFetching && (
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border animate-fade-in",
            data.valid
              ? "bg-success/10 text-success border-success/20"
              : "bg-danger/10 text-danger border-danger/20",
          )}
        >
          {data.valid ? (
            <>
              <ShieldCheck size={13} /> Chain intact — all entries verified
            </>
          ) : (
            <>
              <ShieldAlert size={13} /> Tamper detected at entry #
              {data.first_broken_at}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function AuditLogTable({ orgId, projectId }: AuditLogTableProps) {
  const [page, setPage] = useState(1);
  const [eventTypeFilter, setEventTypeFilter] = useState("");
  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ["audit-log", orgId, projectId, page, eventTypeFilter],
    queryFn: () =>
      auditApi.list(orgId, {
        project_id: projectId,
        event_type: eventTypeFilter || undefined,
        page,
        limit,
      }),
  });

  const totalPages = data ? Math.ceil(data.total / limit) : 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <VerifyBanner orgId={orgId} />
        <Input
          placeholder="Filter by event type e.g. SECRET_READ"
          value={eventTypeFilter}
          onChange={(e) => {
            setEventTypeFilter(e.target.value.toUpperCase());
            setPage(1);
          }}
          icon={<Filter size={13} />}
          className="w-64 text-xs"
        />
      </div>

      <div className="bg-surface-1 border border-border rounded-xl overflow-hidden">
        <div className="grid grid-cols-[180px_140px_1fr_160px] border-b border-border bg-surface-2 px-5 py-3">
          {["Event", "Actor", "Resource / Key", "Time"].map((h) => (
            <span
              key={h}
              className="text-xs font-semibold text-text-muted uppercase tracking-wider"
            >
              {h}
            </span>
          ))}
        </div>

        <div className="divide-y divide-border-subtle">
          {isLoading ? (
            Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="grid grid-cols-[180px_140px_1fr_160px] px-5 py-4"
              >
                {Array.from({ length: 4 }).map((_, j) => (
                  <div
                    key={j}
                    className="h-4 bg-surface-3 rounded animate-pulse mr-6"
                  />
                ))}
              </div>
            ))
          ) : data?.data.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Activity size={28} className="text-text-muted" />
              <p className="text-sm text-text-muted">No audit events found</p>
              {eventTypeFilter && (
                <button
                  onClick={() => setEventTypeFilter("")}
                  className="text-xs text-accent hover:underline cursor-pointer"
                >
                  Clear filter
                </button>
              )}
            </div>
          ) : (
            data?.data.map((event: AuditEvent) => (
              <div
                key={event.id}
                className="grid grid-cols-[180px_140px_1fr_160px] px-5 py-3.5 hover:bg-surface-2 transition-colors"
              >
                <div className="flex items-center">
                  <span
                    className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-medium border",
                      eventColor(event.event_type),
                    )}
                  >
                    {event.event_type.replace(/_/g, " ")}
                  </span>
                </div>

                <div className="flex items-center">
                  <div>
                    <p className="text-xs font-mono text-text-primary">
                      {event.actor_id
                        ? event.actor_id.slice(0, 8) + "..."
                        : "system"}
                    </p>
                    <p className="text-xs text-text-muted mt-0.5">
                      {event.actor_type}
                    </p>
                  </div>
                </div>

                <div className="flex items-center min-w-0 pr-4">
                  <div className="min-w-0">
                    {event.metadata?.key_name ? (
                      <p className="text-xs font-mono font-medium text-text-primary truncate">
                        {String(event.metadata.key_name)}
                      </p>
                    ) : (
                      <p className="text-xs font-mono text-text-muted truncate">
                        {event.resource_id
                          ? event.resource_id.slice(0, 16) + "..."
                          : "—"}
                      </p>
                    )}
                    {event.metadata?.environment ? (
                      <p className="text-xs text-text-muted mt-0.5">
                        {String(event.metadata.environment)}
                      </p>
                    ) : event.resource_type ? (
                      <p className="text-xs text-text-muted mt-0.5">
                        {event.resource_type}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center">
                  <p className="text-xs text-text-muted">
                    {formatDate(event.occurred_at)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {data && totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-surface-2">
            <p className="text-xs text-text-muted">
              Showing {(page - 1) * limit + 1}–
              {Math.min(page * limit, data.total)} of {data.total} events
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                icon={<ChevronLeft size={13} />}
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              />
              <span className="text-xs text-text-secondary px-2">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                icon={<ChevronRight size={13} />}
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
