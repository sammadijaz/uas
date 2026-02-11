/**
 * UAS Backend — API Tests
 *
 * Integration tests using supertest against the Express app.
 * Uses an in-memory SQLite database for isolation.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { Database } from '../src/db';
import { createApp } from '../src/app';
import { Config } from '../src/config';
import type { Application } from 'express';

// Test config — in-memory DB, fast JWT
const TEST_CONFIG: Config = {
  port: 0,
  env: 'test',
  jwtSecret: 'test-secret-key-for-testing',
  jwtExpiry: '1h',
  dbPath: '',
  corsOrigins: ['*'],
  logLevel: 'silent',
};

let app: Application;
let db: Database;

beforeAll(async () => {
  db = new Database();
  await db.init();
  const ctx = createApp(TEST_CONFIG, db);
  app = ctx.app;
});

afterAll(() => {
  db.close();
});

// ─── Helper ──────────────────────────────────────────────────

async function registerUser(username = 'testuser', email = 'test@example.com', password = 'password123') {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ username, email, password });
  return res;
}

async function loginUser(username = 'testuser', password = 'password123') {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username, password });
  return res;
}

// ─── Health ──────────────────────────────────────────────────

describe('GET /api/health', () => {
  it('should return ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.version).toBe('0.1.0');
    expect(typeof res.body.uptime).toBe('number');
  });
});

// ─── Auth ────────────────────────────────────────────────────

describe('Auth API', () => {
  it('POST /api/auth/register — should create a user', async () => {
    const res = await registerUser('auth_reg', 'auth_reg@test.com');
    expect(res.status).toBe(201);
    expect(res.body.user.username).toBe('auth_reg');
    expect(res.body.user.email).toBe('auth_reg@test.com');
    expect(res.body.token).toBeDefined();
    expect(res.body.user.password_hash).toBeUndefined(); // never exposed
  });

  it('POST /api/auth/register — should reject duplicate username', async () => {
    await registerUser('dup_user', 'dup1@test.com');
    const res = await registerUser('dup_user', 'dup2@test.com');
    expect(res.status).toBe(409);
  });

  it('POST /api/auth/register — should reject invalid input', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'ab', email: 'bad', password: 'short' });
    expect(res.status).toBe(400);
  });

  it('POST /api/auth/login — success', async () => {
    await registerUser('login_test', 'login@test.com');
    const res = await loginUser('login_test');
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.username).toBe('login_test');
  });

  it('POST /api/auth/login — wrong password', async () => {
    await registerUser('login_bad', 'loginbad@test.com');
    const res = await loginUser('login_bad', 'wrongpassword');
    expect(res.status).toBe(401);
  });

  it('POST /api/auth/login — unknown user', async () => {
    const res = await loginUser('nonexistent_user', 'whatever');
    expect(res.status).toBe(401);
  });

  it('GET /api/auth/me — authenticated', async () => {
    await registerUser('me_test', 'me@test.com');
    const login = await loginUser('me_test');
    const token = login.body.token;

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('me_test');
  });

  it('GET /api/auth/me — no token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('GET /api/auth/me — invalid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid-token');
    expect(res.status).toBe(401);
  });
});

// ─── Profiles ────────────────────────────────────────────────

describe('Profiles API', () => {
  let token: string;

  beforeAll(async () => {
    await registerUser('profile_user', 'profile@test.com');
    const login = await loginUser('profile_user');
    token = login.body.token;
  });

  it('POST /api/profiles — create profile', async () => {
    const res = await request(app)
      .post('/api/profiles')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Dev Setup',
        description: 'My dev tools',
        data: { apps: [{ id: 'node', version: '22.14.0' }] },
      });

    expect(res.status).toBe(201);
    expect(res.body.profile.name).toBe('Dev Setup');
    expect(res.body.profile.data.apps).toHaveLength(1);
  });

  it('GET /api/profiles — list profiles', async () => {
    const res = await request(app)
      .get('/api/profiles')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.profiles.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/profiles/:id — get specific profile', async () => {
    const create = await request(app)
      .post('/api/profiles')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Specific Profile',
        data: { apps: [{ id: 'git' }] },
      });

    const res = await request(app)
      .get(`/api/profiles/${create.body.profile.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.profile.name).toBe('Specific Profile');
  });

  it('PUT /api/profiles/:id — update profile', async () => {
    const create = await request(app)
      .post('/api/profiles')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'To Update',
        data: { apps: [{ id: 'node' }] },
      });

    const res = await request(app)
      .put(`/api/profiles/${create.body.profile.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Name' });

    expect(res.status).toBe(200);
    expect(res.body.profile.name).toBe('Updated Name');
  });

  it('DELETE /api/profiles/:id — delete profile', async () => {
    const create = await request(app)
      .post('/api/profiles')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'To Delete',
        data: { apps: [] },
      });

    const res = await request(app)
      .delete(`/api/profiles/${create.body.profile.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(204);

    // Confirm deleted
    const get = await request(app)
      .get(`/api/profiles/${create.body.profile.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(get.status).toBe(404);
  });

  it('GET /api/profiles/:id — 404 for nonexistent', async () => {
    const res = await request(app)
      .get('/api/profiles/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/profiles');
    expect(res.status).toBe(401);
  });
});

// ─── Machines ────────────────────────────────────────────────

describe('Machines API', () => {
  let token: string;

  beforeAll(async () => {
    await registerUser('machine_user', 'machine@test.com');
    const login = await loginUser('machine_user');
    token = login.body.token;
  });

  it('POST /api/machines — register machine', async () => {
    const res = await request(app)
      .post('/api/machines')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Work PC', hostname: 'WORK-PC', os_version: '10.0.22621' });

    expect(res.status).toBe(201);
    expect(res.body.machine.name).toBe('Work PC');
  });

  it('GET /api/machines — list machines', async () => {
    const res = await request(app)
      .get('/api/machines')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.machines.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/machines/:id — get specific machine', async () => {
    const create = await request(app)
      .post('/api/machines')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Detail PC' });

    const res = await request(app)
      .get(`/api/machines/${create.body.machine.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.machine.name).toBe('Detail PC');
  });

  it('DELETE /api/machines/:id — unregister machine', async () => {
    const create = await request(app)
      .post('/api/machines')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Delete PC' });

    const res = await request(app)
      .delete(`/api/machines/${create.body.machine.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(204);
  });
});

// ─── Install History ─────────────────────────────────────────

describe('Install History API', () => {
  let token: string;
  let machineId: string;

  beforeAll(async () => {
    await registerUser('history_user', 'history@test.com');
    const login = await loginUser('history_user');
    token = login.body.token;

    const machine = await request(app)
      .post('/api/machines')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'History PC' });
    machineId = machine.body.machine.id;
  });

  it('POST /api/history — record install event', async () => {
    const res = await request(app)
      .post('/api/history')
      .set('Authorization', `Bearer ${token}`)
      .send({
        machine_id: machineId,
        app_id: 'node',
        version: '22.14.0',
        action: 'install',
        status: 'success',
      });

    expect(res.status).toBe(201);
    expect(res.body.event.app_id).toBe('node');
    expect(res.body.event.action).toBe('install');
  });

  it('GET /api/history — list history', async () => {
    const res = await request(app)
      .get('/api/history')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.events.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/history/machine/:id — filter by machine', async () => {
    const res = await request(app)
      .get(`/api/history/machine/${machineId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.events.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/history/app/:appId — filter by app', async () => {
    const res = await request(app)
      .get('/api/history/app/node')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.events.length).toBeGreaterThanOrEqual(1);
  });

  it('POST /api/history — rejects invalid machine_id', async () => {
    const res = await request(app)
      .post('/api/history')
      .set('Authorization', `Bearer ${token}`)
      .send({
        machine_id: '00000000-0000-0000-0000-000000000000',
        app_id: 'node',
        version: '22.14.0',
        action: 'install',
        status: 'success',
      });

    expect(res.status).toBe(404);
  });
});

// ─── 404 Handler ─────────────────────────────────────────────

describe('404 Handler', () => {
  it('should return 404 for unknown routes', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
  });
});
