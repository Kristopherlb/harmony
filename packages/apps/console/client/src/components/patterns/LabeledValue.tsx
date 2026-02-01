import * as React from "react";
import { cn } from "@/lib/utils";

export interface LabeledValueProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: React.ReactNode;
  align?: "left" | "right" | "between";
}

const LabeledValue = React.forwardRef<HTMLDivElement, LabeledValueProps>(
  ({ className, label, value, align = "between", ...props }, ref) => {
    const alignClasses = {
      left: "justify-start",
      right: "justify-end",
      between: "justify-between",
    };

    return (
      <div
        ref={ref}
        className={cn("flex items-center gap-2", alignClasses[align], className)}
        {...props}
      >
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold">{value}</span>
      </div>
    );
  }
);

LabeledValue.displayName = "LabeledValue";

export { LabeledValue };
