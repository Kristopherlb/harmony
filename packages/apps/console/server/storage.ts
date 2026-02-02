import { randomUUID } from "crypto";
import type {
  Event,
  InsertEvent,
  Project,
  InsertProject,
  EventSource,
  EventType,
  Severity,
  SecurityFinding,
  InsertSecurityFinding,
  SecurityTool,
  SecuritySeverity,
  SecurityStatus,
  Comment,
  InsertComment,
  UserProfile,
  ContextType,
  Service,
  InsertService,
  Team,
  InsertTeam,
  ServiceHealth,
  ServiceType,
  ServiceTier,
} from "@shared/schema";
import { generateSeedData as generateSeedDataFromInfra } from "./infrastructure/seed";

export interface IActivityRepository {
  getEvents(options?: { page?: number; pageSize?: number }): Promise<{ events: Event[]; total: number }>;
  getEventById(id: string): Promise<Event | undefined>;
  getEventsBySource(source: EventSource): Promise<Event[]>;
  getEventsByUser(userId: string): Promise<Event[]>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: string, updates: Partial<Event>): Promise<Event | undefined>;
  resolveBlocker(id: string): Promise<Event | undefined>;
}

export interface IProjectRepository {
  getProjects(): Promise<Project[]>;
  getProjectById(id: string): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, updates: Partial<Project>): Promise<Project | undefined>;
}

export interface ISecurityRepository {
  getFindings(options?: {
    tool?: SecurityTool;
    severity?: SecuritySeverity;
    status?: SecurityStatus;
    page?: number;
    pageSize?: number;
  }): Promise<{ findings: SecurityFinding[]; total: number }>;
  getFindingById(id: string): Promise<SecurityFinding | undefined>;
  createFinding(finding: InsertSecurityFinding): Promise<SecurityFinding>;
  updateFinding(id: string, updates: Partial<SecurityFinding>): Promise<SecurityFinding | undefined>;
  resolveFinding(id: string): Promise<SecurityFinding | undefined>;
  getSecuritySummary(): Promise<{
    totalOpen: number;
    bySeverity: Record<SecuritySeverity, number>;
    byTool: Record<SecurityTool, number>;
  }>;
}

export interface ICommentRepository {
  getCommentsByEvent(eventId: string): Promise<Comment[]>;
  createComment(comment: InsertComment): Promise<Comment>;
  deleteComment(id: string): Promise<boolean>;
}

export interface IUserRepository {
  getUserProfile(userId: string): Promise<UserProfile | undefined>;
  getUserProfileByUsername(username: string): Promise<UserProfile | undefined>;
}

export interface IServiceCatalogRepository {
  getServices(options?: { teamId?: string; type?: ServiceType; health?: ServiceHealth }): Promise<Service[]>;
  getServiceById(id: string): Promise<Service | undefined>;
  getTeams(): Promise<Team[]>;
  getTeamById(id: string): Promise<Team | undefined>;
}

export interface ICircleCIJobMetricsRepository {
  upsertJobMetrics(metrics: Array<{
    projectSlug: string;
    workflowName: string;
    jobName: string;
    jobPrefix: string | null;
    serviceStackName: string | null;
    reportingWindow: string;
    windowStart: Date;
    windowEnd: Date;
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
    successRate: number;
    throughput: number;
    totalCreditsUsed: number | null;
    durationMetrics: Record<string, unknown>;
  }>): Promise<void>;
  
  getJobMetrics(options?: {
    projectSlug?: string;
    workflowName?: string;
    jobPrefix?: string;
    serviceStackName?: string;
    reportingWindow?: string;
  }): Promise<Array<{
    id: string;
    projectSlug: string;
    workflowName: string;
    jobName: string;
    jobPrefix: string | null;
    serviceStackName: string | null;
    reportingWindow: string;
    windowStart: Date;
    windowEnd: Date;
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
    successRate: number;
    throughput: number;
    totalCreditsUsed: number | null;
    durationMetrics: Record<string, unknown>;
    syncedAt: Date;
  }>>;
}

export interface ICircleCIJobRunsRepository {
  upsertJobRuns(runs: Array<{
    projectSlug: string;
    pipelineId: string;
    pipelineNumber?: number;
    workflowId: string;
    workflowName: string;
    jobId?: string;
    jobName: string;
    jobPrefix?: string | null;
    serviceStackName?: string | null;
    branch?: string;
    releaseKey?: string;
    revision?: string;
    jobStartedAt?: Date;
    jobStoppedAt?: Date;
    timestamp: Date;
    status: string;
    failed: boolean;
  }>): Promise<void>;
  
