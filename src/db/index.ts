import fs from 'fs';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from './schema.ts';
import path from 'path';

declare global {
  var _pgliteInstance: PGlite | undefined;
  var _drizzleDb: any | undefined;
}

// Persist data in a dedicated directory in the container
const DB_DIR = path.resolve(process.cwd(), '.postgres_data');

export async function getDb() {
  if (!global._drizzleDb) {
    if (!global._pgliteInstance) {
      // Clear any stale postmaster.pid left over from ungraceful container termination
      const pidFile = path.join(DB_DIR, 'postmaster.pid');
      if (fs.existsSync(pidFile)) {
        try {
          fs.unlinkSync(pidFile);
        } catch {}
      }

      global._pgliteInstance = new PGlite(DB_DIR);
      await global._pgliteInstance.waitReady;
    }

    // Auto-bootstrap schema tables in PostgreSQL
    await global._pgliteInstance.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        uid TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL,
        display_name TEXT,
        photo_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        source_type TEXT NOT NULL,
        repo_url TEXT,
        github_branch TEXT,
        requirements_text TEXT,
        target_tech_stack TEXT,
        deadline TEXT,
        health_score INTEGER DEFAULT 0 NOT NULL,
        progress_percent INTEGER DEFAULT 0 NOT NULL,
        status TEXT DEFAULT 'created' NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS project_files (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        file_path TEXT NOT NULL,
        content TEXT NOT NULL,
        size INTEGER DEFAULT 0 NOT NULL,
        language TEXT,
        is_modified BOOLEAN DEFAULT FALSE NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS analysis_reports (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        tech_detected TEXT NOT NULL,
        requirements_summary TEXT,
        health_score INTEGER NOT NULL,
        overall_summary TEXT NOT NULL,
        features_done_json TEXT NOT NULL,
        features_broken_json TEXT NOT NULL,
        features_missing_json TEXT NOT NULL,
        features_unverifiable_json TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS rescue_tasks (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        task_order INTEGER NOT NULL,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        priority TEXT NOT NULL,
        status TEXT DEFAULT 'pending' NOT NULL,
        description TEXT NOT NULL,
        target_files_json TEXT,
        estimated_minutes INTEGER DEFAULT 15 NOT NULL,
        test_command TEXT NOT NULL,
        root_cause_analysis TEXT,
        proposed_changes_json TEXT,
        verification_output TEXT,
        is_verified BOOLEAN DEFAULT FALSE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS verification_runs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        task_id TEXT NOT NULL,
        status TEXT NOT NULL,
        passed_checks_json TEXT,
        failed_checks_json TEXT,
        stdout TEXT,
        stderr TEXT,
        duration_ms INTEGER DEFAULT 0 NOT NULL,
        checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL,
        action TEXT NOT NULL,
        details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);

    global._drizzleDb = drizzle(global._pgliteInstance, { schema });
  }

  return global._drizzleDb;
}
