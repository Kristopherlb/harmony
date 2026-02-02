import { useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";
import { SystemStatus } from "./status-indicator";
import {
  Activity,
  Radio,
  Menu,
  LayoutDashboard,
  Wrench,
  MonitorDot,
  Network,
  Workflow,
  Boxes,
  AlertTriangle,
  BookOpen,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface NOCHeaderProps {
  className?: string;
}

export function NOCHeader({ className }: NOCHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [location] = useLocation();
  const now = new Date();
  const timeString = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const dateString = now.toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const navItems = [
    { path: "/", label: "Dashboard", icon: LayoutDashboard },
    { path: "/incidents", label: "Incidents", icon: AlertTriangle },
    { path: "/runbooks", label: "Runbooks", icon: BookOpen },
    { path: "/timeline", label: "Timeline", icon: Clock },
    { path: "/workbench", label: "Workbench", icon: MonitorDot },
    { path: "/workflows", label: "Workflows", icon: Workflow },
    { path: "/capabilities", label: "Capabilities", icon: Boxes },
    { path: "/services", label: "Services", icon: Network },
    { path: "/operations", label: "Operations", icon: Wrench },
  ];

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80",
        className
      )}
      data-testid="noc-header"
    >
      <div className="flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-6 py-3">
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Activity className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-status-healthy pulse-indicator" />
            </div>
            <div className="font-mono">
              <h1 className="text-base sm:text-lg font-bold tracking-tight">OPS CENTER</h1>
              <p className="hidden sm:block text-xs text-muted-foreground">Engineering Operations Dashboard</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1 ml-6">
            {navItems.map((item) => (
              <Link key={item.path} href={item.path}>
                <Button
                  variant={location === item.path ? "secondary" : "ghost"}
                  size="sm"
                  className="gap-2"
                  data-testid={`nav-${item.label.toLowerCase()}`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Button>
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-1 ml-4 px-3 py-1.5 rounded-md bg-card border border-border font-mono text-xs">
            <Radio className="h-3 w-3 text-status-healthy" />
            <span className="text-status-healthy font-semibold">LIVE</span>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-6">
          <SystemStatus label="API" status="operational" />
          <SystemStatus label="Database" status="operational" />
          <SystemStatus label="CI/CD" status="operational" />
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <div className="hidden sm:block font-mono text-right">
            <div className="text-sm font-semibold tabular-nums" data-testid="text-current-time">
              {timeString}
            </div>
            <div className="text-xs text-muted-foreground">{dateString}</div>
          </div>
          <ThemeToggle />

          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden min-h-10 min-w-10"
                data-testid="button-mobile-menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px] sm:w-[320px]">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  System Status
                </SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Navigation</h4>
                  {navItems.map((item) => (
                    <Link key={item.path} href={item.path}>
                      <Button
                        variant={location === item.path ? "secondary" : "ghost"}
                        className="w-full justify-start gap-2"
                        onClick={() => setMobileMenuOpen(false)}
                        data-testid={`mobile-nav-${item.label.toLowerCase()}`}
                      >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </Button>
                    </Link>
                  ))}
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Services</h4>
                  <div className="space-y-3">
                    <SystemStatus label="API" status="operational" />
                    <SystemStatus label="Database" status="operational" />
                    <SystemStatus label="CI/CD" status="operational" />
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Current Time</h4>
                  <div className="font-mono">
                    <div className="text-lg font-semibold tabular-nums">{timeString}</div>
                    <div className="text-sm text-muted-foreground">{dateString}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                  <Radio className="h-4 w-4 text-emerald-500" />
                  <span className="text-emerald-500 font-semibold text-sm">LIVE MONITORING</span>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
