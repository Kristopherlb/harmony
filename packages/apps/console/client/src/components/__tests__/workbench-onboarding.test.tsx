/**
 * packages/apps/console/client/src/components/__tests__/workbench-onboarding.test.tsx
 * Unit tests for Workbench onboarding wizard (Phase 4.4.2).
 */
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { WorkbenchOnboarding } from "../workbench-onboarding";

describe("WorkbenchOnboarding", () => {
  it("renders steps and calls onFinish on completion", () => {
    const onFinish = vi.fn();
    render(
      <WorkbenchOnboarding
        open
        onOpenChange={() => {}}
        onFinish={onFinish}
      />
    );

    expect(screen.getByText("Welcome to Workbench")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Create workflows faster")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Run and share")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});

