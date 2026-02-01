import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { WorkflowTimeline } from "./workflow-timeline";
import { WorkflowHistoryEvent } from "../types"; // Will need to define types

describe("WorkflowTimeline", () => {
    it("renders empty state when no history provided", () => {
        render(<WorkflowTimeline history={[]} />);
        expect(screen.getByText("No events found")).toBeDefined();
    });

    it("renders timeline steps from history", () => {
        const mockHistory: WorkflowHistoryEvent[] = [
            { id: "1", eventId: 1, eventType: "WorkflowExecutionStarted", timestamp: "2024-01-01T10:00:00Z" },
            { id: "2", eventId: 2, eventType: "ActivityTaskScheduled", timestamp: "2024-01-01T10:00:05Z", activityType: { name: "test-activity" } },
            { id: "3", eventId: 3, eventType: "ActivityTaskCompleted", timestamp: "2024-01-01T10:00:10Z" },
            { id: "4", eventId: 4, eventType: "WorkflowExecutionCompleted", timestamp: "2024-01-01T10:00:15Z" },
        ];

        render(<WorkflowTimeline history={mockHistory} />);

        // Check for key milestones
        expect(screen.getByText("Workflow Started")).toBeDefined();
        expect(screen.getByText("test-activity")).toBeDefined();
        expect(screen.getByText("Workflow Completed")).toBeDefined();

        // Verify order/structure roughly (simplified)
        const steps = screen.getAllByRole("listitem");
        expect(steps).toHaveLength(3); // Start, Activity, End (Activity scheduled+completed merge into one step?) 
        // Let's assume 1:1 mapping for raw events first, or smart merging.
        // For TDD simplicity, let's assume we want to visualize strictly "Activities" and "Workflow Start/End".
    });
});
