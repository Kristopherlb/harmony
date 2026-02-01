// server/events/domain/mappers.test.ts
// Tests for event domain mappers

import { describe, it, expect } from "vitest";
import {
  toDomainEvent,
  toSharedEvent,
  toDomainComment,
  toSharedComment,
} from "./mappers";
import type { Event, Comment } from "./types";

describe("Event Mappers", () => {
  const sharedEvent = {
    id: "event-1",
    timestamp: "2024-01-01T00:00:00Z",
    source: "slack" as const,
    type: "log" as const,
    payload: { message: "Test event" },
    severity: "medium" as const,
    userId: "user-1",
    username: "testuser",
    message: "Test event occurred",
    resolved: false,
    resolvedAt: undefined,
    externalLink: "https://example.com",
    contextType: "general" as const,
    serviceTags: ["api-service"],
  };

  it("should convert shared Event to domain Event", () => {
    const domain = toDomainEvent(sharedEvent);
    expect(domain.id).toBe(sharedEvent.id);
    expect(domain.timestamp).toBeInstanceOf(Date);
    expect(domain.timestamp.getTime()).toBe(new Date(sharedEvent.timestamp).getTime());
    expect(domain.source).toBe(sharedEvent.source);
    expect(domain.type).toBe(sharedEvent.type);
  });

  it("should convert domain Event to shared Event", () => {
    const domain: Event = {
      id: "event-1",
      timestamp: new Date("2024-01-01T00:00:00Z"),
      source: "slack",
      type: "log",
      payload: { message: "Test event" },
      severity: "medium",
      userId: "user-1",
      username: "testuser",
      message: "Test event occurred",
      resolved: false,
      resolvedAt: undefined,
      externalLink: "https://example.com",
      contextType: "general",
      serviceTags: ["api-service"],
    };

    const shared = toSharedEvent(domain);
    expect(shared.id).toBe(domain.id);
    expect(shared.timestamp).toBe(domain.timestamp.toISOString());
    expect(shared.source).toBe(domain.source);
  });

  it("should round-trip Event through mappers", () => {
    const domain = toDomainEvent(sharedEvent);
    const backToShared = toSharedEvent(domain);
    expect(backToShared.id).toBe(sharedEvent.id);
    // Timestamp format may differ (Z vs .000Z), so just check it's a valid ISO string and represents the same time
    expect(backToShared.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/);
    expect(new Date(backToShared.timestamp).toISOString()).toBe(new Date(sharedEvent.timestamp).toISOString());
    expect(backToShared.source).toBe(sharedEvent.source);
  });

  it("should handle optional fields correctly", () => {
    const eventWithoutOptionals = {
      ...sharedEvent,
      userId: undefined,
      username: undefined,
      resolvedAt: undefined,
      externalLink: undefined,
    };

    const domain = toDomainEvent(eventWithoutOptionals);
    expect(domain.userId).toBeUndefined();
    expect(domain.username).toBeUndefined();
    expect(domain.resolvedAt).toBeUndefined();
    expect(domain.externalLink).toBeUndefined();
  });
});

describe("Comment Mappers", () => {
  const sharedComment = {
    id: "comment-1",
    eventId: "event-1",
    userId: "user-1",
    username: "testuser",
    content: "This is a test comment",
    createdAt: "2024-01-01T00:00:00Z",
  };

  it("should convert shared Comment to domain Comment", () => {
    const domain = toDomainComment(sharedComment);
    expect(domain.id).toBe(sharedComment.id);
    expect(domain.createdAt).toBeInstanceOf(Date);
    expect(domain.createdAt.getTime()).toBe(new Date(sharedComment.createdAt).getTime());
  });

  it("should convert domain Comment to shared Comment", () => {
    const domain: Comment = {
      id: "comment-1",
      eventId: "event-1",
      userId: "user-1",
      username: "testuser",
      content: "This is a test comment",
      createdAt: new Date("2024-01-01T00:00:00Z"),
    };

    const shared = toSharedComment(domain);
    expect(shared.id).toBe(domain.id);
    expect(shared.createdAt).toBe(domain.createdAt.toISOString());
  });

  it("should round-trip Comment through mappers", () => {
    const domain = toDomainComment(sharedComment);
    const backToShared = toSharedComment(domain);
    expect(backToShared.id).toBe(sharedComment.id);
    expect(new Date(backToShared.createdAt).getTime()).toBe(new Date(sharedComment.createdAt).getTime());
    expect(backToShared.content).toBe(sharedComment.content);
  });
});