  getJobRuns(options?: {
    projectSlug?: string;
    workflowName?: string;
    releaseKey?: string;
    serviceStackName?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<Array<{
    id: string;
    projectSlug: string;
    pipelineId: string;
    pipelineNumber: number | null;
    workflowId: string;
    workflowName: string;
    jobId: string | null;
    jobName: string;
    jobPrefix: string | null;
    serviceStackName: string | null;
    branch: string | null;
    releaseKey: string | null;
    revision: string | null;
    jobStartedAt: Date | null;
    jobStoppedAt: Date | null;
    timestamp: Date;
    status: string;
    failed: boolean;
    syncedAt: Date;
  }>>;
}

export class SeedableMemoryRepository implements IActivityRepository, IProjectRepository, ISecurityRepository, ICommentRepository, IUserRepository, IServiceCatalogRepository {
  private events: Map<string, Event>;
  private projects: Map<string, Project>;
  private services: Map<string, Service>;
  private teams: Map<string, Team>;
  private securityFindings: Map<string, SecurityFinding>;
  private comments: Map<string, Comment>;

  constructor(initialData?: InitialData) {
    this.events = new Map();
    this.projects = new Map();
    this.securityFindings = new Map();
    this.comments = new Map();
    this.services = new Map();
    this.teams = new Map();

    if (initialData?.events) {
      initialData.events.forEach((event) => {
        this.events.set(event.id, event);
      });
    }

    if (initialData?.projects) {
      initialData.projects.forEach((project) => {
        this.projects.set(project.id, project);
      });
    }

    if (initialData?.securityFindings) {
      initialData.securityFindings.forEach((finding) => {
        this.securityFindings.set(finding.id, finding);
      });
    }

    if (initialData?.comments) {
      initialData.comments.forEach((comment) => {
        this.comments.set(comment.id, comment);
      });
    }

    if (initialData?.services) {
      initialData.services.forEach((service) => {
        this.services.set(service.id, service);
      });
    }

    if (initialData?.teams) {
      initialData.teams.forEach((team) => {
        this.teams.set(team.id, team);
      });
    }
  }

  async getEvents(options?: { page?: number; pageSize?: number }): Promise<{ events: Event[]; total: number }> {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 50;
    
    const allEvents = Array.from(this.events.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    
    const start = (page - 1) * pageSize;
    const events = allEvents.slice(start, start + pageSize);
    
    return { events, total: allEvents.length };
  }

  async getEventById(id: string): Promise<Event | undefined> {
    return this.events.get(id);
  }

  async getEventsBySource(source: EventSource): Promise<Event[]> {
    return Array.from(this.events.values()).filter((e) => e.source === source);
  }

  async getEventsByUser(userId: string): Promise<Event[]> {
    return Array.from(this.events.values()).filter((e) => e.userId === userId);
  }

  async createEvent(insertEvent: InsertEvent): Promise<Event> {
    const id = randomUUID();
    const incidentId =
      insertEvent.incidentId ?? (insertEvent.contextType === "incident" ? id : undefined);
    const event: Event = { ...insertEvent, id, incidentId };
    this.events.set(id, event);
    return event;
  }

  async updateEvent(id: string, updates: Partial<Event>): Promise<Event | undefined> {
    const existing = this.events.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates };
    this.events.set(id, updated);
    return updated;
  }

  async resolveBlocker(id: string): Promise<Event | undefined> {
    const existing = this.events.get(id);
    if (!existing || existing.type !== "blocker") return undefined;
    
    const resolved: Event = {
      ...existing,
      resolved: true,
      resolvedAt: new Date().toISOString(),
    };
    this.events.set(id, resolved);
    return resolved;
  }


  async getProjects(): Promise<Project[]> {
    return Array.from(this.projects.values());
  }

  async getProjectById(id: string): Promise<Project | undefined> {
    return this.projects.get(id);
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const id = randomUUID();
    const project: Project = { ...insertProject, id };
    this.projects.set(id, project);
    return project;
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<Project | undefined> {
    const existing = this.projects.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates };
    this.projects.set(id, updated);
    return updated;
  }

  async getFindings(options?: {
    tool?: SecurityTool;
    severity?: SecuritySeverity;
    status?: SecurityStatus;
    page?: number;
    pageSize?: number;
  }): Promise<{ findings: SecurityFinding[]; total: number }> {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 50;

    let allFindings = Array.from(this.securityFindings.values());

    if (options?.tool) {
      allFindings = allFindings.filter((f) => f.tool === options.tool);
    }
    if (options?.severity) {
      allFindings = allFindings.filter((f) => f.severity === options.severity);
    }
    if (options?.status) {
      allFindings = allFindings.filter((f) => f.status === options.status);
    }

    allFindings.sort(
      (a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime()
    );

    const start = (page - 1) * pageSize;
    const findings = allFindings.slice(start, start + pageSize);

    return { findings, total: allFindings.length };
  }

  async getFindingById(id: string): Promise<SecurityFinding | undefined> {
    return this.securityFindings.get(id);
  }

  async createFinding(insertFinding: InsertSecurityFinding): Promise<SecurityFinding> {
    const id = randomUUID();
    const finding: SecurityFinding = { ...insertFinding, id };
    this.securityFindings.set(id, finding);
    return finding;
  }

  async updateFinding(id: string, updates: Partial<SecurityFinding>): Promise<SecurityFinding | undefined> {
    const existing = this.securityFindings.get(id);
    if (!existing) return undefined;

    const updated = { ...existing, ...updates };
    this.securityFindings.set(id, updated);
    return updated;
  }

  async resolveFinding(id: string): Promise<SecurityFinding | undefined> {
    const existing = this.securityFindings.get(id);
    if (!existing) return undefined;

    const resolved: SecurityFinding = {
      ...existing,
      status: "resolved",
      resolvedAt: new Date().toISOString(),
    };
    this.securityFindings.set(id, resolved);
    return resolved;
  }

  async getSecuritySummary(): Promise<{
    totalOpen: number;
    bySeverity: Record<SecuritySeverity, number>;
    byTool: Record<SecurityTool, number>;
  }> {
    const allFindings = Array.from(this.securityFindings.values());
    const openFindings = allFindings.filter((f) => f.status === "open");

    const bySeverity: Record<SecuritySeverity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    const byTool: Record<SecurityTool, number> = {
      wiz: 0,
      aws_inspector: 0,
      artifactory_xray: 0,
    };

    for (const finding of openFindings) {
      bySeverity[finding.severity]++;
      byTool[finding.tool]++;
    }

    return {
      totalOpen: openFindings.length,
      bySeverity,
      byTool,
    };
  }

  // Comment Repository methods
  async getCommentsByEvent(eventId: string): Promise<Comment[]> {
    return Array.from(this.comments.values())
      .filter((c) => c.eventId === eventId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  async createComment(insertComment: InsertComment): Promise<Comment> {
    const id = randomUUID();
    const comment: Comment = {
      ...insertComment,
      id,
      createdAt: new Date().toISOString(),
    };
    this.comments.set(id, comment);
    return comment;
  }

  async deleteComment(id: string): Promise<boolean> {
    return this.comments.delete(id);
  }

  // User Repository methods
  async getUserProfile(userId: string): Promise<UserProfile | undefined> {
    const userEvents = Array.from(this.events.values()).filter((e) => e.userId === userId);
    if (userEvents.length === 0) return undefined;

    // Note: getUserStats is now a use case - this will need to be updated
    // For now, return a basic profile without stats
    const username = userEvents[0]?.username ?? userId;
    
    const recentEvents = userEvents
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);

    const assignedItems = userEvents.filter((e) => {
      const payload = e.payload as Record<string, unknown>;
      return payload.assignee === username || !e.resolved;
    }).slice(0, 10);

    // Note: stats will need to be computed via use case
    // For now, return basic profile structure
    return {
      userId,
      username,
      stats: {
        userId,
        username,
        logsThisWeek: 0,
        blockersResolved: 0,
        decisionsLogged: 0,
        totalEvents: userEvents.length,
        openBlockers: 0,
        openPRs: 0,
        openTickets: 0,
        openAlerts: 0,
      },
      recentEvents,
      assignedItems,
    };
  }

  async getUserProfileByUsername(username: string): Promise<UserProfile | undefined> {
    const userEvents = Array.from(this.events.values()).filter((e) => e.username === username);
    if (userEvents.length === 0) return undefined;

    const userId = userEvents[0]?.userId ?? username;
    return this.getUserProfile(userId);
  }

  // Service Catalog Repository methods
  async getServices(options?: { teamId?: string; type?: ServiceType; health?: ServiceHealth }): Promise<Service[]> {
    let allServices = Array.from(this.services.values());

    if (options?.teamId) {
      allServices = allServices.filter((s) => s.teamId === options.teamId);
    }
    if (options?.type) {
      allServices = allServices.filter((s) => s.type === options.type);
    }
    if (options?.health) {
      allServices = allServices.filter((s) => s.health === options.health);
    }

    return allServices.sort((a, b) => {
      const tierOrder = { tier1: 0, tier2: 1, tier3: 2 };
      return tierOrder[a.tier] - tierOrder[b.tier];
    });
  }

  async getServiceById(id: string): Promise<Service | undefined> {
    return this.services.get(id);
  }

  async getTeams(): Promise<Team[]> {
    return Array.from(this.teams.values());
  }

  async getTeamById(id: string): Promise<Team | undefined> {
    return this.teams.get(id);
  }
}

// generateSeedData moved to infrastructure/seed.ts
// Re-export for backward compatibility
import { generateSeedData as _generateSeedData, type InitialData as SeedInitialData } from "./infrastructure/seed";
export type InitialData = SeedInitialData;
export const generateSeedData = _generateSeedData;

export function createRepository(initialData?: InitialData): IActivityRepository & ICommentRepository & IServiceCatalogRepository {
  const mode = process.env.REPOSITORY_MODE || "memory";
  
  if (mode === "postgres") {
    // Use require() for lazy loading to avoid importing drizzle when using memory repository
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PostgresRepository } = require("./repositories/postgres-repository");
    return new PostgresRepository();
  }
  
  // Default to memory repository
  return new SeedableMemoryRepository(initialData ?? _generateSeedData());
}

export const repository = createRepository();
