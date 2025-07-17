import Database from 'better-sqlite3';
import crypto from 'crypto';
import path from 'path';
import { MAX_DATABASE_POLLS } from '../constants';

const DB_PATH = path.join(process.cwd(), 'data', 'polls.db');

export interface Poll {
  id?: number;
  question: string;
  option1: string;
  option2: string;
  created_at?: string;
  hash?: string;
}

class DatabaseService {
  private db: Database.Database | null = null;

  async init(): Promise<void> {
    try {
      // Ensure data directory exists
      const fs = require('fs');
      const dataDir = path.dirname(DB_PATH);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      this.db = new Database(DB_PATH);
      this.createTables();
    } catch (error) {
      throw error;
    }
  }

  private createTables(): void {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS polls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question TEXT NOT NULL,
        option1 TEXT NOT NULL,
        option2 TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        hash TEXT UNIQUE NOT NULL
      )
    `;

    this.db!.exec(createTableSQL);
  }

  async getAllPolls(): Promise<Poll[]> {
    const stmt = this.db!.prepare('SELECT * FROM polls ORDER BY created_at ASC');
    return stmt.all() as Poll[];
  }

  async addPoll(poll: Omit<Poll, 'id' | 'created_at' | 'hash'>): Promise<number> {
    // Create hash to prevent duplicates
    const pollContent = `${poll.question}|${poll.option1}|${poll.option2}`;
    const hash = crypto.createHash('md5').update(pollContent.toLowerCase()).digest('hex');

    // Check current poll count and cleanup if needed
    await this.cleanupOldPolls();

    const stmt = this.db!.prepare(`
      INSERT INTO polls (question, option1, option2, hash)
      VALUES (?, ?, ?, ?)
    `);

    try {
      const result = stmt.run(poll.question, poll.option1, poll.option2, hash);
      return result.lastInsertRowid as number;
    } catch (error: any) {
      if (error.message.includes('UNIQUE constraint failed')) {
        throw new Error('Poll already exists');
      }
      throw error;
    }
  }

  private async cleanupOldPolls(): Promise<void> {
    // First, count current polls
    const countStmt = this.db!.prepare('SELECT COUNT(*) as count FROM polls');
    const row = countStmt.get() as { count: number };

    const currentCount = row.count;
    const maxPolls = MAX_DATABASE_POLLS;

    if (currentCount >= maxPolls) {
      // Delete oldest polls to make room (keep it under maxPolls)
      const deleteCount = currentCount - maxPolls + 1;
      const deleteStmt = this.db!.prepare(`
        DELETE FROM polls
        WHERE id IN (
          SELECT id FROM polls
          ORDER BY created_at ASC
          LIMIT ?
        )
      `);

      deleteStmt.run(deleteCount);
      console.log(`Cleaned up ${deleteCount} old polls. Database now has ${maxPolls - 1} polls.`);
    }
  }

  async pollExists(question: string, option1: string, option2: string): Promise<boolean> {
    const pollContent = `${question}|${option1}|${option2}`;
    const hash = crypto.createHash('md5').update(pollContent.toLowerCase()).digest('hex');

    const stmt = this.db!.prepare('SELECT id FROM polls WHERE hash = ?');
    const row = stmt.get(hash);

    return !!row;
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
    }
  }
}

export const databaseService = new DatabaseService();
