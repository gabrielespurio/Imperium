import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { routes } from './routes';
import path from 'path';
import fs from 'fs';

const app = Fastify({ logger: true });

app.register(cors, { origin: true });

app.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  }
});

// Setup static file serving for uploads manually or use fastify-static
app.register(import('@fastify/static'), {
  root: path.join(__dirname, '..', 'uploads'),
  prefix: '/uploads/',
});

app.register(routes);

const start = async () => {
  try {
    const uploadDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    await app.listen({ port: Number(process.env.PORT) || 3333, host: '0.0.0.0' });
    console.log(`Server running on http://localhost:${process.env.PORT || 3333}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
