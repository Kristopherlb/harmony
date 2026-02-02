// server/infrastructure/seed.ts
// Seed data generation - moved from storage.ts

import { randomUUID } from "crypto";
import type {
  Event,
  Project,
  SecurityFinding,
  Team,
  Service,
  EventSource,
  EventType,
  Severity,
  SecurityTool,
  SecuritySeverity,
  SecurityStatus,
  ContextType,
} from "@shared/schema";

export interface InitialData {
  events?: Event[];
  projects?: Project[];
  securityFindings?: SecurityFinding[];
  comments?: any[];
  services?: Service[];
  teams?: Team[];
}

export function generateSeedData(): InitialData {
  const now = new Date();
  const events: Event[] = [];
  
  const sources: EventSource[] = ["slack", "gitlab", "jira", "bitbucket", "pagerduty", "circleci"];
  const types: EventType[] = ["log", "blocker", "decision", "release", "alert"];
  const severities: Severity[] = ["low", "medium", "high", "critical"];
  const users = [
    { id: "U001", name: "alice" },
    { id: "U002", name: "bob" },
    { id: "U003", name: "charlie" },
    { id: "U004", name: "diana" },
  ];

  const messagesWithTags: Record<EventType, { message: string; serviceTags: string[] }[]> = {
    log: [
      { message: "Deployed feature flag for new checkout flow", serviceTags: ["web", "checkout", "frontend"] },
      { message: "Updated API rate limits for production", serviceTags: ["api", "gateway", "rate-limiter"] },
      { message: "Migrated user sessions to Redis", serviceTags: ["redis", "sessions", "cache"] },
      { message: "Completed code review for auth module", serviceTags: ["api", "auth"] },
      { message: "Ran load tests on search service", serviceTags: ["search", "elasticsearch", "api"] },
    ],
    blocker: [
      { message: "Database connection pool exhausted", serviceTags: ["database", "postgres", "api"] },
      { message: "Payment gateway returning 503 errors", serviceTags: ["payments", "gateway", "stripe"] },
      { message: "CI pipeline failing on integration tests", serviceTags: ["ci", "pipeline", "gitlab"] },
      { message: "Memory leak in notification service", serviceTags: ["notifications", "worker", "redis"] },
      { message: "Redis cluster latency spike", serviceTags: ["redis", "cache", "sessions"] },
      { message: "Kubernetes pods OOMKilled", serviceTags: ["kubernetes", "api", "gateway"] },
    ],
    decision: [
      { message: "ADR-042: Adopt GraphQL for mobile API", serviceTags: ["api", "graphql", "mobile"] },
      { message: "ADR-043: Use Kubernetes for orchestration", serviceTags: ["kubernetes", "infrastructure", "devops"] },
      { message: "ADR-044: Implement event sourcing for orders", serviceTags: ["orders", "database", "events"] },
    ],
    release: [
      { message: "v2.4.0 deployed to production", serviceTags: ["api", "production", "deployment"] },
      { message: "v2.4.1 hotfix for payment bug", serviceTags: ["payments", "api", "hotfix"] },
      { message: "v2.5.0-beta released to staging", serviceTags: ["api", "staging", "deployment"] },
    ],
    alert: [
      { message: "High CPU usage on api-server-03", serviceTags: ["api", "aws", "ec2"] },
      { message: "Disk space warning on db-replica-02", serviceTags: ["database", "postgres", "aws"] },
      { message: "Elevated error rate in checkout service", serviceTags: ["checkout", "api", "payments"] },
      { message: "SSL certificate expiring in 7 days", serviceTags: ["ssl", "gateway", "infrastructure"] },
      { message: "AWS ASG scaling event triggered", serviceTags: ["aws", "asg", "infrastructure"] },
      { message: "Envoy proxy connection timeout", serviceTags: ["envoy", "gateway", "api-gateway"] },
    ],
  };

  const contextTypeMapping: Record<EventType, ContextType[]> = {
    log: ["general"],
    blocker: ["incident", "infrastructure", "support_ticket"],
    decision: ["general"],
    release: ["deployment_failure", "general"],
    alert: ["incident", "infrastructure", "security_alert"],
  };

  for (let day = 0; day < 60; day++) {
    const eventsPerDay = Math.floor(Math.random() * 8) + 2;
    
    for (let i = 0; i < eventsPerDay; i++) {
      const eventDate = new Date(now);
      eventDate.setDate(eventDate.getDate() - day);
      eventDate.setHours(Math.floor(Math.random() * 12) + 8);
      eventDate.setMinutes(Math.floor(Math.random() * 60));

      const source = sources[Math.floor(Math.random() * sources.length)];
      const type = types[Math.floor(Math.random() * types.length)];
      const severity = type === "blocker" || type === "alert" 
        ? (Math.random() > 0.5 ? "high" : "critical")
        : severities[Math.floor(Math.random() * severities.length)];
      const user = users[Math.floor(Math.random() * users.length)];
      
      const messageList = messagesWithTags[type];
      const messageData = messageList[Math.floor(Math.random() * messageList.length)];
      
      const contextTypes = contextTypeMapping[type];
      const contextType = contextTypes[Math.floor(Math.random() * contextTypes.length)];

      const isResolved = type === "blocker" && day > 2 && Math.random() > 0.3;
      const resolvedAt = isResolved 
        ? new Date(eventDate.getTime() + Math.random() * 24 * 60 * 60 * 1000).toISOString()
        : undefined;

      const payload: Record<string, unknown> = {};
      if (type === "release") {
        payload.leadTimeHours = Math.floor(Math.random() * 48) + 4;
        payload.failed = Math.random() < 0.08;
      }

      const id = randomUUID();
      const incidentId = contextType === "incident" ? id : undefined;

      events.push({
        id,
        incidentId,
        timestamp: eventDate.toISOString(),
        source,
        type,
        severity,
        message: messageData.message,
        payload,
        userId: user.id,
        username: user.name,
        resolved: isResolved,
        resolvedAt,
        contextType,
        serviceTags: messageData.serviceTags,
      });
    }
  }

  const projects: Project[] = [
    {
      id: randomUUID(),
      name: "API Gateway",
      status: "active",
      repositoryUrl: "https://github.com/org/api-gateway",
      leadTime: 18.5,
      deploymentFrequency: 2.3,
    },
    {
      id: randomUUID(),
      name: "User Service",
      status: "active",
      repositoryUrl: "https://github.com/org/user-service",
      leadTime: 24.2,
      deploymentFrequency: 1.8,
    },
    {
      id: randomUUID(),
      name: "Payment Module",
      status: "at_risk",
      repositoryUrl: "https://github.com/org/payments",
      leadTime: 72.0,
      deploymentFrequency: 0.5,
    },
  ];

  const securityTools: SecurityTool[] = ["wiz", "aws_inspector", "artifactory_xray"];
  const securitySeverities: SecuritySeverity[] = ["critical", "high", "medium", "low"];
  const securityStatuses: SecurityStatus[] = ["open", "open", "open", "resolved", "ignored"];
  
  const vulnerabilities = [
    { title: "CVE-2024-1234: Remote Code Execution", cve: "CVE-2024-1234", asset: "api-gateway:latest" },
    { title: "CVE-2024-5678: SQL Injection", cve: "CVE-2024-5678", asset: "user-service:v2.1.0" },
    { title: "CVE-2024-9012: XSS Vulnerability", cve: "CVE-2024-9012", asset: "frontend:main" },
    { title: "Outdated dependency: lodash", cve: undefined, asset: "payment-module:v1.5.2" },
    { title: "CVE-2023-4567: Buffer Overflow", cve: "CVE-2023-4567", asset: "data-pipeline:latest" },
    { title: "Insecure configuration detected", cve: undefined, asset: "k8s-cluster/prod" },
    { title: "CVE-2024-7890: Authentication Bypass", cve: "CVE-2024-7890", asset: "auth-service:v3.0.1" },
    { title: "Exposed secrets in container", cve: undefined, asset: "notification-svc:dev" },
  ];

  const securityFindings: SecurityFinding[] = [];

  for (let i = 0; i < 25; i++) {
    const findingDate = new Date(now);
    findingDate.setDate(findingDate.getDate() - Math.floor(Math.random() * 30));
    
    const vuln = vulnerabilities[Math.floor(Math.random() * vulnerabilities.length)];
    const tool = securityTools[Math.floor(Math.random() * securityTools.length)];
    const severity = securitySeverities[Math.floor(Math.random() * securitySeverities.length)];
    const status = securityStatuses[Math.floor(Math.random() * securityStatuses.length)];
    
    const resolvedAt = status === "resolved" 
      ? new Date(findingDate.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
      : undefined;

    securityFindings.push({
      id: randomUUID(),
      severity,
      tool,
      cve: vuln.cve,
      asset: vuln.asset,
      status,
      title: vuln.title,
      description: `Security finding detected by ${tool}: ${vuln.title}`,
      detectedAt: findingDate.toISOString(),
      resolvedAt,
      externalLink: vuln.cve ? `https://nvd.nist.gov/vuln/detail/${vuln.cve}` : undefined,
    });
  }

  // Teams for service catalog
  const teams: Team[] = [
    { id: "team-platform", name: "Platform Engineering", slug: "platform", lead: "alice", slackChannel: "#platform-team", oncallRotation: "platform-oncall" },
    { id: "team-payments", name: "Payments Team", slug: "payments", lead: "bob", slackChannel: "#payments-team", oncallRotation: "payments-oncall" },
    { id: "team-frontend", name: "Frontend Team", slug: "frontend", lead: "charlie", slackChannel: "#frontend-team" },
    { id: "team-data", name: "Data Engineering", slug: "data", lead: "diana", slackChannel: "#data-team", oncallRotation: "data-oncall" },
    { id: "team-sre", name: "Site Reliability", slug: "sre", lead: "alice", slackChannel: "#sre-team", oncallRotation: "sre-oncall" },
  ];

  // Services for service catalog
  const services: Service[] = [
    {
      id: "svc-api-gateway",
      name: "API Gateway",
      description: "Primary ingress point for all API traffic. Handles rate limiting, authentication, and routing.",
      type: "gateway",
      tier: "tier1",
      health: "healthy",
      teamId: "team-platform",
      repositoryUrl: "https://github.com/acme/api-gateway",
      documentationUrl: "https://docs.acme.io/api-gateway",
      dependencies: ["svc-auth", "svc-redis", "svc-user-service"],
      tags: ["api", "gateway", "kubernetes", "envoy"],
      language: "Go",
      lastDeployedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      version: "v2.4.1",
      errorRate: 0.02,
      latencyP50: 12,
      latencyP99: 89,
      requestsPerSecond: 15420,
      cpuUsage: 45,
      memoryUsage: 62,
      openIncidents: 0,
      openVulnerabilities: 1,
      monthlyCost: 4200,
    },
    {
      id: "svc-user-service",
      name: "User Service",
      description: "Handles user profile management, preferences, and account operations.",
      type: "api",
      tier: "tier1",
      health: "healthy",
      teamId: "team-platform",
      repositoryUrl: "https://github.com/acme/user-service",
      dependencies: ["svc-postgres", "svc-redis"],
      tags: ["api", "users", "postgres"],
      language: "TypeScript",
      lastDeployedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      version: "v3.2.0",
      errorRate: 0.01,
      latencyP50: 18,
      latencyP99: 124,
      requestsPerSecond: 8540,
      cpuUsage: 32,
      memoryUsage: 48,
      openIncidents: 0,
      openVulnerabilities: 2,
      monthlyCost: 2800,
    },
    {
      id: "svc-auth",
      name: "Auth Service",
      description: "Authentication and authorization service. Handles OAuth, JWT tokens, and session management.",
      type: "api",
      tier: "tier1",
      health: "degraded",
      teamId: "team-platform",
      repositoryUrl: "https://github.com/acme/auth-service",
      dependencies: ["svc-postgres", "svc-redis"],
      tags: ["api", "auth", "security", "oauth"],
      language: "TypeScript",
      lastDeployedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      version: "v4.0.2",
      errorRate: 0.08,
      latencyP50: 45,
      latencyP99: 320,
      requestsPerSecond: 12000,
      cpuUsage: 78,
      memoryUsage: 85,
      openIncidents: 1,
      openVulnerabilities: 0,
      monthlyCost: 3200,
    },
    {
      id: "svc-payment-processor",
      name: "Payment Processor",
      description: "Handles all payment transactions, integrations with Stripe and PayPal.",
      type: "api",
      tier: "tier1",
      health: "healthy",
      teamId: "team-payments",
      repositoryUrl: "https://github.com/acme/payment-processor",
      dependencies: ["svc-postgres", "svc-redis", "svc-notification-worker"],
      tags: ["api", "payments", "stripe", "pci"],
      language: "Java",
      lastDeployedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      version: "v5.1.0",
      errorRate: 0.001,
      latencyP50: 95,
      latencyP99: 450,
      requestsPerSecond: 2340,
      cpuUsage: 28,
      memoryUsage: 55,
      openIncidents: 0,
      openVulnerabilities: 0,
      monthlyCost: 5600,
    },
    {
      id: "svc-checkout",
      name: "Checkout Service",
      description: "Manages the checkout flow, cart management, and order creation.",
      type: "api",
      tier: "tier2",
      health: "critical",
      teamId: "team-payments",
      repositoryUrl: "https://github.com/acme/checkout-service",
      dependencies: ["svc-payment-processor", "svc-user-service", "svc-inventory"],
      tags: ["api", "checkout", "orders"],
      language: "TypeScript",
      lastDeployedAt: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(),
      version: "v2.8.4",
      errorRate: 2.5,
      latencyP50: 180,
      latencyP99: 2400,
      requestsPerSecond: 1890,
      cpuUsage: 92,
      memoryUsage: 88,
      openIncidents: 2,
      openVulnerabilities: 1,
      monthlyCost: 2400,
    },
    {
      id: "svc-notification-worker",
      name: "Notification Worker",
      description: "Background worker for sending emails, SMS, and push notifications.",
      type: "worker",
      tier: "tier2",
      health: "healthy",
      teamId: "team-platform",
      repositoryUrl: "https://github.com/acme/notification-worker",
      dependencies: ["svc-redis", "svc-postgres"],
      tags: ["worker", "notifications", "email", "sms"],
      language: "Python",
      lastDeployedAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      version: "v1.5.2",
      errorRate: 0.05,
      requestsPerSecond: 890,
      cpuUsage: 25,
      memoryUsage: 40,
      openIncidents: 0,
      openVulnerabilities: 1,
      monthlyCost: 1200,
    },
    {
      id: "svc-postgres",
      name: "PostgreSQL Primary",
      description: "Primary PostgreSQL database cluster with read replicas.",
      type: "database",
      tier: "tier1",
      health: "healthy",
      teamId: "team-sre",
      tags: ["database", "postgres", "rds"],
      language: "PostgreSQL",
      version: "15.4",
      cpuUsage: 55,
      memoryUsage: 72,
      openIncidents: 0,
      openVulnerabilities: 0,
      monthlyCost: 8500,
      dependencies: [],
    },
    {
      id: "svc-redis",
      name: "Redis Cluster",
      description: "Redis cluster for caching, sessions, and pub/sub.",
      type: "cache",
      tier: "tier1",
      health: "healthy",
      teamId: "team-sre",
      tags: ["cache", "redis", "sessions"],
      language: "Redis",
      version: "7.2",
      cpuUsage: 35,
      memoryUsage: 68,
      openIncidents: 0,
      openVulnerabilities: 0,
      monthlyCost: 3800,
      dependencies: [],
    },
    {
      id: "svc-frontend",
      name: "Web Frontend",
      description: "React-based web application. Served via CDN with SSR.",
      type: "frontend",
      tier: "tier1",
      health: "healthy",
      teamId: "team-frontend",
      repositoryUrl: "https://github.com/acme/web-frontend",
      dependencies: ["svc-api-gateway"],
      tags: ["frontend", "react", "cdn"],
      language: "TypeScript",
      lastDeployedAt: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(),
      version: "v4.12.0",
      errorRate: 0.1,
      requestsPerSecond: 45000,
      cpuUsage: 15,
      memoryUsage: 20,
      openIncidents: 0,
      openVulnerabilities: 3,
      monthlyCost: 1800,
    },
    {
      id: "svc-search",
      name: "Search Service",
      description: "Elasticsearch-based search service for products and content.",
      type: "api",
      tier: "tier2",
      health: "healthy",
      teamId: "team-data",
      repositoryUrl: "https://github.com/acme/search-service",
      dependencies: ["svc-elasticsearch"],
      tags: ["api", "search", "elasticsearch"],
      language: "Python",
      lastDeployedAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      version: "v2.1.0",
      errorRate: 0.02,
      latencyP50: 35,
      latencyP99: 180,
      requestsPerSecond: 5600,
      cpuUsage: 42,
      memoryUsage: 58,
      openIncidents: 0,
      openVulnerabilities: 0,
      monthlyCost: 2200,
    },
    {
      id: "svc-elasticsearch",
      name: "Elasticsearch Cluster",
      description: "Elasticsearch cluster for search indexing and analytics.",
      type: "database",
      tier: "tier2",
      health: "healthy",
      teamId: "team-data",
      tags: ["database", "elasticsearch", "search"],
      language: "Elasticsearch",
      version: "8.11",
      cpuUsage: 48,
      memoryUsage: 75,
      openIncidents: 0,
      openVulnerabilities: 0,
      monthlyCost: 4500,
      dependencies: [],
    },
    {
      id: "svc-inventory",
      name: "Inventory Service",
      description: "Manages product inventory, stock levels, and warehouse operations.",
      type: "api",
      tier: "tier2",
      health: "healthy",
      teamId: "team-payments",
      repositoryUrl: "https://github.com/acme/inventory-service",
      dependencies: ["svc-postgres", "svc-redis"],
      tags: ["api", "inventory", "warehouse"],
      language: "Go",
      lastDeployedAt: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      version: "v1.8.0",
      errorRate: 0.01,
      latencyP50: 22,
      latencyP99: 110,
      requestsPerSecond: 3200,
      cpuUsage: 30,
      memoryUsage: 45,
      openIncidents: 0,
      openVulnerabilities: 0,
      monthlyCost: 1600,
    },
    {
      id: "svc-ml-recommendations",
      name: "ML Recommendations",
      description: "Machine learning service for product recommendations.",
      type: "ml",
      tier: "tier3",
      health: "healthy",
      teamId: "team-data",
      repositoryUrl: "https://github.com/acme/ml-recommendations",
      dependencies: ["svc-postgres", "svc-elasticsearch"],
      tags: ["ml", "recommendations", "python"],
      language: "Python",
      lastDeployedAt: new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000).toISOString(),
      version: "v0.9.5",
      errorRate: 0.5,
      latencyP50: 250,
      latencyP99: 800,
      requestsPerSecond: 450,
      cpuUsage: 85,
      memoryUsage: 92,
      openIncidents: 0,
      openVulnerabilities: 0,
      monthlyCost: 6200,
    },
  ];

  return { events, projects, securityFindings, teams, services };
}
