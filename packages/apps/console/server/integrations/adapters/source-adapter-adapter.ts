// server/integrations/adapters/source-adapter-adapter.ts
// Adapter: Adapts SourceAdapter to SourceAdapterPort

import type { SourceAdapter } from "../../adapters";
import type { SourceAdapterPort } from "../application/ports";
import type { InsertEvent } from "@shared/schema";

export class SourceAdapterAdapter implements SourceAdapterPort {
  constructor(private adapter: SourceAdapter) {}

  transformToEvent(payload: unknown): InsertEvent {
    return this.adapter.transformToEvent(payload);
  }
}
