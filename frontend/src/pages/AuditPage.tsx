import { useNavigate } from "react-router-dom";
import { Shield, ArrowLeft } from "lucide-react";
import { AuditLogTable } from "../components/AuditLogTable";
import { Button } from "../components/ui/Button";

const DEFAULT_ORG = "a0000000-0000-0000-0000-000000000001";
const DEFAULT_PROJECT = "c0000000-0000-0000-0000-000000000001";

export function AuditPage() {
  const navigate = useNavigate();

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
          <Button
            variant="ghost"
            size="sm"
            icon={<ArrowLeft size={13} />}
            onClick={() => navigate("/")}
          >
            Back to Secrets
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Audit Log</h1>
          <p className="text-sm text-text-muted mt-0.5">
            Tamper-evident chain of all secret access and management events
          </p>
        </div>
        <AuditLogTable orgId={DEFAULT_ORG} projectId={DEFAULT_PROJECT} />
      </div>
    </div>
  );
}
