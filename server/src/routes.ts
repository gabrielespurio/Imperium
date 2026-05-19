import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter } as any);
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

// Hardcoded users — substitua por banco de dados para produção
const USERS = [
  { email: 'admin@imperium.com', password: 'admin123', role: 'admin' },
  { email: 'vendedor@imperium.com', password: 'venda123', role: 'vendedor' },
];

export async function routes(app: FastifyInstance) {
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
    const perfumes = await prisma.perfume.findMany({ where: { ativo: true } });
    const categorias = await prisma.categoria.findMany();
    const banners = await prisma.banner.findMany({ where: { ativo: true } });
    return { perfumes, categorias, banners };
  });

  // --- CATEGORIAS ---
  app.get('/api/categorias', async () => prisma.categoria.findMany());
  app.post('/api/categorias', async (request) => {
    const data = request.body as any;
    return prisma.categoria.create({ data });
  });
  app.put('/api/categorias/:id', async (request) => {
    const { id } = request.params as any;
    const data = request.body as any;
    return prisma.categoria.update({ where: { id }, data });
  });
  app.delete('/api/categorias/:id', async (request) => {
    const { id } = request.params as any;
    return prisma.categoria.delete({ where: { id } });
  });

  // --- PERFUMES ---
  app.get('/api/perfumes', async () => prisma.perfume.findMany({ include: { categoria: true } }));
  app.post('/api/perfumes', async (request) => {
    // Remove nested relation object; keep only scalar fields
    const { categoria, ...data } = request.body as any;
    return prisma.perfume.create({ data });
  });
  app.put('/api/perfumes/:id', async (request) => {
    const { id } = request.params as any;
    const { categoria, ...data } = request.body as any;
    return prisma.perfume.update({ where: { id }, data });
  });
  app.delete('/api/perfumes/:id', async (request) => {
    const { id } = request.params as any;
    return prisma.perfume.delete({ where: { id } });
  });

  // --- BANNERS ---
  app.get('/api/banners', async () => prisma.banner.findMany());
  app.post('/api/banners', async (request) => {
    const data = request.body as any;
    return prisma.banner.create({ data });
  });
  app.put('/api/banners/:id', async (request) => {
    const { id } = request.params as any;
    const data = request.body as any;
    return prisma.banner.update({ where: { id }, data });
  });
  app.delete('/api/banners/:id', async (request) => {
    const { id } = request.params as any;
    return prisma.banner.delete({ where: { id } });
  });

  // --- PEDIDOS ---
  app.get('/api/pedidos', async () =>
    prisma.pedido.findMany({ orderBy: { created_at: 'desc' } })
  );
  app.post('/api/pedidos', async (request) => {
    const data = request.body as any;
    return prisma.pedido.create({ data });
  });
}
