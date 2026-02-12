/**
 * Seed script for creating the initial admin account.
 * Run: npx tsx scripts/seed-admin.ts
 */

import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'pos.db');

async function seedAdmin() {
  const db = new Database(DB_PATH);

  // Create admins table if not exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id TEXT PRIMARY KEY NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'support',
      created_at INTEGER NOT NULL
    );
  `);

  const email = 'admin@onekey.pos';
  const password = 'admin123';
  const name = 'Super Admin';

  // Check if admin already exists
  const existing = db.prepare('SELECT id FROM admins WHERE email = ?').get(email);
  if (existing) {
    console.log(`Admin ${email} already exists, skipping.`);
    db.close();
    return;
  }

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(password, salt);
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  db.prepare('INSERT INTO admins (id, email, password_hash, name, role, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, email, passwordHash, name, 'super_admin', now);

  console.log('Admin account created:');
  console.log(`   Email: ${email}`);
  console.log(`   Password: ${password}`);
  console.log(`   Warning: Please change the password after first login!`);

  db.close();
}

seedAdmin().catch(console.error);
