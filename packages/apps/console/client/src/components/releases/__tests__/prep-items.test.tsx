import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Event } from "@shared/schema";
import { ReleaseDetailSheet } from "../release-detail-sheet";

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

  it("renders prep items as interactive checkboxes", async () => {
    const prevFetch = global.fetch;
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ events: [] }) }) as any) as any;
    render(
      <ReleaseDetailSheet
        release={mockRelease}
        open={true}
        onOpenChange={vi.fn()}
        allEvents={mockEvents}
        onEventClick={vi.fn()}
      />
    );
    global.fetch = prevFetch as any;

    // Switch to prep tab
    const prepTab = screen.getByRole("tab", { name: /prep/i });
    fireEvent.mouseDown(prepTab);
    fireEvent.click(prepTab);
    await waitFor(() => {
      expect(prepTab).toHaveAttribute("data-state", "active");
    });

    // Should show prep items
    expect(await screen.findByText("Release Notes")).toBeInTheDocument();
  });

  it("allows toggling prep items", async () => {
    const onEventClick = vi.fn();
    const prevFetch = global.fetch;
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ events: [] }) }) as any) as any;
    render(
      <ReleaseDetailSheet
        release={mockRelease}
        open={true}
        onOpenChange={vi.fn()}
        allEvents={mockEvents}
        onEventClick={onEventClick}
      />
    );
    global.fetch = prevFetch as any;

    const prepTab = screen.getByRole("tab", { name: /prep/i });
    fireEvent.mouseDown(prepTab);
    fireEvent.click(prepTab);
    await waitFor(() => {
      expect(prepTab).toHaveAttribute("data-state", "active");
    });

    // Click the checkbox for a prep item; in test env the automated check can't complete,
    // so it should open the manual confirm dialog.
    const checkbox = await screen.findByLabelText(/Release Notes/i);
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(screen.getByText("Confirm Manual Completion")).toBeInTheDocument();
    });
  });
});
