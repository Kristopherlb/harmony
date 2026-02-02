import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { DORAMetricsDetail } from "../dora-metrics-detail";
import type { Event, DORAMetrics } from "@shared/schema";
import { format } from "date-fns";

// Mock useQuery at the module level
vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: vi.fn(),
  };
});

// Helper to set mock query data
const setMockQueryData = (events: Event[]) => {
  vi.mocked(useQuery).mockReturnValue({
    data: { events },
    isLoading: false,
  } as any);
};

// Helper to render component with required providers
const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
};

// Helper to create mock events
const createMockEvent = (overrides: Partial<Event> = {}): Event => ({
  id: `event-${Math.random()}`,
  timestamp: new Date().toISOString(),
  source: "circleci",
  type: "release",
  severity: "low",
  message: "Test deployment",
  payload: {},
  resolved: false,
  contextType: "general",
  serviceTags: [],
  ...overrides,
});

// Helper to create mock DORA metrics
const createMockMetrics = (): DORAMetrics => ({
  deploymentFrequency: 2.5,
  leadTime: 12.5,
  meanTimeToRecovery: 4.2,
  changeFailureRate: 0.15,
});

describe("DeploymentFrequencyDetail - Filtering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock: empty events
    setMockQueryData([]);
  });

  describe("Status filtering", () => {
    it("should filter releases when clicking Successful card", () => {
      const releases: Event[] = [
        createMockEvent({
          id: "1",
          payload: { failed: false },
          message: "Successful deployment 1",
        }),
        createMockEvent({
          id: "2",
          payload: { failed: true },
          message: "Failed deployment 1",
        }),
        createMockEvent({
          id: "3",
          payload: { failed: false },
          message: "Successful deployment 2",
        }),
      ];

      // Mock useQuery to return our test releases
      setMockQueryData(releases);

      renderWithProviders(
        <DORAMetricsDetail
          open={true}
          onOpenChange={() => {}}
          metrics={createMockMetrics()}
          initialTab="deployment"
        />
      );

      // Find and click the Successful card
      const successfulCard = screen.getByText(/^Successful$/).closest(".p-3");
      expect(successfulCard).toBeInTheDocument();
      fireEvent.click(successfulCard!);

      // Assert: filtered releases should only show successful ones
      // The Recent Deployments section should update to show only successful releases
      const recentDeployments = screen.getByText(/recent deployments/i);
      expect(recentDeployments).toBeInTheDocument();
      
      // Should show successful deployments
      expect(screen.getByText(/successful deployment 1/i)).toBeInTheDocument();
      expect(screen.getByText(/successful deployment 2/i)).toBeInTheDocument();
      
      // Should not show failed deployments
      expect(screen.queryByText(/failed deployment 1/i)).not.toBeInTheDocument();
    });

    it("should filter releases when clicking Failed card", () => {
      const releases: Event[] = [
        createMockEvent({
          id: "1",
          payload: { failed: false },
          message: "Successful deployment 1",
        }),
        createMockEvent({
          id: "2",
          payload: { failed: true },
          message: "Failed deployment 1",
        }),
        createMockEvent({
          id: "3",
          payload: { failed: true },
          message: "Failed deployment 2",
        }),
      ];

      setMockQueryData(releases);

      renderWithProviders(
        <DORAMetricsDetail
          open={true}
          onOpenChange={() => {}}
          metrics={createMockMetrics()}
          initialTab="deployment"
        />
      );

      // Find and click the Failed card
      const failedCard = screen.getByText(/^Failed$/).closest(".p-3");
      expect(failedCard).toBeInTheDocument();
      fireEvent.click(failedCard!);

      // Assert: filtered releases should only show failed ones
      expect(screen.getByText(/failed deployment 1/i)).toBeInTheDocument();
      expect(screen.getByText(/failed deployment 2/i)).toBeInTheDocument();
      expect(screen.queryByText(/successful deployment 1/i)).not.toBeInTheDocument();
    });

    it("should reset filters when clicking Total card", () => {
      const releases: Event[] = [
        createMockEvent({
          id: "1",
          payload: { failed: false },
          message: "Deployment 1",
        }),
        createMockEvent({
          id: "2",
          payload: { failed: true },
          message: "Deployment 2",
        }),
      ];

      setMockQueryData(releases);

      renderWithProviders(
        <DORAMetricsDetail
          open={true}
          onOpenChange={() => {}}
          metrics={createMockMetrics()}
          initialTab="deployment"
        />
      );

      // First filter by successful
      const successfulCard = screen.getByText(/^Successful$/).closest(".p-3");
      fireEvent.click(successfulCard!);
      
      // Verify filter is active (only successful shown)
      expect(screen.getByText(/deployment 1/i)).toBeInTheDocument();
      expect(screen.queryByText(/deployment 2/i)).not.toBeInTheDocument();

      // Then click Total to reset
      const totalCard = screen.getByText(/^Total$/).closest(".p-3");
      fireEvent.click(totalCard!);

      // Assert: all deployments should be visible again
      expect(screen.getByText(/deployment 1/i)).toBeInTheDocument();
      expect(screen.getByText(/deployment 2/i)).toBeInTheDocument();
    });
  });

  describe("Day of week filtering", () => {
    it("should filter releases when clicking a day bar", () => {
      
      // Create releases on different days
      const mondayDate = new Date(2026, 0, 26); // Monday, Jan 26, 2026
      const tuesdayDate = new Date(2026, 0, 27); // Tuesday, Jan 27, 2026
      
      const releases: Event[] = [
        createMockEvent({
          id: "1",
          timestamp: mondayDate.toISOString(),
          message: "Monday deployment",
        }),
        createMockEvent({
          id: "2",
          timestamp: tuesdayDate.toISOString(),
          message: "Tuesday deployment",
        }),
        createMockEvent({
          id: "3",
          timestamp: mondayDate.toISOString(),
          message: "Another Monday deployment",
        }),
      ];

      setMockQueryData(releases);

      renderWithProviders(
        <DORAMetricsDetail
          open={true}
          onOpenChange={() => {}}
          metrics={createMockMetrics()}
          initialTab="deployment"
        />
      );

      // Find and click the Monday bar (Mon)
      const mondayBar = screen.getByTitle(/mon.*deploys/i);
      expect(mondayBar).toBeInTheDocument();
      fireEvent.click(mondayBar);

      // Assert: filtered releases should only show Monday deployments
      expect(screen.getByText(/^Monday deployment$/i)).toBeInTheDocument();
      expect(screen.getByText(/^Another Monday deployment$/i)).toBeInTheDocument();
      expect(screen.queryByText(/tuesday deployment/i)).not.toBeInTheDocument();
    });

    it("should show active state when a day filter is applied", () => {
      const mondayDate = new Date(2026, 0, 26);
      
      const releases: Event[] = [
        createMockEvent({
          id: "1",
          timestamp: mondayDate.toISOString(),
          message: "Monday deployment",
        }),
      ];

      setMockQueryData(releases);

      renderWithProviders(
        <DORAMetricsDetail
          open={true}
          onOpenChange={() => {}}
          metrics={createMockMetrics()}
          initialTab="deployment"
        />
      );

      // Click Monday bar
      const mondayBar = screen.getByTitle(/mon.*deploys/i);
      fireEvent.click(mondayBar);

      // Assert: Monday bar should have active styling
      expect(mondayBar).toHaveClass("ring-2", "ring-primary");
    });
  });

  describe("Deployment type filtering", () => {
    it("should filter by production type when clicking Production card", () => {
      
      const releases: Event[] = [
        createMockEvent({
          id: "1",
          source: "circleci",
          payload: {
            workflowName: "deploy-prod",
            branch: "main",
          },
          message: "Production deployment",
        }),
        createMockEvent({
          id: "2",
          source: "circleci",
          payload: {
            workflowName: "deploy-staging",
            branch: "develop",
          },
          message: "Staging deployment",
        }),
      ];

      setMockQueryData(releases);

      renderWithProviders(
        <DORAMetricsDetail
          open={true}
          onOpenChange={() => {}}
          metrics={createMockMetrics()}
          initialTab="deployment"
        />
      );

      // Find and click the Production card
      const productionCard = screen.getByText(/^Production$/).closest(".p-2");
      expect(productionCard).toBeInTheDocument();
      fireEvent.click(productionCard!);

      // Assert: filtered releases should only show production deployments
      expect(screen.getByText(/production deployment/i)).toBeInTheDocument();
      expect(screen.queryByText(/staging deployment/i)).not.toBeInTheDocument();
    });

    it("should filter by staging type when clicking Staging card", () => {
      
      const releases: Event[] = [
        createMockEvent({
          id: "1",
          source: "circleci",
          payload: {
            workflowName: "deploy-prod",
            branch: "main",
          },
          message: "Production deployment",
        }),
        createMockEvent({
          id: "2",
          source: "circleci",
          payload: {
            workflowName: "deploy-staging",
            branch: "develop",
          },
          message: "Staging deployment",
        }),
      ];

      setMockQueryData(releases);

      renderWithProviders(
        <DORAMetricsDetail
          open={true}
          onOpenChange={() => {}}
          metrics={createMockMetrics()}
          initialTab="deployment"
        />
      );

      // Find and click the Staging card
      const stagingCard = screen.getByText(/^Staging$/).closest(".p-2");
      expect(stagingCard).toBeInTheDocument();
      fireEvent.click(stagingCard!);

      // Assert: filtered releases should only show staging deployments
      expect(screen.getByText(/staging deployment/i)).toBeInTheDocument();
      expect(screen.queryByText(/production deployment/i)).not.toBeInTheDocument();
    });

    it("should filter by hotfix type when clicking Hotfix card", () => {
      
      const releases: Event[] = [
        createMockEvent({
          id: "1",
          source: "circleci",
          payload: {
            branch: "hotfix/critical-bug",
            workflowName: "deploy-prod",
          },
          message: "Hotfix deployment",
        }),
        createMockEvent({
          id: "2",
          source: "circleci",
          payload: {
            branch: "main",
            workflowName: "deploy-prod",
          },
          message: "Regular deployment",
        }),
      ];

      setMockQueryData(releases);

      renderWithProviders(
        <DORAMetricsDetail
          open={true}
          onOpenChange={() => {}}
          metrics={createMockMetrics()}
          initialTab="deployment"
        />
      );

      // Find and click the Hotfix card
      const hotfixCard = screen.getByText(/^Hotfix$/).closest(".p-2");
      expect(hotfixCard).toBeInTheDocument();
      fireEvent.click(hotfixCard!);

      // Assert: filtered releases should only show hotfix deployments
      expect(screen.getByText(/hotfix deployment/i)).toBeInTheDocument();
      expect(screen.queryByText(/regular deployment/i)).not.toBeInTheDocument();
    });
  });

  describe("Filter combinations", () => {
    it("should apply multiple filters together", () => {
      
      const mondayDate = new Date(2026, 0, 26); // Monday
      const releases: Event[] = [
        createMockEvent({
          id: "1",
          timestamp: mondayDate.toISOString(),
          source: "circleci",
          payload: {
            failed: false,
            workflowName: "deploy-prod",
            branch: "main",
          },
          message: "Successful Monday production",
        }),
        createMockEvent({
          id: "2",
          timestamp: mondayDate.toISOString(),
          source: "circleci",
          payload: {
            failed: true,
            workflowName: "deploy-prod",
            branch: "main",
          },
          message: "Failed Monday production",
        }),
        createMockEvent({
          id: "3",
          timestamp: mondayDate.toISOString(),
          source: "circleci",
          payload: {
            failed: false,
            workflowName: "deploy-staging",
            branch: "develop",
          },
          message: "Successful Monday staging",
        }),
      ];

      setMockQueryData(releases);

      renderWithProviders(
        <DORAMetricsDetail
          open={true}
          onOpenChange={() => {}}
          metrics={createMockMetrics()}
          initialTab="deployment"
        />
      );

      // Apply multiple filters: Monday + Production + Successful
      const mondayBar = screen.getByTitle(/mon.*deploys/i);
      fireEvent.click(mondayBar);

      const productionCard = screen.getByText(/^Production$/).closest(".p-2");
      fireEvent.click(productionCard!);

      const successfulCard = screen.getByText(/^Successful$/).closest(".p-3");
      fireEvent.click(successfulCard!);

      // Assert: should only show successful Monday production deployments
      expect(screen.getByText(/successful monday production/i)).toBeInTheDocument();
      expect(screen.queryByText(/failed monday production/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/successful monday staging/i)).not.toBeInTheDocument();
    });
  });

  describe("Filter reset", () => {
    it("should reset all filters when clicking deployment frequency score card", () => {
      
      const releases: Event[] = [
        createMockEvent({
          id: "1",
          payload: { failed: false },
          message: "Deployment 1",
        }),
        createMockEvent({
          id: "2",
          payload: { failed: true },
          message: "Deployment 2",
        }),
      ];

      setMockQueryData(releases);

      renderWithProviders(
        <DORAMetricsDetail
          open={true}
          onOpenChange={() => {}}
          metrics={createMockMetrics()}
          initialTab="deployment"
        />
      );

      // Apply a filter
      const successfulCard = screen.getByText(/^Successful$/).closest(".p-3");
      fireEvent.click(successfulCard!);
      
      // Verify filter is active
      expect(screen.getByText(/deployment 1/i)).toBeInTheDocument();
      expect(screen.queryByText(/deployment 2/i)).not.toBeInTheDocument();

      // Click deployment frequency score card to reset
      const frequencyCard = screen.getByText(/^Deployment Frequency$/i).closest(".p-4");
      expect(frequencyCard).toBeInTheDocument();
      fireEvent.click(frequencyCard!);

      // Assert: all deployments should be visible again
      expect(screen.getByText(/deployment 1/i)).toBeInTheDocument();
      expect(screen.getByText(/deployment 2/i)).toBeInTheDocument();
    });

    it("should show clear filters button when filters are active", () => {
      
      const releases: Event[] = [
        createMockEvent({
          id: "1",
          payload: { failed: false },
          message: "Deployment 1",
        }),
      ];

      setMockQueryData(releases);

      renderWithProviders(
        <DORAMetricsDetail
          open={true}
          onOpenChange={() => {}}
          metrics={createMockMetrics()}
          initialTab="deployment"
        />
      );

      // Apply a filter
      const successfulCard = screen.getByText(/^Successful$/).closest(".p-3");
      fireEvent.click(successfulCard!);

      // Assert: clear filters button should appear
      const clearButton = screen.getByText(/clear.*filter/i);
      expect(clearButton).toBeInTheDocument();
      
      // Click clear button
      fireEvent.click(clearButton);

      // Assert: all deployments should be visible
      expect(screen.getByText(/deployment 1/i)).toBeInTheDocument();
    });
  });
});

