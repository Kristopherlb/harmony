import { eq, desc, and, gte, lte, sql, or, inArray, isNotNull } from "drizzle-orm";
import { getDb } from "../db";
import { events, comments, services, teams, circleciJobMetrics, circleciJobRuns } from "@shared/db-schema";
import type {
  IActivityRepository,
  ICommentRepository,
  IServiceCatalogRepository,
  ICircleCIJobMetricsRepository,
  ICircleCIJobRunsRepository,
} from "../storage";
import type {
  Event,
  InsertEvent,
  Comment,
  InsertComment,
  Service,
  InsertService,
  Team,
  InsertTeam,
  EventSource,
  UserStats,
  DORAMetrics,
  ServiceType,
  ServiceHealth,
} from "@shared/schema";
import { randomUUID } from "crypto";

/**
 * PostgresRepository implements the repository interfaces using Drizzle ORM and PostgreSQL.
 * This replaces the in-memory SeedableMemoryRepository when REPOSITORY_MODE=postgres.
 */
export class PostgresRepository
  implements IActivityRepository, ICommentRepository, IServiceCatalogRepository, ICircleCIJobMetricsRepository, ICircleCIJobRunsRepository
{
  // IActivityRepository implementation

  async getEvents(options?: {
    page?: number;
    pageSize?: number;
  }): Promise<{ events: Event[]; total: number }> {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 50;
    const db = getDb();

    // Get total count
    const totalResult = await db.select({ count: sql<number>`count(*)` }).from(events);
    const total = Number(totalResult[0]?.count ?? 0);

    // Get paginated events, sorted by timestamp descending
    const dbEvents = await db
      .select()
      .from(events)
      .orderBy(desc(events.timestamp))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const eventsList: Event[] = dbEvents.map((row) => this.mapDbEventToEvent(row));

    return { events: eventsList, total };
  }

  async getEventById(id: string): Promise<Event | undefined> {
    const db = getDb();
    const result = await db.select().from(events).where(eq(events.id, id)).limit(1);

    if (result.length === 0) {
      return undefined;
    }

    return this.mapDbEventToEvent(result[0]);
  }

  async getEventsBySource(source: EventSource): Promise<Event[]> {
    const db = getDb();
    const dbEvents = await db
      .select()
      .from(events)
      .where(eq(events.source, source))
      .orderBy(desc(events.timestamp));

    return dbEvents.map((row) => this.mapDbEventToEvent(row));
  }

  async getEventsByUser(userId: string): Promise<Event[]> {
    const db = getDb();
    const dbEvents = await db
      .select()
      .from(events)
      .where(eq(events.userId, userId))
      .orderBy(desc(events.timestamp));

    return dbEvents.map((row) => this.mapDbEventToEvent(row));
  }

  /**
   * Check if an event already exists to prevent duplicates.
   * Uses externalLink if available, otherwise falls back to source + timestamp + message.
   */
  private async findExistingEvent(insertEvent: InsertEvent): Promise<Event | undefined> {
    const db = getDb();
    const conditions = [];

    // Best case: use externalLink if available (most reliable)
    if (insertEvent.externalLink) {
      conditions.push(eq(events.externalLink, insertEvent.externalLink));
    }

    // Fallback: use source + timestamp + message (within 1 second window for timestamp precision)
    const eventTimestamp = new Date(insertEvent.timestamp);
    const timestampStart = new Date(eventTimestamp.getTime() - 1000);
    const timestampEnd = new Date(eventTimestamp.getTime() + 1000);

    conditions.push(
      and(
        eq(events.source, insertEvent.source),
        eq(events.message, insertEvent.message),
        gte(events.timestamp, timestampStart),
        lte(events.timestamp, timestampEnd)
      )
    );

    // Check for existing event using OR of the conditions
    const existing = await db
      .select()
      .from(events)
      .where(or(...conditions))
      .limit(1);

    if (existing.length > 0) {
      return this.mapDbEventToEvent(existing[0]);
    }

    return undefined;
  }

  async createEvent(insertEvent: InsertEvent): Promise<Event> {
    const db = getDb();

    // Check for existing event to prevent duplicates
    const existing = await this.findExistingEvent(insertEvent);
    if (existing) {
      // Return existing event instead of creating a duplicate
      return existing;
    }

    const id = randomUUID();
    const incidentId =
      insertEvent.incidentId ?? (insertEvent.contextType === "incident" ? id : undefined);

    const dbEvent = {
      id,
      incidentId: incidentId ?? null,
      timestamp: new Date(insertEvent.timestamp),
      source: insertEvent.source,
      type: insertEvent.type,
      severity: insertEvent.severity,
      message: insertEvent.message,
      payload: insertEvent.payload,
      userId: insertEvent.userId ?? null,
      username: insertEvent.username ?? null,
      resolved: insertEvent.resolved ?? false,
      resolvedAt: insertEvent.resolvedAt ? new Date(insertEvent.resolvedAt) : null,
      externalLink: insertEvent.externalLink ?? null,
      contextType: insertEvent.contextType ?? "general",
      serviceTags: insertEvent.serviceTags ?? [],
    };

    await db.insert(events).values(dbEvent);

    return this.mapDbEventToEvent({ ...dbEvent, resolvedAt: dbEvent.resolvedAt });
  }

  async updateEvent(id: string, updates: Partial<Event>): Promise<Event | undefined> {
    const db = getDb();
    const existing = await this.getEventById(id);

    if (!existing) {
      return undefined;
    }

    const updateValues: Record<string, unknown> = {};

    if (updates.severity !== undefined) updateValues.severity = updates.severity;
    if (updates.message !== undefined) updateValues.message = updates.message;
    if (updates.resolved !== undefined) updateValues.resolved = updates.resolved;
    if (updates.resolvedAt !== undefined)
      updateValues.resolvedAt = updates.resolvedAt ? new Date(updates.resolvedAt) : null;
    if (updates.payload !== undefined) updateValues.payload = updates.payload;
    if (updates.externalLink !== undefined) updateValues.externalLink = updates.externalLink;
    if (updates.contextType !== undefined) updateValues.contextType = updates.contextType;
    if (updates.serviceTags !== undefined) updateValues.serviceTags = updates.serviceTags;
    if (updates.incidentId !== undefined) updateValues.incidentId = updates.incidentId;

    await db.update(events).set(updateValues).where(eq(events.id, id));

    return this.getEventById(id);
  }

  async resolveBlocker(id: string): Promise<Event | undefined> {
    const existing = await this.getEventById(id);

    if (!existing || existing.type !== "blocker") {
      return undefined;
    }

    return this.updateEvent(id, {
      resolved: true,
      resolvedAt: new Date().toISOString(),
    });
  }

  // ICommentRepository implementation

  async getCommentsByEvent(eventId: string): Promise<Comment[]> {
    const db = getDb();
    const dbComments = await db
      .select()
      .from(comments)
      .where(eq(comments.eventId, eventId))
      .orderBy(comments.createdAt);

    return dbComments.map((row) => this.mapDbCommentToComment(row));
  }

  async createComment(insertComment: InsertComment): Promise<Comment> {
    const db = getDb();
    const id = randomUUID();

    const dbComment = {
      id,
      eventId: insertComment.eventId,
      userId: insertComment.userId,
      username: insertComment.username,
      content: insertComment.content,
      createdAt: new Date(),
      parentId: insertComment.parentId ?? null,
    };

    await db.insert(comments).values(dbComment);

    return this.mapDbCommentToComment(dbComment);
  }

  async deleteComment(id: string): Promise<boolean> {
    const db = getDb();
    
    // Check if comment exists first
    const existing = await db.select().from(comments).where(eq(comments.id, id)).limit(1);
    if (existing.length === 0) {
      return false;
    }

    // Delete the comment
    await db.delete(comments).where(eq(comments.id, id));
    return true;
  }

  // IServiceCatalogRepository implementation

  async getServices(options?: {
    teamId?: string;
    type?: ServiceType;
    health?: ServiceHealth;
  }): Promise<Service[]> {
    const db = getDb();
    const conditions = [];

    if (options?.teamId) {
      conditions.push(eq(services.teamId, options.teamId));
    }
    if (options?.type) {
      conditions.push(eq(services.type, options.type));
    }
    if (options?.health) {
      conditions.push(eq(services.health, options.health));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const dbServices = await db
      .select()
      .from(services)
      .where(whereClause)
      .orderBy(services.tier, services.name);

    return dbServices.map((row) => this.mapDbServiceToService(row));
  }

  async getServiceById(id: string): Promise<Service | undefined> {
    const db = getDb();
    const result = await db.select().from(services).where(eq(services.id, id)).limit(1);

    if (result.length === 0) {
      return undefined;
    }

    return this.mapDbServiceToService(result[0]);
  }

  async getTeams(): Promise<Team[]> {
    const db = getDb();
    const dbTeams = await db.select().from(teams).orderBy(teams.name);

    return dbTeams.map((row) => this.mapDbTeamToTeam(row));
  }

  async getTeamById(id: string): Promise<Team | undefined> {
    const db = getDb();
    const result = await db.select().from(teams).where(eq(teams.id, id)).limit(1);

    if (result.length === 0) {
      return undefined;
    }

    return this.mapDbTeamToTeam(result[0]);
  }

  // ICircleCIJobMetricsRepository implementation

  async upsertJobMetrics(metrics: Array<{
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
  }>): Promise<void> {
    const db = getDb();
    
    for (const metric of metrics) {
      await db.insert(circleciJobMetrics)
        .values({
          projectSlug: metric.projectSlug,
          workflowName: metric.workflowName,
          jobName: metric.jobName,
          jobPrefix: metric.jobPrefix,
          serviceStackName: metric.serviceStackName,
          reportingWindow: metric.reportingWindow,
          windowStart: metric.windowStart,
          windowEnd: metric.windowEnd,
          totalRuns: metric.totalRuns,
          successfulRuns: metric.successfulRuns,
          failedRuns: metric.failedRuns,
          successRate: metric.successRate,
          throughput: metric.throughput,
          totalCreditsUsed: metric.totalCreditsUsed,
          durationMetrics: metric.durationMetrics,
          syncedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [
            circleciJobMetrics.projectSlug,
            circleciJobMetrics.workflowName,
            circleciJobMetrics.jobName,
            circleciJobMetrics.reportingWindow,
            circleciJobMetrics.windowStart,
          ],
          set: {
            jobPrefix: metric.jobPrefix,
            serviceStackName: metric.serviceStackName,
            totalRuns: metric.totalRuns,
            successfulRuns: metric.successfulRuns,
            failedRuns: metric.failedRuns,
            successRate: metric.successRate,
            throughput: metric.throughput,
            totalCreditsUsed: metric.totalCreditsUsed,
            durationMetrics: metric.durationMetrics,
            syncedAt: new Date(),
          },
        });
    }
  }

  async getJobMetrics(options?: {
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
  }>> {
    const db = getDb();
    const conditions = [];

    if (options?.projectSlug) {
      conditions.push(eq(circleciJobMetrics.projectSlug, options.projectSlug));
    }
    if (options?.workflowName) {
      conditions.push(eq(circleciJobMetrics.workflowName, options.workflowName));
    }
    if (options?.jobPrefix) {
      conditions.push(eq(circleciJobMetrics.jobPrefix, options.jobPrefix));
    }
    if (options?.serviceStackName) {
      conditions.push(eq(circleciJobMetrics.serviceStackName, options.serviceStackName));
    }
    if (options?.reportingWindow) {
      conditions.push(eq(circleciJobMetrics.reportingWindow, options.reportingWindow));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const results = await db
      .select()
      .from(circleciJobMetrics)
      .where(whereClause)
      .orderBy(desc(circleciJobMetrics.syncedAt));

    return results.map((row) => ({
      id: row.id,
      projectSlug: row.projectSlug,
      workflowName: row.workflowName,
      jobName: row.jobName,
      jobPrefix: row.jobPrefix,
      serviceStackName: row.serviceStackName,
      reportingWindow: row.reportingWindow,
      windowStart: row.windowStart,
      windowEnd: row.windowEnd,
      totalRuns: row.totalRuns,
      successfulRuns: row.successfulRuns,
      failedRuns: row.failedRuns,
      successRate: row.successRate,
      throughput: row.throughput,
      totalCreditsUsed: row.totalCreditsUsed,
      durationMetrics: row.durationMetrics as Record<string, unknown>,
      syncedAt: row.syncedAt,
    }));
  }

  // ICircleCIJobRunsRepository implementation

  async upsertJobRuns(runs: Array<{
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
  }>): Promise<void> {
    const db = getDb();
    
    for (const run of runs) {
      // Only upsert if we have a jobId (unique constraint)
      if (!run.jobId) {
        // If no jobId, we can't deduplicate, so skip
        continue;
      }
      
      await db.insert(circleciJobRuns)
        .values({
          projectSlug: run.projectSlug,
          pipelineId: run.pipelineId,
          pipelineNumber: run.pipelineNumber ?? null,
          workflowId: run.workflowId,
          workflowName: run.workflowName,
          jobId: run.jobId,
          jobName: run.jobName,
          jobPrefix: run.jobPrefix ?? null,
          serviceStackName: run.serviceStackName ?? null,
          branch: run.branch ?? null,
          releaseKey: run.releaseKey ?? null,
          revision: run.revision ?? null,
          jobStartedAt: run.jobStartedAt ?? null,
          jobStoppedAt: run.jobStoppedAt ?? null,
          timestamp: run.timestamp,
          status: run.status,
          failed: run.failed,
          syncedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: circleciJobRuns.jobId,
          set: {
            status: run.status,
            failed: run.failed,
            jobStoppedAt: run.jobStoppedAt ?? null,
            syncedAt: new Date(),
          },
        });
    }
  }

  async getJobRuns(options?: {
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
  }>> {
    const db = getDb();
    const conditions = [];

    if (options?.projectSlug) {
      conditions.push(eq(circleciJobRuns.projectSlug, options.projectSlug));
    }
    if (options?.workflowName) {
      conditions.push(eq(circleciJobRuns.workflowName, options.workflowName));
    }
    if (options?.releaseKey) {
      conditions.push(eq(circleciJobRuns.releaseKey, options.releaseKey));
    }
    if (options?.serviceStackName) {
      conditions.push(eq(circleciJobRuns.serviceStackName, options.serviceStackName));
    }
    if (options?.startDate) {
      conditions.push(gte(circleciJobRuns.timestamp, options.startDate));
    }
    if (options?.endDate) {
      conditions.push(lte(circleciJobRuns.timestamp, options.endDate));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const results = await db
      .select()
      .from(circleciJobRuns)
      .where(whereClause)
      .orderBy(desc(circleciJobRuns.timestamp));

    return results.map((row) => ({
      id: row.id,
      projectSlug: row.projectSlug,
      pipelineId: row.pipelineId,
      pipelineNumber: row.pipelineNumber,
      workflowId: row.workflowId,
      workflowName: row.workflowName,
      jobId: row.jobId,
      jobName: row.jobName,
      jobPrefix: row.jobPrefix,
      serviceStackName: row.serviceStackName,
      branch: row.branch,
      releaseKey: row.releaseKey,
      revision: row.revision,
      jobStartedAt: row.jobStartedAt,
      jobStoppedAt: row.jobStoppedAt,
      timestamp: row.timestamp,
      status: row.status,
      failed: row.failed,
      syncedAt: row.syncedAt,
    }));
  }

  // Helper methods to map DB rows to API types

  private mapDbEventToEvent(row: {
    id: string;
    incidentId: string | null;
    timestamp: Date;
    source: string;
    type: string;
    severity: string;
    message: string;
    payload: unknown;
    userId: string | null;
    username: string | null;
    resolved: boolean;
    resolvedAt: Date | null;
    externalLink: string | null;
    contextType: string;
    serviceTags: unknown;
  }): Event {
    return {
      id: row.id,
      incidentId: row.incidentId ?? undefined,
      timestamp: row.timestamp.toISOString(),
      source: row.source as EventSource,
      type: row.type as Event["type"],
      severity: row.severity as Event["severity"],
      message: row.message,
      payload: (row.payload as Record<string, unknown>) ?? {},
      userId: row.userId ?? undefined,
      username: row.username ?? undefined,
      resolved: row.resolved,
      resolvedAt: row.resolvedAt?.toISOString(),
      externalLink: row.externalLink ?? undefined,
      contextType: row.contextType as Event["contextType"],
      serviceTags: (row.serviceTags as string[]) ?? [],
    };
  }

  private mapDbCommentToComment(row: {
    id: string;
    eventId: string;
    userId: string;
    username: string;
    content: string;
    createdAt: Date;
    parentId: string | null;
  }): Comment {
    return {
      id: row.id,
      eventId: row.eventId,
      userId: row.userId,
      username: row.username,
      content: row.content,
      createdAt: row.createdAt.toISOString(),
      parentId: row.parentId ?? undefined,
    };
  }

  private mapDbServiceToService(row: {
    id: string;
    name: string;
    description: string;
    type: string;
    tier: string;
    health: string;
    teamId: string;
    repositoryUrl: string | null;
    documentationUrl: string | null;
    dashboardUrl: string | null;
    dependencies: unknown;
    tags: unknown;
    language: string | null;
    lastDeployedAt: Date | null;
    version: string | null;
    errorRate: number | null;
    latencyP50: number | null;
    latencyP99: number | null;
    requestsPerSecond: number | null;
    cpuUsage: number | null;
    memoryUsage: number | null;
    openIncidents: number;
    openVulnerabilities: number;
    monthlyCost: number | null;
  }): Service {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      type: row.type as ServiceType,
      tier: row.tier as Service["tier"],
      health: row.health as ServiceHealth,
      teamId: row.teamId,
      repositoryUrl: row.repositoryUrl ?? undefined,
      documentationUrl: row.documentationUrl ?? undefined,
      dashboardUrl: row.dashboardUrl ?? undefined,
      dependencies: (row.dependencies as string[]) ?? [],
      tags: (row.tags as string[]) ?? [],
      language: row.language ?? undefined,
      lastDeployedAt: row.lastDeployedAt?.toISOString(),
      version: row.version ?? undefined,
      errorRate: row.errorRate ?? undefined,
      latencyP50: row.latencyP50 ?? undefined,
      latencyP99: row.latencyP99 ?? undefined,
      requestsPerSecond: row.requestsPerSecond ?? undefined,
      cpuUsage: row.cpuUsage ?? undefined,
      memoryUsage: row.memoryUsage ?? undefined,
      openIncidents: row.openIncidents,
      openVulnerabilities: row.openVulnerabilities,
      monthlyCost: row.monthlyCost ?? undefined,
    };
  }

  private mapDbTeamToTeam(row: {
    id: string;
    name: string;
    slug: string;
    lead: string;
    slackChannel: string | null;
    oncallRotation: string | null;
  }): Team {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      lead: row.lead,
      slackChannel: row.slackChannel ?? undefined,
      oncallRotation: row.oncallRotation ?? undefined,
    };
  }
}
