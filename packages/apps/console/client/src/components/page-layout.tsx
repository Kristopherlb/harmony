import { ReactNode } from "react";
import { useLocation } from "wouter";
import { NOCHeader } from "./noc-header";

export function PageLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const isWorkbench = location === "/workbench";

  return (
    <div
      className={
        isWorkbench
          ? "h-[100dvh] bg-background font-mono flex flex-col"
          : "min-h-screen bg-background font-mono flex flex-col"
      }
    >
      <NOCHeader />
      {isWorkbench ? (
        <main className="flex-1 min-h-0 overflow-hidden">{children}</main>
      ) : (
        <main className="container mx-auto px-4 py-6 space-y-6">
          {children}
        </main>
      )}
      {!isWorkbench ? (
        <footer className="border-t border-border py-4 mt-10">
          <div className="container mx-auto px-4 text-center text-xs text-muted-foreground font-mono">
            Engineering Operations Center v1.0
          </div>
        </footer>
      ) : null}
    </div>
  );
}
