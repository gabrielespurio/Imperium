"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.routes = routes;
const client_1 = require("@prisma/client");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const promises_1 = require("stream/promises");
// Lazy Prisma initialization — only connects on first DB query
let _prisma = null;
function db() {
    if (!_prisma) {
        try {
            const { PrismaNeon } = require('@prisma/adapter-neon');
            const connectionString = process.env.DATABASE_URL;
            if (!connectionString)
                throw new Error('DATABASE_URL not set');
            const adapter = new PrismaNeon({ connectionString });
            _prisma = new client_1.PrismaClient({ adapter });
            console.log('Prisma initialized with Neon adapter');
        }
        catch (err) {
            console.error('Neon adapter failed, using default PrismaClient:', err);
            _prisma = new client_1.PrismaClient();
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
async function routes(app) {
    // --- HEALTH CHECK ---
    app.get('/', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));
    // --- AUTH ---
    app.post('/api/login', async (request, reply) => {
        const { email: rawEmail, password } = request.body;
        const email = String(rawEmail || '').trim().toLowerCase();
        console.log(`Login attempt: ${email}`);
        const user = USERS.find((u) => u.email.toLowerCase() === email && u.password === String(password || '').trim());
        if (!user) {
            console.log(`Login failed for: ${email}`);
            return reply.status(401).send({ error: 'Invalid credentials' });
        }
        console.log(`Login successful for: ${email} (${user.role})`);
        const token = jsonwebtoken_1.default.sign({ role: user.role, email: user.email }, JWT_SECRET, { expiresIn: '12h' });
        return { token, role: user.role };
    });
    // --- UPLOAD ---
    app.post('/api/upload', async (request, reply) => {
        const data = await request.file();
        if (!data)
            return reply.status(400).send({ error: 'No file uploaded' });
        const filename = `${Date.now()}-${data.filename}`;
        const filepath = path_1.default.join(process.cwd(), 'uploads', filename);
        await (0, promises_1.pipeline)(data.file, fs_1.default.createWriteStream(filepath));
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
        const data = request.body;
        return db().categoria.create({ data });
    });
    app.put('/api/categorias/:id', async (request) => {
        const { id } = request.params;
        const data = request.body;
        return db().categoria.update({ where: { id }, data });
    });
    app.delete('/api/categorias/:id', async (request) => {
        const { id } = request.params;
        return db().categoria.delete({ where: { id } });
    });
    // --- PERFUMES ---
    app.get('/api/perfumes', async () => db().perfume.findMany({ include: { categoria: true } }));
    app.post('/api/perfumes', async (request) => {
        // Remove nested relation object; keep only scalar fields
        const { categoria, ...data } = request.body;
        return db().perfume.create({ data });
    });
    app.put('/api/perfumes/:id', async (request) => {
        const { id } = request.params;
        const { categoria, ...data } = request.body;
        return db().perfume.update({ where: { id }, data });
    });
    app.delete('/api/perfumes/:id', async (request) => {
        const { id } = request.params;
        return db().perfume.delete({ where: { id } });
    });
    // --- BANNERS ---
    app.get('/api/banners', async () => db().banner.findMany());
    app.post('/api/banners', async (request) => {
        const data = request.body;
        return db().banner.create({ data });
    });
    app.put('/api/banners/:id', async (request) => {
        const { id } = request.params;
        const data = request.body;
        return db().banner.update({ where: { id }, data });
    });
    app.delete('/api/banners/:id', async (request) => {
        const { id } = request.params;
        return db().banner.delete({ where: { id } });
    });
    // --- PEDIDOS ---
    app.get('/api/pedidos', async () => db().pedido.findMany({ orderBy: { created_at: 'desc' } }));
    app.post('/api/pedidos', async (request) => {
        const data = request.body;
        return db().pedido.create({ data });
    });
}
