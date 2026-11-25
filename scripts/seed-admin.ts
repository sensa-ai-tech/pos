/**
 * Seed script for creating the initial admin account.
 * Run: SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_PASSWORD=... npx tsx scripts/seed-admin.ts
 * If SEED_ADMIN_PASSWORD is omitted, a random password is generated and printed once.
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

  const email = process.env.SEED_ADMIN_EMAIL?.trim();
  if (!email) {
    console.error('SEED_ADMIN_EMAIL is required.');
    process.exitCode = 1;
    db.close();
    return;
  }
  const providedPassword = process.env.SEED_ADMIN_PASSWORD;
  if (providedPassword !== undefined && providedPassword.length < 12) {
    console.error('SEED_ADMIN_PASSWORD must be at least 12 characters.');
    process.exitCode = 1;
    db.close();
    return;
  }
  const password = providedPassword ?? crypto.randomBytes(18).toString('base64url');
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
  if (providedPassword === undefined) {
    // Printed once only; it is not stored anywhere in plain text.
    console.log(`   Generated password: ${password}`);
    console.log('   Store it in a password manager now; it will not be shown again.');
  } else {
    console.log('   Password: (from SEED_ADMIN_PASSWORD)');
  }

  db.close();
}

seedAdmin().catch(console.error);
