import { useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { Shield, ChevronDown, Bell, GitBranch } from "lucide-react";
import { SecretsList } from "../components/SecretsList";
import { SecretSlideOver } from "../components/SecretSlideOver";
import { WriteSecretModal } from "../components/WriteSecretModal";
import { ChangeRequestsPanel } from "../components/ChangeRequestsPanel";
import { ExportModal } from "../components/ExportModal";
import { type SecretMeta } from "../api/secrets";
import { Badge } from "../components/ui/Badge";
import { cn } from "../lib/utils";

const ENVIRONMENTS = ["development", "staging", "production"];
const ENV_COLORS = {
  development: "success",
  staging: "warning",
  production: "danger",
} as const;

const PROJECTS = [
  {
    id: "c0000000-0000-0000-0000-000000000001",
    name: "Web Application",
    org: "Acme Corp",
  },
  {
    id: "c0000000-0000-0000-0000-000000000002",
    name: "API Gateway",
    org: "Acme Corp",
  },
  {
    id: "c0000000-0000-0000-0000-000000000003",
    name: "Data Pipeline",
    org: "Acme Corp",
  },
  {
    id: "c0000000-0000-0000-0000-000000000004",
    name: "Auth Service",
    org: "Acme Corp",
  },
  {
    id: "c0000000-0000-0000-0000-000000000010",
    name: "Payments Service",
    org: "Acme Corp",
  },
];

export function SecretsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const projectId = searchParams.get("project") ?? PROJECTS[0].id;
  const environment = searchParams.get("env") ?? "production";
  const activeTab = searchParams.get("tab") ?? "secrets";

  const [selectedSecret, setSelectedSecret] = useState<SecretMeta | null>(null);
  const [writeModalOpen, setWriteModalOpen] = useState(false);
  const [editingSecret, setEditingSecret] = useState<SecretMeta | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);

  const currentProject =
    PROJECTS.find((p) => p.id === projectId) ?? PROJECTS[0];

  function setEnv(env: string) {
    setSearchParams((p) => {
      p.set("env", env);
      return p;
    });
    setSelectedSecret(null);
  }

  function setProject(id: string) {
    setSearchParams((p) => {
      p.set("project", id);
      p.set("env", "production");
      return p;
    });
    setSelectedSecret(null);
    setProjectDropdownOpen(false);
  }

  function setTab(tab: string) {
    setSearchParams((p) => {
      p.set("tab", tab);
      return p;
    });
  }

  return (
    <div className="flex flex-col h-screen bg-surface-0">
      <header className="flex items-center justify-between px-6 py-3.5 border-b border-border bg-surface-1 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
              <Shield size={14} className="text-white" />
            </div>
            <span className="text-sm font-bold text-text-primary tracking-tight">
              VaultOps
            </span>
          </div>
          <span className="text-border text-lg font-light">|</span>
          <div className="relative">
            <button
              onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-2 border border-border hover:border-border-strong transition-colors text-sm text-text-primary cursor-pointer"
            >
              <GitBranch size={13} className="text-text-muted" />
              {currentProject.name}
              <ChevronDown size={13} className="text-text-muted" />
            </button>
            {projectDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-56 bg-surface-2 border border-border rounded-xl shadow-xl z-50 overflow-hidden animate-scale-in">
                {PROJECTS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setProject(p.id)}
                    className={cn(
                      "w-full text-left px-4 py-2.5 text-sm transition-colors cursor-pointer",
                      p.id === projectId
                        ? "bg-accent/10 text-accent"
                        : "text-text-secondary hover:bg-surface-3",
                    )}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/audit")}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-muted hover:text-text-primary rounded-lg hover:bg-surface-2 transition-colors cursor-pointer"
          >
            <Bell size={13} />
            Audit Log
          </button>
        </div>
      </header>

      <div className="flex items-center gap-1 px-6 py-2 border-b border-border bg-surface-1 flex-shrink-0">
        {ENVIRONMENTS.map((env) => (
          <button
            key={env}
            onClick={() => setEnv(env)}
            className={cn(
              "flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer",
              environment === env
                ? "bg-surface-3 text-text-primary border border-border"
                : "text-text-muted hover:text-text-secondary hover:bg-surface-2",
            )}
          >
            <div
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                environment === env
                  ? env === "production"
                    ? "bg-danger"
                    : env === "staging"
                      ? "bg-warning"
                      : "bg-success"
                  : "bg-text-muted",
              )}
            />
            {env}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1 px-6 py-2 border-b border-border bg-surface-1 flex-shrink-0">
        {[
          { key: "secrets", label: "Secrets" },
          { key: "approvals", label: "Pending Approvals" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-4 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer",
              activeTab === t.key
                ? "bg-accent/10 text-accent"
                : "text-text-muted hover:text-text-secondary",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden p-5">
        {activeTab === "secrets" ? (
          <SecretsList
            projectId={projectId}
            environment={environment}
            onSelect={setSelectedSecret}
            onNew={() => {
              setEditingSecret(null);
              setWriteModalOpen(true);
            }}
            onExport={() => setExportModalOpen(true)}
            selectedKey={selectedSecret?.key_name}
          />
        ) : (
          <div className="h-full overflow-y-auto">
            <ChangeRequestsPanel projectId={projectId} />
          </div>
        )}
      </div>

      <SecretSlideOver
        projectId={projectId}
        environment={environment}
        secret={selectedSecret}
        onClose={() => setSelectedSecret(null)}
        onEdit={(s) => {
          setEditingSecret(s);
          setWriteModalOpen(true);
        }}
      />

      <WriteSecretModal
        open={writeModalOpen}
        onClose={() => {
          setWriteModalOpen(false);
          setEditingSecret(null);
        }}
        projectId={projectId}
        environment={environment}
        editing={editingSecret}
      />

      <ExportModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        projectId={projectId}
        environment={environment}
      />
    </div>
  );
}
