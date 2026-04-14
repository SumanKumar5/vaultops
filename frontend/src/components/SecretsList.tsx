import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  Plus,
  Download,
  RefreshCw,
  Key,
  Clock,
  Tag,
  AlertTriangle,
} from "lucide-react";
import { secretsApi, type SecretMeta } from "../api/secrets";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { cn, timeAgo, isExpired, isExpiringSoon } from "../lib/utils";

interface SecretsListProps {
  projectId: string;
  environment: string;
  onSelect: (secret: SecretMeta) => void;
  onNew: () => void;
  onExport: () => void;
  selectedKey?: string;
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-5 py-4 border-b border-border-subtle">
      <div className="w-8 h-8 rounded-lg bg-surface-3 animate-pulse" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-48 bg-surface-3 rounded animate-pulse" />
        <div className="h-3 w-32 bg-surface-3 rounded animate-pulse" />
      </div>
      <div className="h-5 w-16 bg-surface-3 rounded animate-pulse" />
    </div>
  );
}

function SecretRow({
  secret,
  selected,
  onClick,
}: {
  secret: SecretMeta;
  selected: boolean;
  onClick: () => void;
}) {
  const expired = isExpired(secret.expires_at);
  const expiringSoon = isExpiringSoon(secret.expires_at);

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-4 px-5 py-3.5 border-b border-border-subtle cursor-pointer transition-all duration-100 group",
        selected
          ? "bg-accent/10 border-l-2 border-l-accent"
          : "hover:bg-surface-2 border-l-2 border-l-transparent",
      )}
    >
      <div
        className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors",
          selected ? "bg-accent/20" : "bg-surface-3 group-hover:bg-surface-4",
        )}
      >
        <Key
          size={14}
          className={selected ? "text-accent" : "text-text-muted"}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-sm font-mono font-medium truncate",
              selected ? "text-accent" : "text-text-primary",
            )}
          >
            {secret.key_name}
          </span>
          {expired && (
            <AlertTriangle size={12} className="text-danger flex-shrink-0" />
          )}
          {expiringSoon && !expired && (
            <Clock size={12} className="text-warning flex-shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-xs text-text-muted">v{secret.version}</span>
          <span className="text-xs text-text-muted">·</span>
          <span className="text-xs text-text-muted">
            {timeAgo(secret.created_at)}
          </span>
          {secret.tags?.length > 0 && (
            <>
              <span className="text-xs text-text-muted">·</span>
              <Tag size={10} className="text-text-muted" />
              <span className="text-xs text-text-muted">
                {secret.tags.slice(0, 2).join(", ")}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {expired ? (
          <Badge variant="danger">expired</Badge>
        ) : expiringSoon ? (
          <Badge variant="warning">expiring</Badge>
        ) : (
          <Badge variant="success">active</Badge>
        )}
      </div>
    </div>
  );
}

export function SecretsList({
  projectId,
  environment,
  onSelect,
  onNew,
  onExport,
  selectedKey,
}: SecretsListProps) {
  const [search, setSearch] = useState("");

  const {
    data: secrets = [],
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["secrets", projectId, environment, search],
    queryFn: () => secretsApi.list(projectId, environment, search || undefined),
    enabled: !!projectId && !!environment,
  });

  return (
    <div className="flex flex-col h-full bg-surface-1 border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border bg-surface-2">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Secrets</h2>
            <p className="text-xs text-text-muted mt-0.5">
              {isLoading
                ? "Loading..."
                : `${secrets.length} keys in ${environment}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              icon={
                <RefreshCw
                  size={13}
                  className={isFetching ? "animate-spin" : ""}
                />
              }
              onClick={() => refetch()}
            >
              Refresh
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={<Download size={13} />}
              onClick={onExport}
            >
              Export
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Plus size={13} />}
              onClick={onNew}
            >
              New
            </Button>
          </div>
        </div>
        <Input
          placeholder="Search secrets..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          icon={<Search size={14} />}
          className="bg-surface-1"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
        ) : secrets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-8">
            <div className="w-12 h-12 rounded-xl bg-surface-3 flex items-center justify-center">
              <Key size={20} className="text-text-muted" />
            </div>
            <div>
              <p className="text-sm font-medium text-text-secondary">
                No secrets found
              </p>
              <p className="text-xs text-text-muted mt-1">
                {search
                  ? "Try a different search term"
                  : "Add your first secret to get started"}
              </p>
            </div>
            {!search && (
              <Button
                variant="primary"
                size="sm"
                icon={<Plus size={13} />}
                onClick={onNew}
              >
                Add Secret
              </Button>
            )}
          </div>
        ) : (
          secrets.map((secret) => (
            <SecretRow
              key={secret.id}
              secret={secret}
              selected={selectedKey === secret.key_name}
              onClick={() => onSelect(secret)}
            />
          ))
        )}
      </div>
    </div>
  );
}
