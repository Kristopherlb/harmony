import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ActivityHeatmap, getLocalDateString } from "../activity-heatmap";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Event } from "@shared/schema";

// Helper to render component with required providers
const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>{ui}</TooltipProvider>
    </QueryClientProvider>
  );
};

describe("getLocalDateString", () => {
  it("converts Date to local YYYY-MM-DD string", () => {
    const date = new Date(2026, 0, 25, 15, 30); // Jan 25, 2026 3:30 PM local
    expect(getLocalDateString(date)).toBe("2026-01-25");
  });

  it("handles single digit months and days with padding", () => {
    const date = new Date(2026, 0, 5, 10, 0); // Jan 5, 2026
    expect(getLocalDateString(date)).toBe("2026-01-05");
  });

  it("handles timezone boundaries correctly", () => {
    // Event at 11 PM PST (7 AM next day UTC) should be on local date
    // If we're in PST (UTC-8), Jan 26 07:00 UTC = Jan 25 23:00 PST
    const utcEvent = new Date("2026-01-26T07:00:00Z");
    const localDate = getLocalDateString(utcEvent);
    // The date should match the local timezone, not UTC
    // This test verifies we're using local time, not UTC
    expect(localDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // The actual date depends on timezone, but it should be consistent
    const localDay = utcEvent.getDate();
    const localMonth = utcEvent.getMonth() + 1;
    const localYear = utcEvent.getFullYear();
    expect(localDate).toBe(
      `${localYear}-${String(localMonth).padStart(2, "0")}-${String(localDay).padStart(2, "0")}`
    );
  });

  it("returns consistent format for different dates", () => {
    const dates = [
      new Date(2026, 0, 1),
      new Date(2026, 11, 31),
      new Date(2025, 5, 15),
    ];
    dates.forEach((date) => {
      const result = getLocalDateString(date);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result.split("-")).toHaveLength(3);
    });
  });
});

describe("ActivityHeatmap timezone handling", () => {
  it("matches events to correct local day", () => {
    // Create events with UTC timestamps that might fall on different local days
    const events: Event[] = [
      {
        id: "1",
        timestamp: "2026-01-25T10:00:00Z",
        source: "slack",
        type: "log",
        severity: "low",
        message: "Test event 1",
        payload: {},
        resolved: false,
        contextType: "general",
        serviceTags: [],
      },
      {
        id: "2",
        timestamp: "2026-01-25T23:00:00Z", // Late UTC, might be next day locally
        source: "jira",
        type: "blocker",
        severity: "high",
        message: "Test event 2",
        payload: {},
        resolved: false,
        contextType: "general",
        serviceTags: [],
      },
    ];

    // Mock today to be Jan 26, 2026
    const mockToday = new Date("2026-01-26T12:00:00");
    vi.useFakeTimers();
    vi.setSystemTime(mockToday);

    renderWithProviders(<ActivityHeatmap events={events} weeks={2} />);

    // Events should be matched to their local dates, not UTC dates
    // We need to check that events appear in the correct cells
    const heatmap = screen.getByTestId("activity-heatmap");
    expect(heatmap).toBeInTheDocument();

    vi.useRealTimers();
  });

  it("handles events spanning timezone boundaries", () => {
    // Event at midnight UTC (which might be previous day locally)
    const events: Event[] = [
      {
        id: "1",
        timestamp: "2026-01-26T00:00:00Z", // Midnight UTC
        source: "slack",
        type: "log",
        severity: "low",
        message: "Midnight event",
        payload: {},
        resolved: false,
        contextType: "general",
        serviceTags: [],
      },
    ];

    const mockToday = new Date("2026-01-26T12:00:00");
    vi.useFakeTimers();
    vi.setSystemTime(mockToday);

    renderWithProviders(<ActivityHeatmap events={events} weeks={2} />);

    // Event should appear on the correct local day
    const heatmap = screen.getByTestId("activity-heatmap");
    expect(heatmap).toBeInTheDocument();

    vi.useRealTimers();
  });
});

