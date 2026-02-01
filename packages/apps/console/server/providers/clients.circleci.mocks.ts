/**
 * CircleCI API mocks based on OpenAPI spec (spec/circleci.openapi.json)
 *
 * These mocks follow the actual CircleCI API v2 structure to ensure tests
 * accurately reflect real API responses.
 */

export interface CircleCIPipeline {
  id: string; // UUID
  number?: number; // int64 - pipeline number
  created_at?: string; // date-time
  state?: "created" | "errored" | "setup-pending" | "setup" | "pending";
  vcs?: {
    branch?: string;
    revision?: string;
    commit?: {
      subject?: string;
    };
  };
  project_slug?: string;
  updated_at?: string;
  errors?: Array<{
    type: string;
    message: string;
  }>;
  trigger_parameters?: Record<string, unknown>;
  trigger?: {
    type: "scheduled_pipeline" | "explicit" | "api" | "webhook";
    received_at: string;
    actor?: {
      login: string;
      avatar_url?: string | null;
    };
  };
}

export interface CircleCIWorkflow {
  id: string; // UUID
  name?: string;
  status?: "success" | "running" | "not_run" | "failed" | "error" | "failing" | "on_hold" | "canceled" | "unauthorized";
  created_at?: string; // date-time
  stopped_at?: string | null; // date-time, nullable
  pipeline_id?: string; // UUID
  pipeline_number?: number; // int64
  project_slug?: string;
  started_by?: string; // UUID
  canceled_by?: string; // UUID
  errored_by?: string; // UUID
  auto_rerun_number?: number;
  max_auto_reruns?: number;
  tag?: "setup" | null;
}

export interface CircleCIJob {
  id: string; // UUID
  name?: string;
  status?: "success" | "running" | "not_run" | "failed" | "retried" | "queued" | "not_running" | "infrastructure_fail" | "timedout" | "on_hold" | "terminated-unknown" | "blocked" | "canceled" | "unauthorized";
  started_at?: string; // date-time
  stopped_at?: string | null; // date-time, nullable
  job_number?: number; // int64
  project_slug?: string;
  type?: "build" | "approval";
  dependencies?: string[]; // UUIDs
  requires?: Record<string, string[]>;
  canceled_by?: string; // UUID
  approved_by?: string; // UUID
  approval_request_id?: string; // UUID
}

export interface CircleCIPipelinePage {
  items?: CircleCIPipeline[];
  next_page_token?: string | null;
}

export interface CircleCIWorkflowPage {
  items?: CircleCIWorkflow[];
  next_page_token?: string | null;
}

export interface CircleCIJobPage {
  items?: CircleCIJob[];
  next_page_token?: string | null;
}

/**
 * Creates a mock CircleCI pipeline response
 */
export function createMockPipeline(overrides?: Partial<CircleCIPipeline>): CircleCIPipeline {
  const now = new Date().toISOString();
  return {
    id: "5034460f-c7c4-4c43-9457-de07e2029e7b",
    number: 13329,
    created_at: now,
    state: "created",
    vcs: {
      branch: "release/v11.0.40",
      revision: "abc123def456",
    },
    project_slug: "bb/ninjarmm/cdk-ninja-region-compute",
    updated_at: now,
    ...overrides,
  };
}

/**
 * Creates a mock CircleCI workflow response
 */
export function createMockWorkflow(overrides?: Partial<CircleCIWorkflow>): CircleCIWorkflow {
  const now = new Date().toISOString();
  return {
    id: "a3295ae1-d308-4ba0-8cd3-fa3c7591c1d5",
    name: "deploy-prod",
    status: "success",
    created_at: now,
    stopped_at: now,
    pipeline_id: "5034460f-c7c4-4c43-9457-de07e2029e7b",
    pipeline_number: 13329,
    project_slug: "bb/ninjarmm/cdk-ninja-region-compute",
    started_by: "user-uuid-123",
    ...overrides,
  };
}

/**
 * Creates a mock CircleCI job response
 */
export function createMockJob(overrides?: Partial<CircleCIJob>): CircleCIJob {
  const now = new Date().toISOString();
  return {
    id: "job-uuid-123",
    name: "Deploy ca-StackName",
    status: "success",
    started_at: now,
    stopped_at: now,
    job_number: 1,
    project_slug: "bb/ninjarmm/cdk-ninja-region-compute",
    type: "build",
    dependencies: [],
    ...overrides,
  };
}

/**
 * Creates a mock pipeline page response
 */
export function createMockPipelinePage(pipelines: CircleCIPipeline[] = [], nextPageToken?: string | null): CircleCIPipelinePage {
  return {
    items: pipelines,
    next_page_token: nextPageToken ?? null,
  };
}

