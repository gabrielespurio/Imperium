import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';

// Lazy Prisma initialization — only connects on first DB query
let _prisma: PrismaClient | null = null;
function db(): PrismaClient {
  if (!_prisma) {
    try {
      const { PrismaNeon } = require('@prisma/adapter-neon');
      const connectionString = process.env.DATABASE_URL;
      if (!connectionString) throw new Error('DATABASE_URL not set');
      const adapter = new PrismaNeon({ connectionString });
      _prisma = new PrismaClient({ adapter } as any);
      console.log('Prisma initialized with Neon adapter');
    } catch (err) {
      console.error('Neon adapter failed, using default PrismaClient:', err);
      _prisma = new PrismaClient();
    }
  }
  return _prisma;
}
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

// Hardcoded users — substitua por banco de dados para produção
const USERS = [
  { email: 'admin@imperium.com', password: 'admin123', role: 'admin' },
  { email: 'vendedor@imperium.com', password: 'venda123', role: 'vendedor' },
];

export async function routes(app: FastifyInstance) {
  // --- HEALTH CHECK ---
  app.get('/', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // --- AUTH ---
  app.post('/api/login', async (request, reply) => {
    const { email: rawEmail, password } = request.body as any;
    const email = String(rawEmail || '').trim().toLowerCase();

    console.log(`Login attempt: ${email}`);

    const user = USERS.find((u) => u.email.toLowerCase() === email && u.password === String(password || '').trim());

    if (!user) {
      console.log(`Login failed for: ${email}`);
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    console.log(`Login successful for: ${email} (${user.role})`);
    const token = jwt.sign({ role: user.role, email: user.email }, JWT_SECRET, { expiresIn: '12h' });
    return { token, role: user.role };
  });

  // --- UPLOAD ---
  app.post('/api/upload', async (request, reply) => {
    const data = await request.file();
    if (!data) return reply.status(400).send({ error: 'No file uploaded' });
    const filename = `${Date.now()}-${data.filename}`;
    const filepath = path.join(process.cwd(), 'uploads', filename);
    await pipeline(data.file, fs.createWriteStream(filepath));
    return { url: `/uploads/${filename}` };
  });

  // --- SYNC (Mobile) ---
  app.get('/api/sync', async () => {
    const perfumes = await db().perfume.findMany({ where: { ativo: true } });
    const categorias = await db().categoria.findMany();
    const banners = await db().banner.findMany({ where: { ativo: true } });
    return { perfumes, categorias, banners };
  });

  // --- CATEGORIAS ---
  app.get('/api/categorias', async () => db().categoria.findMany());
  app.post('/api/categorias', async (request) => {
    const data = request.body as any;
    return db().categoria.create({ data });
  });
  app.put('/api/categorias/:id', async (request) => {
    const { id } = request.params as any;
    const data = request.body as any;
    return db().categoria.update({ where: { id }, data });
  });
  app.delete('/api/categorias/:id', async (request) => {
    const { id } = request.params as any;
    return db().categoria.delete({ where: { id } });
  });

  // --- PERFUMES ---
  app.get('/api/perfumes', async () => db().perfume.findMany({ include: { categoria: true } }));
  app.post('/api/perfumes', async (request) => {
    // Remove nested relation object; keep only scalar fields
    const { categoria, ...data } = request.body as any;
    return db().perfume.create({ data });
  });
  app.put('/api/perfumes/:id', async (request) => {
    const { id } = request.params as any;
    const { categoria, ...data } = request.body as any;
    return db().perfume.update({ where: { id }, data });
  });
  app.delete('/api/perfumes/:id', async (request) => {
    const { id } = request.params as any;
    return db().perfume.delete({ where: { id } });
  });

  // --- BANNERS ---
  app.get('/api/banners', async () => db().banner.findMany());
  app.post('/api/banners', async (request) => {
    const data = request.body as any;
    return db().banner.create({ data });
  });
  app.put('/api/banners/:id', async (request) => {
    const { id } = request.params as any;
    const data = request.body as any;
    return db().banner.update({ where: { id }, data });
  });
  app.delete('/api/banners/:id', async (request) => {
    const { id } = request.params as any;
    return db().banner.delete({ where: { id } });
  });

  // --- PEDIDOS ---
  app.get('/api/pedidos', async () =>
    db().pedido.findMany({ orderBy: { created_at: 'desc' } })
  );
  app.post('/api/pedidos', async (request) => {
    const data = request.body as any;
    return db().pedido.create({ data });
  });
}