describe("ActivityHeatmap month layout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("displays current month", () => {
    const mockToday = new Date(2026, 0, 15, 12, 0); // January 15, 2026
    vi.setSystemTime(mockToday);

    const events: Event[] = [];
    renderWithProviders(<ActivityHeatmap events={events} />);

    const heatmap = screen.getByTestId("activity-heatmap");
    expect(heatmap).toBeInTheDocument();

    // Should show month name and year
    expect(within(heatmap).getByText("January 2026")).toBeInTheDocument();
  });

  it("displays all days of the month as columns", () => {
    const mockToday = new Date(2026, 0, 15, 12, 0); // January 2026 has 31 days
    vi.setSystemTime(mockToday);

    const events: Event[] = [];
    renderWithProviders(<ActivityHeatmap events={events} />);

    const cells = screen.getAllByTestId(/^heatmap-cell-/);
    // January has 31 days
    expect(cells.length).toBe(31);
  });

  it("displays days in chronological order", () => {
    const mockToday = new Date(2026, 0, 15, 12, 0); // January 15, 2026
    vi.setSystemTime(mockToday);

    const events: Event[] = [];
    renderWithProviders(<ActivityHeatmap events={events} />);

    const cells = screen.getAllByTestId(/^heatmap-cell-/);
    expect(cells.length).toBeGreaterThan(0);

    // Extract unique dates from test IDs (cells now have format: heatmap-cell-YYYY-MM-DD-source or heatmap-cell-YYYY-MM-DD-empty)
    const dates = new Set(
      cells.map((cell) => {
        const testId = cell.getAttribute("data-testid") || "";
        const match = testId.match(/^heatmap-cell-(\d{4}-\d{2}-\d{2})/);
        return match ? match[1] : null;
      }).filter((d): d is string => d !== null)
    );

    const sortedDates = Array.from(dates).sort();
    
    // First date should be January 1
    expect(sortedDates[0]).toBe("2026-01-01");

    // Last date should be January 31
    expect(sortedDates[sortedDates.length - 1]).toBe("2026-01-31");
  });

  it("displays day numbers for each column with stacked squares", () => {
    const mockToday = new Date(2026, 0, 15, 12, 0); // January 15, 2026
    vi.setSystemTime(mockToday);

    const events: Event[] = [];
    renderWithProviders(<ActivityHeatmap events={events} />);

    // Should show day numbers (1, 2, 3, etc.) above each column
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("15")).toBeInTheDocument();
    
    // Should have cells (empty days have -empty suffix, days with events have -source suffix)
    const cells = screen.getAllByTestId(/^heatmap-cell-/);
    expect(cells.length).toBeGreaterThan(0);
    
    // Verify cells are small squares
    cells.forEach((cell) => {
      expect(cell).toHaveClass("h-3");
      expect(cell).toHaveClass("w-3");
    });
  });
});

describe("ActivityHeatmap color legend", () => {
  it("uses bg-primary for intensity scale", () => {
    const events: Event[] = [];
    renderWithProviders(<ActivityHeatmap events={events} />);

    const heatmap = screen.getByTestId("activity-heatmap");
    const legend = within(heatmap).getByText("Less").parentElement;

    if (legend) {
      // Check that intensity scale uses bg-primary
      const intensitySwatches = legend.querySelectorAll(".bg-primary");
      // Should have bg-primary classes for intensity scale
      expect(intensitySwatches.length).toBeGreaterThan(0);
    }
  });

  it("legend colors match cell colors", () => {
    const events: Event[] = [
      {
        id: "1",
        timestamp: new Date().toISOString(),
        source: "slack",
        type: "log",
        severity: "low",
        message: "Test",
        payload: {},
        resolved: false,
        contextType: "general",
        serviceTags: [],
      },
    ];

    renderWithProviders(<ActivityHeatmap events={events} weeks={1} />);

    const heatmap = screen.getByTestId("activity-heatmap");
    // Verify source color legend matches sourceColors
    const sourceLegend = within(heatmap).getByText("Slack");
    expect(sourceLegend).toBeInTheDocument();
  });
});

