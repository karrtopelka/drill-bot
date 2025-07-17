import crypto from 'crypto';
import path from 'path';
import sqlite3 from 'sqlite3';
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
  private db: sqlite3.Database | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
          reject(err);
          return;
        }

        this.createTables().then(resolve).catch(reject);
      });
    });
  }

  private async createTables(): Promise<void> {
    return new Promise((resolve, reject) => {
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

      this.db!.run(createTableSQL, (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  async getAllPolls(): Promise<Poll[]> {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM polls ORDER BY created_at ASC';

      this.db!.all(query, (err, rows: Poll[]) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
      });
    });
  }

  async addPoll(poll: Omit<Poll, 'id' | 'created_at' | 'hash'>): Promise<number> {
    return new Promise(async (resolve, reject) => {
      try {
        // Create hash to prevent duplicates
        const pollContent = `${poll.question}|${poll.option1}|${poll.option2}`;
        const hash = crypto.createHash('md5').update(pollContent.toLowerCase()).digest('hex');

        // Check current poll count and cleanup if needed
        await this.cleanupOldPolls();

        const query = `
          INSERT INTO polls (question, option1, option2, hash)
          VALUES (?, ?, ?, ?)
        `;

        this.db!.run(query, [poll.question, poll.option1, poll.option2, hash], function(err) {
          if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
              reject(new Error('Poll already exists'));
              return;
            }
            reject(err);
            return;
          }
          resolve(this.lastID);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  private async cleanupOldPolls(): Promise<void> {
    return new Promise((resolve, reject) => {
      // First, count current polls
      const countQuery = 'SELECT COUNT(*) as count FROM polls';

      this.db!.get(countQuery, (err, row: { count: number }) => {
        if (err) {
          reject(err);
          return;
        }

        const currentCount = row.count;
        const maxPolls = MAX_DATABASE_POLLS;

        if (currentCount >= maxPolls) {
          // Delete oldest polls to make room (keep it under maxPolls)
          const deleteCount = currentCount - maxPolls + 1;
          const deleteQuery = `
            DELETE FROM polls
            WHERE id IN (
              SELECT id FROM polls
              ORDER BY created_at ASC
              LIMIT ?
            )
          `;

          this.db!.run(deleteQuery, [deleteCount], (deleteErr) => {
            if (deleteErr) {
              reject(deleteErr);
              return;
            }
            console.log(`Cleaned up ${deleteCount} old polls. Database now has ${maxPolls - 1} polls.`);
            resolve();
          });
        } else {
          resolve();
        }
      });
    });
  }

  async pollExists(question: string, option1: string, option2: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const pollContent = `${question}|${option1}|${option2}`;
      const hash = crypto.createHash('md5').update(pollContent.toLowerCase()).digest('hex');

      const query = 'SELECT id FROM polls WHERE hash = ?';

      this.db!.get(query, [hash], (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(!!row);
      });
    });
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

export const databaseService = new DatabaseService();
