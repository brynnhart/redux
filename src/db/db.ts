import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const dataDir = path.resolve(process.cwd(), 'data');
const dbPath = path.join(dataDir, 'lord.sqlite');

let dbInstance: Database.Database | null = null;

export function getDb() {
  if (!dbInstance) {
    fs.mkdirSync(dataDir, { recursive: true });
    dbInstance = new Database(dbPath);
    dbInstance.pragma('journal_mode = WAL');
  }

  return dbInstance;
}

export function getDbPath() {
  return dbPath;
}
