import { cn } from "../../lib/utils";
import { forwardRef } from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className, ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          {...props}
          className={cn(
            "w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary",
            "placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30",
            "transition-all duration-150",
            icon && "pl-9",
            error && "border-danger focus:border-danger focus:ring-danger/30",
            className,
          )}
        />
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  ),
);
Input.displayName = "Input";
