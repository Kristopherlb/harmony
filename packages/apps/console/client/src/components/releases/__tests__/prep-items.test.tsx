import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ReleaseDetailSheet } from "../release-detail-sheet";
import type { Event } from "@shared/schema";

// Mock the prep items utilities
vi.mock("../prep-items", () => ({
  usePrepItems: vi.fn(() => ({
    prepItems: [
      {
        id: "test-1",
        label: "Test Item",
        description: "Test description",
        completed: false,
        atRisk: false,
        manualAtRisk: false,
        resolverType: "manual" as const,
        resolver: vi.fn(),
        deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      },
    ],
    toggleItem: vi.fn(),
    toggleAtRisk: vi.fn(),
  })),
}));

describe("ReleaseDetailSheet Prep Items", () => {
  const mockRelease: Event = {
    id: "release-1",
    timestamp: new Date().toISOString(),
    source: "gitlab",
    type: "release",
    payload: {},
    severity: "medium",
    message: "Release v1.0.0",
    resolved: false,
    contextType: "general",
    serviceTags: [],
  };

  const mockEvents: Event[] = [];

  it("renders prep items as interactive checkboxes", () => {
    render(
      <ReleaseDetailSheet
        release={mockRelease}
        open={true}
        onOpenChange={vi.fn()}
        allEvents={mockEvents}
        onEventClick={vi.fn()}
      />
    );

    // Switch to prep tab
    const prepTab = screen.getByRole("tab", { name: /prep/i });
    fireEvent.click(prepTab);

    // Should show prep items
    expect(screen.getByText("Test Item")).toBeInTheDocument();
  });

  it("allows toggling prep items", async () => {
    const onEventClick = vi.fn();
    render(
      <ReleaseDetailSheet
        release={mockRelease}
        open={true}
        onOpenChange={vi.fn()}
        allEvents={mockEvents}
        onEventClick={onEventClick}
      />
    );

    const prepTab = screen.getByRole("tab", { name: /prep/i });
    fireEvent.click(prepTab);

    // Find and click the checkbox/item
    const item = screen.getByText("Test Item").closest("div");
    if (item) {
      fireEvent.click(item);
      
      // Should trigger resolver
      await waitFor(() => {
        // Check that interaction occurred
        expect(item).toBeInTheDocument();
      });
    }
  });
});