/**
 * Creates a mock workflow page response
 */
export function createMockWorkflowPage(workflows: CircleCIWorkflow[] = [], nextPageToken?: string | null): CircleCIWorkflowPage {
  return {
    items: workflows,
    next_page_token: nextPageToken ?? null,
  };
}

/**
 * Creates a mock job page response
 */
export function createMockJobPage(jobs: CircleCIJob[] = [], nextPageToken?: string | null): CircleCIJobPage {
  return {
    items: jobs,
    next_page_token: nextPageToken ?? null,
  };
}

/**
 * Common test scenarios
 */
export const CircleCITestScenarios = {
  /**
   * Single successful deploy-prod workflow with deploy jobs
   */
  successfulDeployProd: {
    pipeline: createMockPipeline({
      id: "p1",
      number: 100,
      vcs: { branch: "release/v11.0.0", revision: "abc" },
    }),
    workflows: [
      createMockWorkflow({
        id: "w1",
        name: "deploy-prod",
        status: "success",
        stopped_at: new Date().toISOString(),
      }),
    ],
    jobs: [
      createMockJob({
        id: "j1",
        name: "Deploy ca-StackName",
        status: "success",
        stopped_at: new Date().toISOString(),
      }),
    ],
  },

  /**
   * ansible_playbook_prod workflow (no deploy jobs, uses workflow fallback)
   */
  ansiblePlaybookProd: {
    pipeline: createMockPipeline({
      id: "p2",
      number: 101,
      vcs: { branch: "release/v11.0.1", revision: "def" },
    }),
    workflows: [
      createMockWorkflow({
        id: "w2",
        name: "ansible_playbook_prod",
        status: "success",
        stopped_at: new Date().toISOString(),
      }),
    ],
    jobs: [
      createMockJob({
        id: "j2",
        name: "ansible-playbook", // Doesn't match ^Deploy\s regex
        status: "success",
        stopped_at: new Date().toISOString(),
      }),
    ],
  },

  /**
   * Failed deploy-prod workflow
   */
  failedDeployProd: {
    pipeline: createMockPipeline({
      id: "p3",
      number: 102,
      vcs: { branch: "release/v11.0.2", revision: "ghi" },
    }),
    workflows: [
      createMockWorkflow({
        id: "w3",
        name: "deploy-prod",
        status: "failed",
        stopped_at: new Date().toISOString(),
      }),
    ],
    jobs: [
      createMockJob({
        id: "j3",
        name: "Deploy ca-StackName",
        status: "failed",
        stopped_at: new Date().toISOString(),
      }),
    ],
  },

  /**
   * Pipeline with both deploy-prod and ansible_playbook_prod workflows
   */
  bothWorkflows: {
    pipeline: createMockPipeline({
      id: "p4",
      number: 103,
      vcs: { branch: "release/v11.0.3", revision: "jkl" },
    }),
    workflows: [
      createMockWorkflow({
        id: "w4a",
        name: "deploy-prod",
        status: "success",
        stopped_at: new Date().toISOString(),
      }),
      createMockWorkflow({
        id: "w4b",
        name: "ansible_playbook_prod",
        status: "success",
        stopped_at: new Date().toISOString(),
      }),
    ],
    jobs: {
      w4a: [
        createMockJob({
          id: "j4a",
          name: "Deploy ca-StackName",
          status: "success",
          stopped_at: new Date().toISOString(),
        }),
      ],
      w4b: [
        createMockJob({
          id: "j4b",
          name: "ansible-playbook",
          status: "success",
          stopped_at: new Date().toISOString(),
        }),
      ],
    },
  },

  /**
   * Multiple ring deployments (CA, OC, EU) in same workflow
   */
  multipleRings: {
    pipeline: createMockPipeline({
      id: "p5",
      number: 104,
      vcs: { branch: "release/v11.0.4", revision: "mno" },
    }),
    workflows: [
      createMockWorkflow({
        id: "w5",
        name: "deploy-prod",
        status: "success",
        stopped_at: new Date().toISOString(),
      }),
    ],
    jobs: [
      createMockJob({
        id: "j5a",
        name: "Deploy ca-StackName",
        status: "success",
        stopped_at: new Date().toISOString(),
      }),
      createMockJob({
        id: "j5b",
        name: "Deploy oc-StackName",
        status: "success",
        stopped_at: new Date().toISOString(),
      }),
      createMockJob({
        id: "j5c",
        name: "Deploy eu-StackName",
        status: "success",
        stopped_at: new Date().toISOString(),
      }),
    ],
  },
};
