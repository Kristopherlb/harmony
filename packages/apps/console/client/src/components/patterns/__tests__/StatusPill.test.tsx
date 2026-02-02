import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusPill } from "../StatusPill";
import type { ServiceHealth, WorkflowStatus } from "@shared/schema";

describe("StatusPill", () => {
  describe("ServiceHealth status", () => {
    it("renders healthy status with correct classes", () => {
      render(<StatusPill status="healthy" />);
      const pill = screen.getByText("healthy");
      expect(pill).toHaveClass("bg-status-healthy");
      expect(pill).toHaveClass("text-status-healthy-foreground");
    });

    it("renders degraded status with correct classes", () => {
      render(<StatusPill status="degraded" />);
      const pill = screen.getByText("degraded");
      expect(pill).toHaveClass("bg-status-degraded");
      expect(pill).toHaveClass("text-status-degraded-foreground");
    });

    it("renders critical status with correct classes", () => {
      render(<StatusPill status="critical" />);
      const pill = screen.getByText("critical");
      expect(pill).toHaveClass("bg-status-critical");
      expect(pill).toHaveClass("text-status-critical-foreground");
    });

    it("renders unknown status with correct classes", () => {
      render(<StatusPill status="unknown" />);
      const pill = screen.getByText("unknown");
      expect(pill).toHaveClass("bg-status-unknown");
      expect(pill).toHaveClass("text-status-unknown-foreground");
    });
  });

  describe("WorkflowStatus status", () => {
    it("renders completed status", () => {
      render(<StatusPill status="completed" />);
      expect(screen.getByText("completed")).toBeInTheDocument();
    });

    it("renders failed status", () => {
      render(<StatusPill status="failed" />);
      expect(screen.getByText("failed")).toBeInTheDocument();
    });

    it("renders running status", () => {
      render(<StatusPill status="running" />);
      expect(screen.getByText("running")).toBeInTheDocument();
    });
  });

  describe("variants", () => {
    it("applies default variant classes", () => {
      render(<StatusPill status="healthy" />);
      const pill = screen.getByText("healthy");
      expect(pill).toHaveClass("rounded-md");
      expect(pill).toHaveClass("px-2");
      expect(pill).toHaveClass("py-0.5");
    });

    it("applies custom className", () => {
      render(<StatusPill status="healthy" className="custom-class" />);
      const pill = screen.getByText("healthy");
      expect(pill).toHaveClass("custom-class");
    });
  });

  describe("showDot prop", () => {
    it("shows dot indicator when showDot is true", () => {
      render(<StatusPill status="healthy" showDot />);
      const pill = screen.getByRole("status", { name: "Status: healthy" });
      const dot = pill.querySelector('span[aria-hidden="true"]');
      expect(dot).toBeInTheDocument();
      expect(dot).toHaveClass("rounded-full");
    });

    it("does not show dot when showDot is false", () => {
      render(<StatusPill status="healthy" showDot={false} />);
      const pill = screen.getByRole("status", { name: "Status: healthy" });
      const dot = pill.querySelector('span[aria-hidden="true"]');
      expect(dot).not.toBeInTheDocument();
    });
  });

  describe("custom label", () => {
    it("renders custom label text", () => {
      render(<StatusPill status="healthy" label="Custom Label" />);
      expect(screen.getByText("Custom Label")).toBeInTheDocument();
      expect(screen.queryByText("healthy")).not.toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("has proper ARIA attributes", () => {
      render(<StatusPill status="healthy" />);
      const pill = screen.getByText("healthy");
      expect(pill).toHaveAttribute("role", "status");
    });

    it("merges className correctly", () => {
      render(<StatusPill status="healthy" className="test-class" />);
      const pill = screen.getByText("healthy");
      expect(pill.className).toContain("test-class");
      expect(pill.className).toContain("bg-status-healthy");
    });
  });
});
