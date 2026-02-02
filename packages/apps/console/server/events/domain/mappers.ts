// server/events/domain/mappers.ts
// Mappers: shared/contract DTO ↔ domain model

import type { Event as SharedEvent, Comment as SharedComment } from "@shared/schema";
import type { Event, Comment } from "./types";

/**
 * Convert shared/contract Event to domain Event
 */
export function toDomainEvent(shared: SharedEvent): Event {
  return {
    id: shared.id,
    incidentId: shared.incidentId,
    timestamp: new Date(shared.timestamp),
    source: shared.source,
    type: shared.type,
    payload: shared.payload,
    severity: shared.severity,
    userId: shared.userId,
    username: shared.username,
    message: shared.message,
    resolved: shared.resolved,
    resolvedAt: shared.resolvedAt ? new Date(shared.resolvedAt) : undefined,
    externalLink: shared.externalLink,
    contextType: shared.contextType,
    serviceTags: shared.serviceTags,
  };
}

/**
 * Convert domain Event to shared/contract Event
 */
export function toSharedEvent(domain: Event): SharedEvent {
  return {
    id: domain.id,
    incidentId: domain.incidentId,
    timestamp: domain.timestamp.toISOString(),
    source: domain.source,
    type: domain.type,
    payload: domain.payload,
    severity: domain.severity,
    userId: domain.userId,
    username: domain.username,
    message: domain.message,
    resolved: domain.resolved,
    resolvedAt: domain.resolvedAt?.toISOString(),
    externalLink: domain.externalLink,
    contextType: domain.contextType,
    serviceTags: domain.serviceTags,
  };
}

/**
 * Convert shared/contract Comment to domain Comment
 */
export function toDomainComment(shared: SharedComment): Comment {
  return {
    id: shared.id,
    eventId: shared.eventId,
    userId: shared.userId,
    username: shared.username,
    content: shared.content,
    createdAt: new Date(shared.createdAt),
  };
}

/**
 * Convert domain Comment to shared/contract Comment
 */
export function toSharedComment(domain: Comment): SharedComment {
  return {
    id: domain.id,
    eventId: domain.eventId,
    userId: domain.userId,
    username: domain.username,
    content: domain.content,
    createdAt: domain.createdAt.toISOString(),
  };
}
