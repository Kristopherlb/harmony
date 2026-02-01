import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ServiceCard } from "../ServiceCard";
import type { Service, Team } from "@shared/schema";

const mockService: Service = {
  id: "test-id",
  name: "Test Service",
  description: "Test description",
  type: "api",
  health: "healthy",
  tier: "tier1",
  teamId: "team-1",
  tags: ["tag1", "tag2"],
  dependencies: [],
  errorRate: 0.5,
  latencyP99: 100,
  requestsPerSecond: 1000,
  version: "1.0.0",
  openIncidents: 0,
  openVulnerabilities: 0,
};

const mockTeam: Team = {
  id: "team-1",
  name: "Test Team",
  lead: "test-lead",
};

describe("ServiceCard", () => {
  it("renders service name and description", () => {
    const handleClick = vi.fn();
    render(<ServiceCard service={mockService} onClick={handleClick} />);

    expect(screen.getByText("Test Service")).toBeInTheDocument();
    expect(screen.getByText("Test description")).toBeInTheDocument();
  });

  it("renders team name when provided", () => {
    const handleClick = vi.fn();
    render(<ServiceCard service={mockService} team={mockTeam} onClick={handleClick} />);

    expect(screen.getByText("Test Team")).toBeInTheDocument();
  });

  it("calls onClick when clicked", () => {
    const handleClick = vi.fn();
    render(<ServiceCard service={mockService} onClick={handleClick} />);

    const card = screen.getByTestId(`card-service-${mockService.id}`);
    card.click();
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it("displays service metrics when available", () => {
    const handleClick = vi.fn();
    render(<ServiceCard service={mockService} onClick={handleClick} />);

    expect(screen.getByText(/Error Rate:/)).toBeInTheDocument();
    expect(screen.getByText(/P99:/)).toBeInTheDocument();
    expect(screen.getByText(/RPS:/)).toBeInTheDocument();
  });

  it("displays tags", () => {
    const handleClick = vi.fn();
    render(<ServiceCard service={mockService} onClick={handleClick} />);

    expect(screen.getByText("tag1")).toBeInTheDocument();
    expect(screen.getByText("tag2")).toBeInTheDocument();
  });

  it("uses StatusPill for health display", () => {
    const handleClick = vi.fn();
    render(<ServiceCard service={mockService} onClick={handleClick} />);

    expect(screen.getByText("healthy")).toBeInTheDocument();
  });
});
