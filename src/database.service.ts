import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  readonly db: DatabaseSync;
  constructor() {
    const path = process.env.APP_DB_PATH || (process.env.NODE_ENV === 'test' ? ':memory:' : resolve('data/shop.sqlite'));
    if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA foreign_keys = ON;
      PRAGMA busy_timeout = 5000;
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
        password_hash TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS carts (
        id TEXT PRIMARY KEY, quantities TEXT NOT NULL DEFAULT '{}', revision INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS guest_claims (
        cart_id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id)
      );
      CREATE TABLE IF NOT EXISTS auth_attempts (
        bucket TEXT PRIMARY KEY, attempts INTEGER NOT NULL, resets_at INTEGER NOT NULL
      );
      PRAGMA user_version = 1;
    `);
  }
  transaction<T>(action: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = action(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  onModuleDestroy() { this.db.close(); }
}
