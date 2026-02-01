import { v4 as uuidv4 } from "uuid";
import type {
  Action,
  WorkflowExecution,
  WorkflowStatus,
  ExecuteActionRequest,
  RiskLevel,
} from "@shared/schema";

export interface WorkflowStartResult {
  runId: string;
  status: WorkflowStatus;
  requiresApproval: boolean;
}

export interface WorkflowProgress {
  runId: string;
  status: WorkflowStatus;
  output: string[];
  error?: string;
}

export interface IWorkflowEngine {
  startWorkflow(
    action: Action,
    request: ExecuteActionRequest,
    userId: string,
    username: string
  ): Promise<WorkflowStartResult>;

  getWorkflowStatus(runId: string): Promise<WorkflowProgress | null>;

  cancelWorkflow(runId: string): Promise<boolean>;

  approveWorkflow(runId: string, approverId: string): Promise<boolean>;

  rejectWorkflow(runId: string, approverId: string, reason?: string): Promise<boolean>;
}

const CRITICAL_RISK_LEVELS: RiskLevel[] = ["critical", "high"];

export class MockWorkflowEngine implements IWorkflowEngine {
  private executions: Map<string, WorkflowProgress> = new Map();
  private executionRequests: Map<
    string,
    { action: Action; request: ExecuteActionRequest; userId: string; username: string }
  > = new Map();

  async startWorkflow(
    action: Action,
    request: ExecuteActionRequest,
    userId: string,
    username: string
  ): Promise<WorkflowStartResult> {
    this.validateParams(action, request.params);

    const runId = `run-${uuidv4().slice(0, 8)}`;
    const requiresApproval = CRITICAL_RISK_LEVELS.includes(action.riskLevel);

    const status: WorkflowStatus = requiresApproval ? "pending_approval" : "running";

    this.executions.set(runId, {
      runId,
      status,
      output: [
        `[${new Date().toISOString()}] Workflow started: ${action.name}`,
        `[${new Date().toISOString()}] Initiated by: ${username}`,
        requiresApproval
          ? `[${new Date().toISOString()}] Awaiting approval (${action.riskLevel} risk action)`
          : `[${new Date().toISOString()}] Executing...`,
      ],
    });

    this.executionRequests.set(runId, { action, request, userId, username });

    if (!requiresApproval) {
      this.simulateExecution(runId, action);
    }

    return { runId, status, requiresApproval };
  }

  async getWorkflowStatus(runId: string): Promise<WorkflowProgress | null> {
    return this.executions.get(runId) || null;
  }

  async cancelWorkflow(runId: string): Promise<boolean> {
    const execution = this.executions.get(runId);
    if (!execution) return false;

    if (execution.status === "completed" || execution.status === "failed") {
      return false;
    }

    execution.status = "cancelled";
    execution.output.push(`[${new Date().toISOString()}] Workflow cancelled`);
    return true;
  }

  async approveWorkflow(runId: string, approverId: string): Promise<boolean> {
    const execution = this.executions.get(runId);
    const request = this.executionRequests.get(runId);

    if (!execution || !request || execution.status !== "pending_approval") {
      return false;
    }

    execution.status = "approved";
    execution.output.push(
      `[${new Date().toISOString()}] Approved by: ${approverId}`,
      `[${new Date().toISOString()}] Executing workflow...`
    );

    this.simulateExecution(runId, request.action);
    return true;
  }

  async rejectWorkflow(runId: string, approverId: string, reason?: string): Promise<boolean> {
    const execution = this.executions.get(runId);
    if (!execution || execution.status !== "pending_approval") {
      return false;
    }

    execution.status = "rejected";
    execution.output.push(
      `[${new Date().toISOString()}] Rejected by: ${approverId}`,
      reason ? `[${new Date().toISOString()}] Reason: ${reason}` : ""
    );
    return true;
  }

