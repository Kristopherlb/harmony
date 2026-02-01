import type { PrepItem } from "./types";

/**
 * Calculate programmatic at-risk status based on deadlines
 */
export function calculateAtRisk(item: Omit<PrepItem, "resolver">): boolean {
  if (item.completed) return false;
  if (item.manualAtRisk) return true; // Manual override takes precedence
  
  if (item.deadline) {
    const now = new Date();
    const daysUntilDeadline = (item.deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    // Mark as at-risk if less than 1 day remaining
    return daysUntilDeadline < 1;
  }
  
  return false;
}

/**
 * Get readiness score color class based on percentage
 */
export function getReadinessColor(score: number): string {
  if (score >= 90) return "text-status-healthy";
  if (score >= 75) return "text-primary";
  if (score >= 60) return "text-status-degraded";
  return "text-status-critical";
}

/**
 * Get readiness score label based on percentage
 */
export function getReadinessLabel(score: number): string {
  if (score >= 90) return "Ready";
  if (score >= 75) return "Almost Ready";
  if (score >= 60) return "Needs Work";
  return "Not Ready";
}

/**
 * Calculate readiness score from prep items completion
 */
export function calculateReadinessScore(prepItems: PrepItem[]): number {
  const completedCount = prepItems.filter(item => item.completed).length;
  const totalCount = prepItems.length;
  return totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 100;
}

/**
 * Calculate combined readiness score from Jira items and prep items
 */
export function calculateCombinedReadinessScore(
  openJiraCount: number,
  prepCompleted: number,
  prepTotal: number
): number {
  const maxJiraItems = 10; // Normalize to 0-100 scale
  const jiraScore = Math.max(0, 100 - (openJiraCount / maxJiraItems) * 50);
  const prepScore = prepTotal > 0 ? (prepCompleted / prepTotal) * 100 : 100;
  
  // Combined: 60% prep, 40% open items
  return Math.round((prepScore * 0.6) + (jiraScore * 0.4));
}

/**
 * Get risk score color class (for epic risk scores)
 */
export function getRiskColor(riskScore: number): string {
  if (riskScore >= 70) return "text-status-critical";
  if (riskScore >= 50) return "text-status-degraded";
  if (riskScore >= 30) return "text-primary";
  return "text-status-healthy";
}

/**
 * Get risk status for StatusPill component
 */
export function getRiskStatus(riskScore: number): "healthy" | "degraded" | "critical" {
  if (riskScore >= 70) return "critical";
  if (riskScore >= 50) return "degraded";
  return "healthy";
}
