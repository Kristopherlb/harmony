import type { Event } from "@shared/schema";

export type ResolverType = "automated" | "manual";
export type AutomatedCheckType = "jira_ticket" | "status_page" | "api_check" | "none";

export interface PrepItem {
  id: string;
  label: string;
  description: string;
  completed: boolean;
  atRisk: boolean;
  manualAtRisk: boolean;
  resolverType: ResolverType;
  automatedCheck?: {
    type: AutomatedCheckType;
    config?: {
      jql?: string;
      apiUrl?: string;
      expectedStatus?: string;
    };
  };
  resolver: () => void | Promise<void>;
  deadline?: Date;
}

export interface UpcomingReleasesDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  releases: Event[];
  readinessScore: number;
  allEvents: Event[];
  onEventClick: (event: Event) => void;
}

export interface ReleaseDetailSheetProps {
  release: Event;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allEvents: Event[];
  onEventClick: (event: Event) => void;
}
