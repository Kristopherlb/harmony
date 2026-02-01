// server/security/adapters/security-adapter-adapter.ts
// Adapter: Adapts getSecurityAdapter function to SecurityAdapterPort

import type { SecurityAdapterPort } from "../application/ports";
import type { SecurityTool } from "@shared/schema";

export class SecurityAdapterAdapter implements SecurityAdapterPort {
  constructor(
    private getSecurityAdapter: (tool: SecurityTool) => {
      transformToFinding: (payload: unknown) => {
        title: string;
        status: string;
        severity: string;
        tool: string;
        asset: string;
        detectedAt: string;
      } | null;
    },
    private currentTool: SecurityTool
  ) {}

  transformToFinding(payload: unknown): {
    title: string;
    status: string;
    severity: string;
    tool: string;
    asset: string;
    detectedAt: string;
  } | null {
    const adapter = this.getSecurityAdapter(this.currentTool);
    return adapter.transformToFinding(payload);
  }
}
