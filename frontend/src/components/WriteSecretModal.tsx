import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Info, CheckCircle } from "lucide-react";
import { secretsApi, type SecretMeta } from "../api/secrets";
import { Modal } from "./ui/Modal";
import { Input } from "./ui/Input";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";

const schema = z.object({
  key_name: z
    .string()
    .min(1)
    .regex(/^[A-Z0-9_]+$/, "Use UPPER_SNAKE_CASE only"),
  value: z.string().min(1, "Value is required"),
  tags: z.string().optional(),
  expires_at: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface WriteSecretModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  environment: string;
  editing?: SecretMeta | null;
  onApprovalCreated?: () => void;
}

export function WriteSecretModal({
  open,
  onClose,
  projectId,
  environment,
  editing,
  onApprovalCreated,
}: WriteSecretModalProps) {
  const queryClient = useQueryClient();
  const isProduction = environment === "production";
  const [approvalCreated, setApprovalCreated] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    values: editing
      ? { key_name: editing.key_name, value: "", tags: "", expires_at: "" }
      : undefined,
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      secretsApi.write(projectId, data.key_name, {
        environment,
        value: data.value,
        tags: data.tags
          ? data.tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
        expires_at: data.expires_at || undefined,
      }),
    onSuccess: ({ status }) => {
      queryClient.invalidateQueries({
        queryKey: ["secrets", projectId, environment],
      });
      queryClient.invalidateQueries({
        queryKey: ["change-requests", projectId],
      });
      reset();
      if (status === 202) {
        setApprovalCreated(true);
        setTimeout(() => {
          queryClient.invalidateQueries({
            queryKey: ["change-requests", projectId],
          });
          onApprovalCreated?.();
        }, 300);
      } else {
        onClose();
      }
    },
  });

  function handleClose() {
    setApprovalCreated(false);
    reset();
    onClose();
  }

  if (approvalCreated) {
    return (
      <Modal
        open={open}
        onClose={handleClose}
        title="Change Request Created"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
              <CheckCircle size={24} className="text-success" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">
                Approval request created
              </p>
              <p className="text-xs text-text-muted mt-1">
                A reviewer must approve this change before it takes effect in
                production.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              variant="primary"
              className="flex-1 justify-center"
              onClick={() => {
                onApprovalCreated?.();
                handleClose();
              }}
            >
              View Pending Approvals
            </Button>
            <Button variant="ghost" onClick={handleClose}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={editing ? `Edit ${editing.key_name}` : "New Secret"}
      size="md"
    >
      <form
        onSubmit={handleSubmit((d) => mutation.mutate(d))}
        className="space-y-4"
      >
        {isProduction && (
          <div className="flex items-start gap-3 p-3 bg-warning/5 border border-warning/20 rounded-lg">
            <Info size={15} className="text-warning mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-warning">
                Approval required
              </p>
              <p className="text-xs text-text-muted mt-0.5">
                Changes to production secrets require review before they take
                effect.
              </p>
            </div>
          </div>
        )}

        <Input
          label="Key Name"
          placeholder="DB_PASSWORD"
          {...register("key_name")}
          error={errors.key_name?.message}
          disabled={!!editing}
          className="font-mono"
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">
            Value
          </label>
          <textarea
            {...register("value")}
            rows={3}
            placeholder="Enter secret value..."
            className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary font-mono placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all resize-none"
          />
          {errors.value && (
            <p className="text-xs text-danger">{errors.value.message}</p>
          )}
        </div>

        <Input
          label="Tags (comma separated)"
          placeholder="database, credentials, aws"
          {...register("tags")}
        />

        <Input
          label="Expires At (optional)"
          type="datetime-local"
          {...register("expires_at")}
        />

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div className="flex items-center gap-2">
            <Badge variant={isProduction ? "warning" : "success"}>
              {environment}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" type="button" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              loading={mutation.isPending}
              icon={<Save size={13} />}
            >
              {isProduction ? "Request Change" : "Save Secret"}
            </Button>
          </div>
        </div>

        {mutation.isError && (
          <p className="text-xs text-danger bg-danger/5 border border-danger/20 rounded-lg px-3 py-2">
            {mutation.error.message}
          </p>
        )}
      </form>
    </Modal>
  );
}
