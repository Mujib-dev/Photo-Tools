import * as React from "react";

import { cn } from "@/lib/utils";
import { hasQueryInjection } from "@/lib/validation";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /**
   * When enabled (default: true), prevents typing or pasting malicious query injection tokens (SQL, script/XSS, path traversal)
   */
  preventQueryInjection?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, preventQueryInjection = true, onChange, onPaste, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (preventQueryInjection && hasQueryInjection(e.target.value)) {
        // Block the malicious query token from being entered into the input
        return;
      }
      onChange?.(e);
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
      if (preventQueryInjection) {
        const text = e.clipboardData?.getData("text") || "";
        if (hasQueryInjection(text)) {
          e.preventDefault();
          return;
        }
      }
      onPaste?.(e);
    };

    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        onChange={handleChange}
        onPaste={handlePaste}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
