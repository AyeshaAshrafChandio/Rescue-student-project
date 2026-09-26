import 'dotenv/config';
import path from 'path';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import * as schema from './schema.ts';

const { Pool } = pg;

declare global {
  var _neonPostgresPool: pg.Pool | undefined;
  var _neonDrizzleDb: NodePgDatabase<typeof schema> | undefined;
  var _neonMigrated: boolean | undefined;
  var _neonMigrationPromise: Promise<void> | undefined;
  var _neonConnectionUrl: string | undefined;
}

export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      'DATABASE_URL environment variable is missing. Please set DATABASE_URL to your Neon PostgreSQL connection string.'
    );
  }
  try {
    const parsed = new URL(url);
    const sslMode = parsed.searchParams.get('sslmode');
    if (
      (sslMode === 'require' || sslMode === 'prefer' || sslMode === 'verify-ca') &&
      !parsed.searchParams.has('uselibpqcompat')
    ) {
      parsed.searchParams.set('uselibpqcompat', 'true');
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

export const createPool = (): pg.Pool => {
  const connectionString = getDatabaseUrl();

  // Recreate pool if DATABASE_URL changed
  if (global._neonPostgresPool && global._neonConnectionUrl !== connectionString) {
    global._neonPostgresPool.end().catch(() => {});
    global._neonPostgresPool = undefined;
    global._neonDrizzleDb = undefined;
    global._neonMigrated = false;
    global._neonMigrationPromise = undefined;
  }

  if (!global._neonPostgresPool) {
    global._neonConnectionUrl = connectionString;
    global._neonPostgresPool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000,
    });

    global._neonPostgresPool.on('error', (err) => {
      console.error('Unexpected error on Neon PostgreSQL pool client:', err);
    });
  }

  return global._neonPostgresPool;
};

export async function getDb(): Promise<NodePgDatabase<typeof schema>> {
  const pool = createPool();

  if (!global._neonDrizzleDb) {
    global._neonDrizzleDb = drizzle(pool, { schema });
  }

  if (!global._neonMigrated) {
    if (!global._neonMigrationPromise) {
      const migrationsFolder = path.resolve(process.cwd(), 'drizzle');
      global._neonMigrationPromise = migrate(global._neonDrizzleDb, { migrationsFolder })
        .then(() => {
          global._neonMigrated = true;
        })
        .catch((err) => {
          global._neonMigrationPromise = undefined;
          throw err;
        });
    }
    await global._neonMigrationPromise;
  }

  return global._neonDrizzleDb;
}

export async function testNeonConnection(): Promise<{
  connected: boolean;
  database: string;
  user: string;
  version: string;
  tables: string[];
}> {
  const db = await getDb();
  const pool = createPool();

  const metaRes = await pool.query(
    `SELECT current_database() AS database, current_user AS user, version() AS version`
  );
  const tablesRes = await pool.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
  );

  // Verify Drizzle ORM query execution on schema
  await db.select().from(schema.users).limit(1);

  return {
    connected: true,
    database: metaRes.rows[0]?.database || 'neondb',
    user: metaRes.rows[0]?.user || 'neon',
    version: metaRes.rows[0]?.version || 'PostgreSQL',
    tables: tablesRes.rows.map((r: any) => r.table_name),
  };
}
