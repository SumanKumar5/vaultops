import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Download, Copy, Check } from "lucide-react";
import { secretsApi } from "../api/secrets";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import { cn } from "../lib/utils";

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  environment: string;
}

type Format = "env" | "json" | "yaml";

export function ExportModal({
  open,
  onClose,
  projectId,
  environment,
}: ExportModalProps) {
  const [format, setFormat] = useState<Format>("env");
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const mutation = useMutation({
    mutationFn: () => secretsApi.bulkExport(projectId, environment, format),
    onSuccess: (data) => setResult(data),
  });

  async function handleCopy() {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    if (!result) return;
    const ext = format === "json" ? "json" : format === "yaml" ? "yaml" : "env";
    const blob = new Blob([result], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${environment}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const formats: { value: Format; label: string; desc: string }[] = [
    { value: "env", label: ".env", desc: "KEY=value format" },
    { value: "json", label: "JSON", desc: "Structured object" },
    { value: "yaml", label: "YAML", desc: "YAML key-value" },
  ];

  return (
    <Modal
      open={open}
      onClose={() => {
        onClose();
        setResult(null);
      }}
      title="Bulk Export"
      size="lg"
    >
      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium text-text-muted uppercase tracking-wider block mb-2">
            Format
          </label>
          <div className="flex gap-2">
            {formats.map((f) => (
              <button
                key={f.value}
                onClick={() => {
                  setFormat(f.value);
                  setResult(null);
                }}
                className={cn(
                  "flex-1 py-2.5 px-3 rounded-lg border text-left transition-all cursor-pointer",
                  format === f.value
                    ? "bg-accent/10 border-accent/40 text-accent"
                    : "bg-surface-2 border-border text-text-secondary hover:border-border-strong",
                )}
              >
                <p className="text-sm font-mono font-semibold">{f.label}</p>
                <p className="text-xs text-text-muted mt-0.5">{f.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {!result ? (
          <Button
            variant="primary"
            loading={mutation.isPending}
            icon={<Download size={13} />}
            onClick={() => mutation.mutate()}
            className="w-full justify-center"
          >
            Export {environment} secrets
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">Preview</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={
                    copied ? (
                      <Check size={12} className="text-success" />
                    ) : (
                      <Copy size={12} />
                    )
                  }
                  onClick={handleCopy}
                >
                  {copied ? "Copied" : "Copy"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Download size={12} />}
                  onClick={handleDownload}
                >
                  Download
                </Button>
              </div>
            </div>
            <pre className="bg-surface-0 border border-border rounded-lg p-4 text-xs font-mono text-text-secondary overflow-auto max-h-72 whitespace-pre-wrap break-all">
              {result}
            </pre>
          </div>
        )}

        {mutation.isError && (
          <p className="text-xs text-danger">{mutation.error.message}</p>
        )}
      </div>
    </Modal>
  );
}
