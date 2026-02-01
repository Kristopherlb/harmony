// server/events/http/events-router.ts
// HTTP router for events context - parse/validate → use case → map response

import type { Request, Response } from "express";
import { Router as createRouter, type Router } from "express";
import { ActivityStreamResponseSchema, EventUpdateSchema, InsertCommentSchema } from "@shared/schema";
import { GetActivityStream } from "../application/get-activity-stream";
import type { EventRepositoryPort } from "../application/ports";
import type { IActivityRepository, ICommentRepository } from "../../storage";
import { toSharedEvent } from "../domain/mappers";

export interface EventsRouterDeps {
  eventRepository: EventRepositoryPort;
  repository: IActivityRepository & ICommentRepository;
}

export function createEventsRouter(deps: EventsRouterDeps): Router {
  const router = createRouter();

  const getActivityStream = new GetActivityStream(deps.eventRepository);

  // GET /api/activity/stream (when mounted at /api/activity)
  router.get("/activity/stream", async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = Math.min(parseInt(req.query.pageSize as string) || 50, 100);

      const result = await getActivityStream.execute({ page, pageSize });

      // Map domain events to shared/contract format
      const response = {
        events: result.events.map(toSharedEvent),
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
      };
      const validated = ActivityStreamResponseSchema.parse(response);
      return res.json(validated);
    } catch (error) {
      console.error("Error fetching activity stream:", error);
      return res.status(500).json({ error: "Failed to fetch activity stream" });
    }
  });

  // GET /api/events/stream (when mounted at /api/events)
  router.get("/stream", async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = Math.min(parseInt(req.query.pageSize as string) || 50, 100);

      const result = await getActivityStream.execute({ page, pageSize });

      // Map domain events to shared/contract format
      const response = {
        events: result.events.map(toSharedEvent),
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
      };
      const validated = ActivityStreamResponseSchema.parse(response);
      return res.json(validated);
    } catch (error) {
      console.error("Error fetching activity stream:", error);
      return res.status(500).json({ error: "Failed to fetch activity stream" });
    }
  });

  // POST /api/events/:eventId/resolve
  router.post("/:eventId/resolve", async (req: Request, res: Response) => {
    try {
      const eventId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
      const resolved = await deps.repository.resolveBlocker(eventId);
      
      if (!resolved) {
        return res.status(404).json({ error: "Event not found or not a blocker" });
      }

      return res.json(resolved);
    } catch (error) {
      console.error("Error resolving blocker:", error);
      return res.status(500).json({ error: "Failed to resolve blocker" });
    }
  });

  // PATCH /api/events/:id
  router.patch("/:id", async (req: Request, res: Response) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const parseResult = EventUpdateSchema.safeParse(req.body);

      if (!parseResult.success) {
        return res.status(400).json({
          error: "Invalid event update payload",
          details: parseResult.error.flatten(),
        });
      }

      const updates = parseResult.data;
      
      const existingEvent = await deps.repository.getEventById(id);
      if (!existingEvent) {
        return res.status(404).json({ error: "Event not found" });
      }

      const mergedPayload = updates.payload 
        ? { ...existingEvent.payload, ...updates.payload }
        : existingEvent.payload;

      const updatedEvent = await deps.repository.updateEvent(id, {
        ...updates,
        payload: mergedPayload,
        resolvedAt: updates.resolved ? new Date().toISOString() : (updates.resolvedAt ?? undefined),
      });

      return res.json(updatedEvent);
    } catch (error) {
      console.error("Error updating event:", error);
      return res.status(500).json({ error: "Failed to update event" });
    }
  });

  // GET /api/events/:eventId/comments
  router.get("/:eventId/comments", async (req: Request, res: Response) => {
    try {
      const eventId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
      const comments = await deps.repository.getCommentsByEvent(eventId);
      return res.json(comments);
    } catch (error) {
      console.error("Error fetching comments:", error);
      return res.status(500).json({ error: "Failed to fetch comments" });
    }
  });

  // POST /api/events/:eventId/comments
  router.post("/:eventId/comments", async (req: Request, res: Response) => {
    try {
      const eventId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
      const body = { ...req.body, eventId };
      const parseResult = InsertCommentSchema.safeParse(body);

      if (!parseResult.success) {
        return res.status(400).json({
          error: "Invalid comment payload",
          details: parseResult.error.flatten(),
        });
      }

      const comment = await deps.repository.createComment(parseResult.data);
      return res.status(201).json(comment);
    } catch (error) {
      console.error("Error creating comment:", error);
      return res.status(500).json({ error: "Failed to create comment" });
    }
  });

  // DELETE /api/events/comments/:id
  router.delete("/comments/:id", async (req: Request, res: Response) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const deleted = await deps.repository.deleteComment(id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Comment not found" });
      }

      return res.json({ success: true });
    } catch (error) {
      console.error("Error deleting comment:", error);
      return res.status(500).json({ error: "Failed to delete comment" });
    }
  });

  return router;
}
