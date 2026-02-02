import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "../EmptyState";
import { Server } from "lucide-react";

describe("EmptyState", () => {
  it("renders with icon, title, and description", () => {
    render(
      <EmptyState
        icon={Server}
        title="No services found"
        description="There are no services matching your filters."
      />
    );

    expect(screen.getByText("No services found")).toBeInTheDocument();
    expect(screen.getByText("There are no services matching your filters.")).toBeInTheDocument();
  });

  it("renders action button when provided", () => {
    const handleAction = vi.fn();
    render(
      <EmptyState
        icon={Server}
        title="No services"
        description="Description"
        actionLabel="Create Service"
        onAction={handleAction}
      />
    );

    const button = screen.getByText("Create Service");
    expect(button).toBeInTheDocument();
    button.click();
    expect(handleAction).toHaveBeenCalledOnce();
  });

  it("merges className correctly", () => {
    render(
      <EmptyState
        icon={Server}
        title="Test"
        description="Test"
        className="custom-class"
      />
    );

    const title = screen.getByRole("heading", { name: "Test" });
    const container = title.closest("div");
    expect(container).toHaveClass("custom-class");
  });
});
