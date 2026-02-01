// server/sql/adapters/sql-runner-adapter.ts
// Adapter: Adapts ISqlRunner to SqlRunnerPort

import type { ISqlRunner } from "../../sql-runner";
import type { SqlRunnerPort } from "../application/ports";
import type { QueryExecutionRequest, UserRole } from "@shared/schema";

export class SqlRunnerAdapter implements SqlRunnerPort {
  constructor(private sqlRunner: ISqlRunner) {}

  async executeQuery(
    request: QueryExecutionRequest,
    userId: string,
    username: string,
    role: UserRole
  ) {
    return this.sqlRunner.executeQuery(request, userId, username, role);
  }
}
