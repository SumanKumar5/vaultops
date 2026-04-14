import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  X,
  Eye,
  EyeOff,
  Copy,
  Check,
  Clock,
  RotateCcw,
  History,
  ChevronRight,
  AlertTriangle,
  Trash2,
  Shield,
} from "lucide-react";
import { secretsApi, type SecretMeta } from "../api/secrets";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";
import { cn, formatDate, timeAgo, isExpired } from "../lib/utils";

interface SecretSlideOverProps {
  projectId: string;
  environment: string;
  secret: SecretMeta | null;
  onClose: () => void;
  onEdit: (secret: SecretMeta) => void;
}

function ValueReveal({
  projectId,
  environment,
  keyName,
}: {
  projectId: string;
  environment: string;
  keyName: string;
}) {
  const [step, setStep] = useState<"hidden" | "confirm" | "revealed">("hidden");
  const [copied, setCopied] = useState(false);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["secret-value", projectId, environment, keyName],
    queryFn: () => secretsApi.get(projectId, keyName, environment),
    enabled: false,
  });

  async function handleReveal() {
    if (step === "hidden") {
      setStep("confirm");
      return;
    }
    await refetch();
    setStep("revealed");
  }

  async function handleCopy() {
    if (!data?.value) return;
    await navigator.clipboard.writeText(data.value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (step === "revealed" && data) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
            Value
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors cursor-pointer"
            >
              {copied ? (
                <Check size={12} className="text-success" />
              ) : (
                <Copy size={12} />
              )}
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              onClick={() => setStep("hidden")}
              className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors cursor-pointer"
            >
              <EyeOff size={12} />
              Hide
            </button>
          </div>
        </div>
        <div className="bg-surface-0 border border-border rounded-lg p-3 font-mono text-sm text-text-primary break-all select-all">
          {data.value}
        </div>
      </div>
    );
  }

  if (step === "confirm") {
    return (
      <div className="bg-warning/5 border border-warning/20 rounded-lg p-4 space-y-3">
        <div className="flex items-start gap-3">
          <Shield size={16} className="text-warning mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-text-primary">
              Reveal secret value?
            </p>
            <p className="text-xs text-text-muted mt-1">
              This action will be logged in the audit trail.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="warning"
            size="sm"
            loading={isFetching}
            onClick={handleReveal}
            icon={<Eye size={13} />}
          >
            Yes, reveal
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setStep("hidden")}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={handleReveal}
      className="w-full flex items-center gap-3 bg-surface-2 hover:bg-surface-3 border border-border rounded-lg p-3 transition-colors cursor-pointer group"
    >
      <div className="flex-1 flex items-center gap-3">
        <div className="flex gap-1">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-text-muted group-hover:bg-text-secondary transition-colors"
            />
          ))}
        </div>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-text-muted group-hover:text-accent transition-colors">
        <Eye size={13} />
        <span>Reveal</span>
      </div>
    </button>
  );
}

