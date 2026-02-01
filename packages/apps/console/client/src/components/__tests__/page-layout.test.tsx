import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Router } from "wouter";
import { useCallback, useState } from "react";

vi.mock("../noc-header", () => ({
  NOCHeader: () => <div data-testid="noc-header" />,
}));

import { PageLayout } from "../page-layout";

function createStaticLocationHook(path: string) {
  return () => {
    const [location] = useState(path);
    const navigate = useCallback(() => {
      // no-op for tests
    }, []);

    return [location, navigate] as const;
  };
}

function renderAt(path: string) {
  const view = render(
    <Router hook={createStaticLocationHook(path)}>
      <PageLayout>
        <div>content</div>
      </PageLayout>
    </Router>
  );

  const main = view.container.querySelector("main");
  expect(main).not.toBeNull();

  return { ...view, main: main! };
}

describe("PageLayout", () => {
  it("renders the workbench route with a full-height main and no footer", () => {
    const { main } = renderAt("/workbench");

    expect(screen.getByTestId("noc-header")).toBeInTheDocument();
    expect(
      screen.queryByText("Engineering Operations Center v1.0")
    ).not.toBeInTheDocument();

    expect(main).toHaveClass("flex-1");
    expect(main).not.toHaveClass("container");
  });

  it("renders non-workbench routes with container spacing and footer", () => {
    const { main } = renderAt("/");

    expect(screen.getByTestId("noc-header")).toBeInTheDocument();
    expect(
      screen.getByText("Engineering Operations Center v1.0")
    ).toBeInTheDocument();

    expect(main).toHaveClass("container");
  });
});

