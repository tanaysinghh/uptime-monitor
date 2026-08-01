import { cn } from "../../lib/utils";

// Sharp-cornered surface. Hairline bone border, no shadow.
// Use `flush` for cards that live inside a bordered container (avoid double borders).
export const Card = ({ className, flush = false, children, ...props }) => (
  <div
    className={cn(
      "bg-paper",
      !flush && "hairline",
      className
    )}
    {...props}
  >
    {children}
  </div>
);

export const CardHeader = ({ className, children, ...props }) => (
  <div className={cn("px-6 py-5 hairline-b", className)} {...props}>
    {children}
  </div>
);

export const CardBody = ({ className, children, ...props }) => (
  <div className={cn("px-6 py-5", className)} {...props}>
    {children}
  </div>
);

export const CardTitle = ({ className, children, as: As = "h2", ...props }) => (
  <As
    className={cn(
      "text-lg font-medium text-ink",
      className
    )}
    {...props}
  >
    {children}
  </As>
);

export const CardDescription = ({ className, children, ...props }) => (
  <p className={cn("text-sm text-muted mt-1", className)} {...props}>
    {children}
  </p>
);