  private validateParams(action: Action, params: Record<string, unknown>): void {
    for (const param of action.requiredParams) {
      if (param.required && !(param.name in params)) {
        throw new Error(`Missing required parameter: ${param.name}`);
      }

      const value = params[param.name];
      if (value === undefined || value === null) {
        if (param.required) {
          throw new Error(`Parameter ${param.name} cannot be empty`);
        }
        continue;
      }

      switch (param.type) {
        case "number":
          if (typeof value !== "number" && isNaN(Number(value))) {
            throw new Error(`Parameter ${param.name} must be a number`);
          }
          break;
        case "boolean":
          if (typeof value !== "boolean" && value !== "true" && value !== "false") {
            throw new Error(`Parameter ${param.name} must be a boolean`);
          }
          break;
        case "email":
          if (typeof value !== "string" || !value.includes("@")) {
            throw new Error(`Parameter ${param.name} must be a valid email`);
          }
          break;
        case "select":
          if (param.options && !param.options.includes(String(value))) {
            throw new Error(
              `Parameter ${param.name} must be one of: ${param.options.join(", ")}`
            );
          }
          break;
      }
    }
  }

  private simulateExecution(runId: string, action: Action): void {
    const execution = this.executions.get(runId);
    if (!execution) return;

    const steps = [
      "Validating inputs...",
      "Connecting to target system...",
      "Executing action...",
      "Verifying result...",
      "Cleaning up...",
    ];

    let stepIndex = 0;
    const interval = setInterval(() => {
      if (stepIndex < steps.length) {
        execution.output.push(`[${new Date().toISOString()}] ${steps[stepIndex]}`);
        stepIndex++;
      } else {
        clearInterval(interval);
        execution.status = "completed";
        execution.output.push(
          `[${new Date().toISOString()}] Workflow completed successfully`,
          `[${new Date().toISOString()}] Action "${action.name}" finished`
        );
      }
    }, 500);
  }

  getExecutionRequests(): Map<
    string,
    { action: Action; request: ExecuteActionRequest; userId: string; username: string }
  > {
    return this.executionRequests;
  }

  clearAll(): void {
    this.executions.clear();
    this.executionRequests.clear();
  }
}

export class TemporalAdapter implements IWorkflowEngine {
  private temporalHost: string;
  private namespace: string;

  constructor(config: { host?: string; namespace?: string } = {}) {
    this.temporalHost = config.host || process.env.TEMPORAL_HOST || "localhost:7233";
    this.namespace = config.namespace || process.env.TEMPORAL_NAMESPACE || "default";
  }

  async startWorkflow(
    action: Action,
    request: ExecuteActionRequest,
    userId: string,
    username: string
  ): Promise<WorkflowStartResult> {
    const runId = `temporal-${uuidv4().slice(0, 8)}`;
    const requiresApproval = ["critical", "high"].includes(action.riskLevel);

    console.log(`[TemporalAdapter] Would start workflow on ${this.temporalHost}/${this.namespace}`);
    console.log(`[TemporalAdapter] Workflow ID: ${action.workflowId || action.id}`);
    console.log(`[TemporalAdapter] Params: ${JSON.stringify(request.params)}`);

    return {
      runId,
      status: requiresApproval ? "pending_approval" : "running",
      requiresApproval,
    };
  }

  async getWorkflowStatus(runId: string): Promise<WorkflowProgress | null> {
    console.log(`[TemporalAdapter] Would query workflow status: ${runId}`);
    return null;
  }

  async cancelWorkflow(runId: string): Promise<boolean> {
    console.log(`[TemporalAdapter] Would cancel workflow: ${runId}`);
    return true;
  }

  async approveWorkflow(runId: string, approverId: string): Promise<boolean> {
    console.log(`[TemporalAdapter] Would signal approval to workflow: ${runId}`);
    return true;
  }

  async rejectWorkflow(runId: string, approverId: string, reason?: string): Promise<boolean> {
    console.log(`[TemporalAdapter] Would signal rejection to workflow: ${runId}`);
    return true;
  }
}

export const workflowEngine: IWorkflowEngine = new MockWorkflowEngine();