function VersionTimeline({
  versions,
  onRollback,
}: {
  versions: SecretMeta[];
  onRollback: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      {versions.map((v, idx) => (
        <div
          key={v.id}
          className={cn(
            "flex items-start gap-3 p-3 rounded-lg border transition-colors",
            v.is_current
              ? "bg-accent/5 border-accent/20"
              : "bg-surface-2 border-border",
          )}
        >
          <div className="flex flex-col items-center gap-1 pt-0.5">
            <div
              className={cn(
                "w-2 h-2 rounded-full flex-shrink-0",
                v.is_current ? "bg-accent" : "bg-text-muted",
              )}
            />
            {idx < versions.length - 1 && (
              <div className="w-px h-4 bg-border" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-medium text-text-primary">
                  v{v.version}
                </span>
                {v.is_current && <Badge variant="accent">current</Badge>}
              </div>
              {!v.is_current && (
                <button
                  onClick={() => onRollback(v.version)}
                  className="flex items-center gap-1 text-xs text-text-muted hover:text-accent transition-colors cursor-pointer"
                >
                  <RotateCcw size={11} />
                  Rollback
                </button>
              )}
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              {formatDate(v.created_at)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function SecretSlideOver({
  projectId,
  environment,
  secret,
  onClose,
  onEdit,
}: SecretSlideOverProps) {
  const [tab, setTab] = useState<"value" | "history">("value");
  const [rollbackTarget, setRollbackTarget] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const queryClient = useQueryClient();

  const { data: history = [] } = useQuery({
    queryKey: ["secret-history", projectId, environment, secret?.key_name],
    queryFn: () => secretsApi.history(projectId, secret!.key_name, environment),
    enabled: !!secret && tab === "history",
  });

  const rollbackMutation = useMutation({
    mutationFn: (version: number) =>
      secretsApi.rollback(projectId, secret!.key_name, environment, version),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["secrets", projectId, environment],
      });
      queryClient.invalidateQueries({ queryKey: ["secret-history"] });
      setRollbackTarget(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      secretsApi.delete(projectId, secret!.key_name, environment),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["secrets", projectId, environment],
      });
      onClose();
    },
  });

  if (!secret) return null;

  const expired = isExpired(secret.expires_at);

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      <div className="fixed right-0 top-0 h-full w-full max-w-md z-50 flex flex-col bg-surface-1 border-l border-border shadow-2xl animate-slide-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
              <Shield size={14} className="text-accent" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-mono font-semibold text-text-primary truncate">
                {secret.key_name}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant={expired ? "danger" : "success"}>
                  {expired ? "expired" : "active"}
                </Badge>
                <span className="text-xs text-text-muted">
                  v{secret.version}
                </span>
                <span className="text-xs text-text-muted">· {environment}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              icon={<Trash2 size={13} />}
              onClick={() => setDeleteConfirm(true)}
              className="text-danger hover:text-danger"
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onEdit(secret)}
            >
              Edit
            </Button>
            <button
              onClick={onClose}
              className="p-1.5 text-text-muted hover:text-text-primary rounded-md hover:bg-surface-3 transition-colors cursor-pointer ml-1"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex border-b border-border">
          {(["value", "history"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 text-xs font-medium transition-colors cursor-pointer",
                tab === t
                  ? "text-accent border-b-2 border-accent bg-accent/5"
                  : "text-text-muted hover:text-text-secondary hover:bg-surface-2",
              )}
            >
              {t === "value" ? <Eye size={13} /> : <History size={13} />}
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {tab === "value" ? (
            <>
              <ValueReveal
                projectId={projectId}
                environment={environment}
                keyName={secret.key_name}
              />

              <div className="space-y-3">
                <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider">
                  Details
                </h3>
                <div className="bg-surface-2 border border-border rounded-lg divide-y divide-border">
                  {[
                    { label: "Version", value: `v${secret.version}` },
                    { label: "Environment", value: environment },
                    { label: "Created", value: timeAgo(secret.created_at) },
                    {
                      label: "Updated",
                      value: secret.rotated_at
                        ? timeAgo(secret.rotated_at)
                        : "—",
                    },
                    {
                      label: "Expires",
                      value: secret.expires_at
                        ? formatDate(secret.expires_at)
                        : "Never",
                      danger: expired,
                    },
                  ].map(({ label, value, danger }) => (
                    <div
                      key={label}
                      className="flex items-center justify-between px-4 py-2.5"
                    >
                      <span className="text-xs text-text-muted">{label}</span>
                      <span
                        className={cn(
                          "text-xs font-medium",
                          danger ? "text-danger" : "text-text-primary",
                        )}
                      >
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {secret.tags?.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider">
                    Tags
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {secret.tags.map((tag) => (
                      <Badge key={tag} variant="default">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider">
                Version History
              </h3>
              {history.length === 0 ? (
                <p className="text-sm text-text-muted text-center py-8">
                  No history available
                </p>
              ) : (
                <VersionTimeline
                  versions={history}
                  onRollback={setRollbackTarget}
                />
              )}
            </div>
          )}
        </div>
      </div>

      <Modal
        open={rollbackTarget !== null}
        onClose={() => setRollbackTarget(null)}
        title="Confirm Rollback"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-warning/5 border border-warning/20 rounded-lg">
            <AlertTriangle
              size={16}
              className="text-warning mt-0.5 flex-shrink-0"
            />
            <p className="text-sm text-text-secondary">
              This will create a new version (v{(secret.version ?? 0) + 1})
              copying the value from{" "}
              <span className="font-mono text-text-primary">
                v{rollbackTarget}
              </span>
              . The current version will be preserved in history.
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="primary"
              loading={rollbackMutation.isPending}
              onClick={() =>
                rollbackTarget && rollbackMutation.mutate(rollbackTarget)
              }
              icon={<RotateCcw size={13} />}
            >
              Rollback to v{rollbackTarget}
            </Button>
            <Button variant="ghost" onClick={() => setRollbackTarget(null)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        title="Delete Secret"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-danger/5 border border-danger/20 rounded-lg">
            <Trash2 size={16} className="text-danger mt-0.5 flex-shrink-0" />
            <p className="text-sm text-text-secondary">
              Soft-deleting{" "}
              <span className="font-mono text-text-primary">
                {secret.key_name}
              </span>
              . All versions will be marked inactive. This cannot be undone.
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="danger"
              loading={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
              icon={<Trash2 size={13} />}
            >
              Delete
            </Button>
            <Button variant="ghost" onClick={() => setDeleteConfirm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
