import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@shared/db-schema";

let pool: Pool | null = null;
let dbInstance: ReturnType<typeof drizzle> | null = null;

/**
 * Get or create the Drizzle database instance.
 * Uses connection pooling via pg Pool.
 */
export function getDb() {
  if (!dbInstance) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL environment variable is required");
    }
    
    pool = new Pool({ connectionString: databaseUrl });
    dbInstance = drizzle(pool, { schema });
  }
  return dbInstance;
}

/**
 * Close the database connection pool.
 * Useful for cleanup in tests or graceful shutdown.
 */
export async function closeDb() {
  if (pool) {
    await pool.end();
    pool = null;
    dbInstance = null;
  }
}
