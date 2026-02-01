import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@shared/db-schema";
import { sql } from "drizzle-orm";

/**
 * Database fixture for integration tests.
 * Provides setup and teardown utilities for test database.
 */
export class DbFixture {
  private pool: Pool;
  private db: ReturnType<typeof drizzle>;
  
  constructor(databaseUrl: string) {
    this.pool = new Pool({ connectionString: databaseUrl });
    this.db = drizzle(this.pool, { schema });
  }
  
  /**
   * Truncate all tables in correct order (respecting foreign key constraints).
   * Uses CASCADE to handle foreign key dependencies.
   */
  async truncateTables() {
    // Truncate in correct order (respecting foreign keys)
    // Comments must be truncated before events (foreign key)
    await this.db.execute(sql`TRUNCATE TABLE comments CASCADE`);
    await this.db.execute(sql`TRUNCATE TABLE events CASCADE`);
    await this.db.execute(sql`TRUNCATE TABLE services CASCADE`);
    await this.db.execute(sql`TRUNCATE TABLE teams CASCADE`);
    await this.db.execute(sql`TRUNCATE TABLE circleci_job_metrics CASCADE`);
    await this.db.execute(sql`TRUNCATE TABLE circleci_job_runs CASCADE`);
  }
  
  /**
   * Close the database connection pool.
   */
  async close() {
    await this.pool.end();
  }
  
  /**
   * Get the Drizzle database instance for direct queries if needed.
   */
  getDb() {
    return this.db;
  }
}
