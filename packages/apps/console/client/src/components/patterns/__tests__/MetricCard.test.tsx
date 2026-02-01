import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MetricCard } from "../MetricCard";
import { Rocket } from "lucide-react";

describe("MetricCard", () => {
  it("renders title, value, and unit", () => {
    render(
      <MetricCard
        title="Deployments"
        value="12"
        unit="per day"
        icon={<Rocket />}
        status="good"
      />
    );

    expect(screen.getByText("Deployments")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("per day")).toBeInTheDocument();
  });

  it("applies status-based color classes", () => {
    const { rerender } = render(
      <MetricCard
        title="Test"
        value="10"
        unit=""
        icon={<Rocket />}
        status="good"
      />
    );

    let icon = screen.getByText("Test").closest("[data-testid]")?.querySelector("div");
    expect(icon).toHaveClass("text-status-healthy");

    rerender(
      <MetricCard
        title="Test"
        value="10"
        unit=""
        icon={<Rocket />}
        status="poor"
      />
    );

    icon = screen.getByText("Test").closest("[data-testid]")?.querySelector("div");
    expect(icon).toHaveClass("text-status-critical");
  });

  it("calls onClick when clicked", () => {
    const handleClick = vi.fn();
    render(
      <MetricCard
        title="Test"
        value="10"
        unit=""
        icon={<Rocket />}
        status="good"
        onClick={handleClick}
      />
    );

    const card = screen.getByText("Test").closest('[role="button"]');
    card?.click();
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it("shows loading state", () => {
    render(
      <MetricCard
        title="Test"
        value="10"
        unit=""
        icon={<Rocket />}
        status="good"
        isLoading
      />
    );

    expect(screen.queryByText("Test")).not.toBeInTheDocument();
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("merges className correctly", () => {
    render(
      <MetricCard
        title="Test"
        value="10"
        unit=""
        icon={<Rocket />}
        status="good"
        className="custom-class"
      />
    );

    const card = screen.getByText("Test").closest('[role="button"]');
    expect(card).toHaveClass("custom-class");
  });
});