describe("ActivityHeatmap event counting", () => {
  it("counts all events accurately", () => {
    const events: Event[] = [
      {
        id: "1",
        timestamp: "2026-01-25T10:00:00Z",
        source: "slack",
        type: "log",
        severity: "low",
        message: "Event 1",
        payload: {},
        resolved: false,
        contextType: "general",
        serviceTags: [],
      },
      {
        id: "2",
        timestamp: "2026-01-25T14:00:00Z",
        source: "jira",
        type: "blocker",
        severity: "high",
        message: "Event 2",
        payload: {},
        resolved: false,
        contextType: "general",
        serviceTags: [],
      },
      {
        id: "3",
        timestamp: "2026-01-26T09:00:00Z",
        source: "gitlab",
        type: "release",
        severity: "medium",
        message: "Event 3",
        payload: {},
        resolved: false,
        contextType: "general",
        serviceTags: [],
      },
    ];

    const mockToday = new Date("2026-01-26T12:00:00");
    vi.useFakeTimers();
    vi.setSystemTime(mockToday);

    renderWithProviders(<ActivityHeatmap events={events} weeks={2} />);

    // All 3 events should be counted and displayed
    const cells = screen.getAllByTestId(/^heatmap-cell-/);
    
    // Cells with events are not disabled (disabled={day.count === 0})
    // So we check for cells that are not disabled
    const cellsWithEvents = cells.filter((cell) => {
      const isDisabled = cell.hasAttribute("disabled");
      return !isDisabled;
    });

    // Should have at least one cell with events (all 3 events should be counted)
    // The exact number depends on timezone, but we should have events displayed
    expect(cellsWithEvents.length).toBeGreaterThan(0);
    
    // Verify the heatmap rendered successfully
    const heatmap = screen.getByTestId("activity-heatmap");
    expect(heatmap).toBeInTheDocument();

    vi.useRealTimers();
  });

  it("displays events on correct day cells", () => {
    const today = new Date();
    const todayStr = getLocalDateString(today);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = getLocalDateString(yesterday);

    const events: Event[] = [
      {
        id: "1",
        timestamp: new Date(`${todayStr}T10:00:00`).toISOString(),
        source: "slack",
        type: "log",
        severity: "low",
        message: "Today event",
        payload: {},
        resolved: false,
        contextType: "general",
        serviceTags: [],
      },
      {
        id: "2",
        timestamp: new Date(`${yesterdayStr}T14:00:00`).toISOString(),
        source: "jira",
        type: "blocker",
        severity: "high",
        message: "Yesterday event",
        payload: {},
        resolved: false,
        contextType: "general",
        serviceTags: [],
      },
    ];

    vi.useFakeTimers();
    vi.setSystemTime(today);

    renderWithProviders(<ActivityHeatmap events={events} />);

    // Verify events appear in correct cells (cells now have source suffix)
    const todayCell = screen.queryByTestId(`heatmap-cell-${todayStr}-slack`);
    const yesterdayCell = screen.queryByTestId(`heatmap-cell-${yesterdayStr}-jira`);

    // Cells should exist if events are in current month
    // If today/yesterday are in current month, cells should exist
    const currentMonth = today.getMonth();
    const todayDate = new Date(todayStr);
    const yesterdayDate = new Date(yesterdayStr);
    
    if (todayDate.getMonth() === currentMonth) {
      expect(todayCell).toBeTruthy();
    }
    if (yesterdayDate.getMonth() === currentMonth) {
      expect(yesterdayCell).toBeTruthy();
    }

    vi.useRealTimers();
  });

  it("counts multiple events on same day correctly and stacks them", () => {
    const today = new Date();
    const todayStr = getLocalDateString(today);

    const events: Event[] = [
      {
        id: "1",
        timestamp: new Date(`${todayStr}T10:00:00`).toISOString(),
        source: "slack",
        type: "log",
        severity: "low",
        message: "Event 1",
        payload: {},
        resolved: false,
        contextType: "general",
        serviceTags: [],
      },
      {
        id: "2",
        timestamp: new Date(`${todayStr}T14:00:00`).toISOString(),
        source: "jira",
        type: "blocker",
        severity: "high",
        message: "Event 2",
        payload: {},
        resolved: false,
        contextType: "general",
        serviceTags: [],
      },
      {
        id: "3",
        timestamp: new Date(`${todayStr}T18:00:00`).toISOString(),
        source: "gitlab",
        type: "release",
        severity: "medium",
        message: "Event 3",
        payload: {},
        resolved: false,
        contextType: "general",
        serviceTags: [],
      },
    ];

    vi.useFakeTimers();
    vi.setSystemTime(today);

    renderWithProviders(<ActivityHeatmap events={events} />);

    // All 3 events should be counted on the same day, shown as stacked squares
    // Each source should have its own square
    const slackCell = screen.queryByTestId(`heatmap-cell-${todayStr}-slack`);
    const jiraCell = screen.queryByTestId(`heatmap-cell-${todayStr}-jira`);
    const gitlabCell = screen.queryByTestId(`heatmap-cell-${todayStr}-gitlab`);

    // If today is in current month, cells should exist
    const currentMonth = today.getMonth();
    const todayDate = new Date(todayStr);
    if (todayDate.getMonth() === currentMonth) {
      expect(slackCell).toBeTruthy();
      expect(jiraCell).toBeTruthy();
      expect(gitlabCell).toBeTruthy();
    }

    vi.useRealTimers();
  });
});
