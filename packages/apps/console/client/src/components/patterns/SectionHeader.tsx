import * as React from "react";
import { cn } from "@/lib/utils";

export interface SectionHeaderProps extends React.HTMLAttributes<HTMLHeadingElement> {
  title: string;
  count?: number;
}

const SectionHeader = React.forwardRef<HTMLHeadingElement, SectionHeaderProps>(
  ({ className, title, count, ...props }, ref) => {
    return (
      <h2
        ref={ref}
        className={cn(
          "text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4",
          className
        )}
        {...props}
      >
        {title}
        {count !== undefined && ` (${count})`}
      </h2>
    );
  }
);

SectionHeader.displayName = "SectionHeader";

export { SectionHeader };