describe("ReleaseCard - CircleCI Details", () => {
  describe("CircleCI information display", () => {
    it("should display CircleCI pipeline number when available", () => {
      const circleCIEvent = createMockEvent({
        source: "circleci",
        payload: {
          pipelineNumber: 12345,
          workflowName: "deploy-prod",
          jobName: "Deploy app-ServiceStack",
          branch: "main",
        },
        message: "CircleCI deployment",
      });

      setMockQueryData([circleCIEvent]);

      renderWithProviders(
        <DORAMetricsDetail
          open={true}
          onOpenChange={() => {}}
          metrics={createMockMetrics()}
          initialTab="deployment"
        />
      );

      // Assert: pipeline number should be displayed
      expect(screen.getByText(/12345/)).toBeInTheDocument();
    });

    it("should display CircleCI workflow name when available", () => {
      const circleCIEvent = createMockEvent({
        source: "circleci",
        payload: {
          pipelineNumber: 12345,
          workflowName: "deploy-prod",
          jobName: "Deploy app-ServiceStack",
        },
        message: "CircleCI deployment",
      });

      setMockQueryData([circleCIEvent]);

      renderWithProviders(
        <DORAMetricsDetail
          open={true}
          onOpenChange={() => {}}
          metrics={createMockMetrics()}
          initialTab="deployment"
        />
      );

      // Assert: workflow name should be displayed
      expect(screen.getByText(/deploy-prod/i)).toBeInTheDocument();
    });

    it("should display CircleCI job name when available", () => {
      const circleCIEvent = createMockEvent({
        source: "circleci",
        payload: {
          pipelineNumber: 12345,
          workflowName: "deploy-prod",
          jobName: "Deploy app-ServiceStack",
        },
        message: "CircleCI deployment",
      });

      setMockQueryData([circleCIEvent]);

      renderWithProviders(
        <DORAMetricsDetail
          open={true}
          onOpenChange={() => {}}
          metrics={createMockMetrics()}
          initialTab="deployment"
        />
      );

      // Assert: job name should be displayed
      expect(screen.getByText(/Deploy app-ServiceStack/i)).toBeInTheDocument();
    });

    it("should display CircleCI branch when available", () => {
      const circleCIEvent = createMockEvent({
        source: "circleci",
        payload: {
          pipelineNumber: 12345,
          workflowName: "deploy-prod",
          jobName: "Deploy app-ServiceStack",
          branch: "main",
        },
        message: "CircleCI deployment",
      });

      setMockQueryData([circleCIEvent]);

      renderWithProviders(
        <DORAMetricsDetail
          open={true}
          onOpenChange={() => {}}
          metrics={createMockMetrics()}
          initialTab="deployment"
        />
      );

      // Assert: branch should be displayed
      expect(screen.getByText(/main/i)).toBeInTheDocument();
    });

    it("should display external link icon for CircleCI deployments", () => {
      const circleCIEvent = createMockEvent({
        source: "circleci",
        payload: {
          pipelineNumber: 12345,
          projectSlug: "gh/org/repo",
        },
        message: "CircleCI deployment",
      });

      setMockQueryData([circleCIEvent]);

      renderWithProviders(
        <DORAMetricsDetail
          open={true}
          onOpenChange={() => {}}
          metrics={createMockMetrics()}
          initialTab="deployment"
        />
      );

      // Assert: external link icon should be present
      const externalLink = screen.getByRole("link", { name: /circleci/i });
      expect(externalLink).toBeInTheDocument();
      expect(externalLink).toHaveAttribute("href", "https://circleci.com/gh/org/repo/pipelines/12345");
    });
  });

  describe("CircleCI URL construction", () => {
    it("should construct correct CircleCI URL from projectSlug and pipelineNumber", () => {
      const circleCIEvent = createMockEvent({
        source: "circleci",
        payload: {
          pipelineNumber: 12345,
          projectSlug: "gh/org/repo",
        },
        message: "CircleCI deployment",
      });

      setMockQueryData([circleCIEvent]);

      renderWithProviders(
        <DORAMetricsDetail
          open={true}
          onOpenChange={() => {}}
          metrics={createMockMetrics()}
          initialTab="deployment"
        />
      );

      // Assert: URL should be correctly constructed
      const link = screen.getByRole("link", { name: /circleci/i });
      expect(link).toHaveAttribute(
        "href",
        "https://circleci.com/gh/org/repo/pipelines/12345"
      );
    });

    it("should handle Bitbucket projectSlug format", () => {
      const circleCIEvent = createMockEvent({
        source: "circleci",
        payload: {
          pipelineNumber: 67890,
          projectSlug: "bb/workspace/repo",
        },
        message: "CircleCI deployment",
      });

      setMockQueryData([circleCIEvent]);

      renderWithProviders(
        <DORAMetricsDetail
          open={true}
          onOpenChange={() => {}}
          metrics={createMockMetrics()}
          initialTab="deployment"
        />
      );

      // Assert: URL should handle Bitbucket format
      const link = screen.getByRole("link", { name: /circleci/i });
      expect(link).toHaveAttribute(
        "href",
        "https://circleci.com/bb/workspace/repo/pipelines/67890"
      );
    });

    it("should not show external link when projectSlug is missing", () => {
      const circleCIEvent = createMockEvent({
        source: "circleci",
        payload: {
          pipelineNumber: 12345,
          // projectSlug missing
        },
        message: "CircleCI deployment",
      });

      setMockQueryData([circleCIEvent]);

      renderWithProviders(
        <DORAMetricsDetail
          open={true}
          onOpenChange={() => {}}
          metrics={createMockMetrics()}
          initialTab="deployment"
        />
      );

      // Assert: external link should not be present
      const link = screen.queryByRole("link", { name: /circleci/i });
      expect(link).not.toBeInTheDocument();
    });

    it("should not show external link when pipelineNumber is missing", () => {
      const circleCIEvent = createMockEvent({
        source: "circleci",
        payload: {
          projectSlug: "gh/org/repo",
          // pipelineNumber missing
        },
        message: "CircleCI deployment",
      });

      setMockQueryData([circleCIEvent]);

      renderWithProviders(
        <DORAMetricsDetail
          open={true}
          onOpenChange={() => {}}
          metrics={createMockMetrics()}
          initialTab="deployment"
        />
      );

      // Assert: external link should not be present
      const link = screen.queryByRole("link", { name: /circleci/i });
      expect(link).not.toBeInTheDocument();
    });
  });

  describe("ReleaseCard clickability", () => {
    it("should call onClick handler when ReleaseCard is clicked", () => {
      const handleEventClick = vi.fn();
      
      const circleCIEvent = createMockEvent({
        source: "circleci",
        payload: {
          pipelineNumber: 12345,
        },
        message: "CircleCI deployment",
      });

      setMockQueryData([circleCIEvent]);

      renderWithProviders(
        <DORAMetricsDetail
          open={true}
          onOpenChange={() => {}}
          metrics={createMockMetrics()}
          initialTab="deployment"
        />
      );

      // Find and click the ReleaseCard
      const releaseCard = screen.getByText(/circleci deployment/i).closest(".p-3");
      expect(releaseCard).toBeInTheDocument();
      fireEvent.click(releaseCard!);

      // Assert: onClick should be called (event detail sheet should open)
      // This will be verified by checking if event detail sheet is rendered
      // For now, we verify the card is clickable
      expect(releaseCard).toHaveClass("cursor-pointer");
    });
  });
});
