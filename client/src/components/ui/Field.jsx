import * as React from "react";
import { cn } from "../../lib/utils";

// Base input styles: hairline border, sharp corners, ink text on paper.
// Height 44px for touch target.
const baseInput =
  "w-full h-11 px-3 bg-paper text-ink hairline text-sm font-sans placeholder:text-muted/60 focus-visible:outline-none focus-visible:border-ink transition-colors";

export const Input = React.forwardRef(({ className, mono = false, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(baseInput, mono && "font-num", className)}
    {...props}
  />
));
Input.displayName = "Input";

export const Select = React.forwardRef(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(baseInput, "appearance-none pr-8 bg-[url('data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2210%22%20height%3D%226%22%20viewBox%3D%220%200%2010%206%22%3E%3Cpath%20d%3D%22M1%201l4%204%204-4%22%20stroke%3D%22%236B655A%22%20fill%3D%22none%22%20stroke-width%3D%221.5%22%2F%3E%3C%2Fsvg%3E')] bg-[right_12px_center] bg-no-repeat", className)}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";

export const Textarea = React.forwardRef(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(baseInput, "h-auto py-3 min-h-[80px] resize-y", className)}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export const Label = ({ className, children, htmlFor, required = false, ...props }) => (
  <label
    htmlFor={htmlFor}
    className={cn("block text-xs font-medium text-muted uppercase tracking-wider mb-2", className)}
    {...props}
  >
    {children}
    {required && <span className="text-pulse ml-1" aria-hidden="true">*</span>}
  </label>
);

export const HelpText = ({ className, children, ...props }) => (
  <p className={cn("text-xs text-muted mt-1.5", className)} {...props}>{children}</p>
);

export const FieldError = ({ className, children, ...props }) => (
  <p role="alert" className={cn("text-xs text-st-down mt-1.5", className)} {...props}>{children}</p>
);

// Composed field wrapper — pairs label + control + optional help/error.
export const Field = ({ label, htmlFor, required, help, error, children, className }) => (
  <div className={cn("block", className)}>
    {label && <Label htmlFor={htmlFor} required={required}>{label}</Label>}
    {children}
    {error ? <FieldError>{error}</FieldError> : help ? <HelpText>{help}</HelpText> : null}
  </div>
);
