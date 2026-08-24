/**
 * HttpServer - Fastify-based HTTP server for serving the renderer UI and API routes.
 *
 * Binds to 127.0.0.1 only for localhost security.
 * Dynamically allocates a port starting from 3456.
 * In production, serves static files from the renderer output directory.
 * In development, Vite dev server handles static files.
 */

import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { type HttpServices, registerHttpRoutes } from '@main/http';
import { broadcastEvent } from '@main/http/events';
import { DEV_SERVER_PORT } from '@shared/constants';
import { createLogger } from '@shared/utils/logger';
import { randomBytes } from 'crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import { existsSync } from 'fs';
import { join } from 'path';

import { getBearerTokens, isValidBearerToken, isValidHostHeader } from './HttpServerSecurity';

const logger = createLogger('Service:HttpServer');

export class HttpServer {
  private app: FastifyInstance | null = null;
  private port: number = 3456;
  private running: boolean = false;
  private token: string | null = null;

  /**
   * Start the HTTP server.
   * @param services - Service instances to pass to route handlers
   * @param sshModeSwitchCallback - Callback for SSH mode switching
   * @param preferredPort - Port to try first (default 3456)
   */
  async start(
    services: HttpServices,
    sshModeSwitchCallback: (mode: 'local' | 'ssh') => Promise<void>,
    preferredPort: number = 3456
  ): Promise<number> {
    this.token = randomBytes(32).toString('hex');
    this.app = Fastify({ logger: false });

    this.app.addHook('onRequest', async (request, reply) => {
      if (!isValidHostHeader(request.headers.host, this.port)) {
        return reply.status(403).send({ error: 'Invalid Host header' });
      }
    });

    this.app.addHook('onRequest', async (request, reply) => {
      if (request.method === 'OPTIONS' || !request.url.startsWith('/api/')) return;

      const providedTokens = getBearerTokens(request.headers.authorization, request.url);
      if (!this.token || !providedTokens.some((token) => isValidBearerToken(token, this.token!))) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }
    });

    await this.app.register(cors, {
      origin: (origin, cb) => {
        if (!origin) {
          cb(null, true);
          return;
        }

        const allowedOrigins = new Set([
          `http://127.0.0.1:${this.port}`,
          `http://localhost:${this.port}`,
        ]);
        if (process.env.NODE_ENV === 'development') {
          allowedOrigins.add(`http://localhost:${DEV_SERVER_PORT}`);
          allowedOrigins.add(`http://127.0.0.1:${DEV_SERVER_PORT}`);
        }

        if (allowedOrigins.has(origin)) {
          cb(null, true);
          return;
        }
        cb(new Error('Not allowed by CORS'), false);
      },
      credentials: true,
    });

    // Register static file serving (production only)
    const isDev = process.env.NODE_ENV === 'development';
    if (!isDev) {
      const rendererPathCandidates = [
        join(__dirname, '../../../out/renderer'),
        join(__dirname, '../../renderer'),
      ];
      const rendererPath =
        rendererPathCandidates.find((candidate) => existsSync(candidate)) ??
        rendererPathCandidates[0];
      await this.app.register(fastifyStatic, {
        root: rendererPath,
        prefix: '/',
        // Don't serve index.html for API routes
        wildcard: false,
      });

      // Serve index.html for all non-API routes (SPA fallback)
      this.app.setNotFoundHandler(async (request, reply) => {
        if (request.url.startsWith('/api/')) {
          return reply.status(404).send({ error: 'Not found' });
        }
        return reply.sendFile('index.html');
      });
    }

    // Register all API routes
    registerHttpRoutes(this.app, services, sshModeSwitchCallback);

    // Try ports starting from preferredPort
    for (let attempt = 0; attempt <= 10; attempt++) {
      const tryPort = preferredPort + attempt;
      try {
        await this.app.listen({ host: '127.0.0.1', port: tryPort });
        this.port = tryPort;
        this.running = true;
        logger.info(`HTTP server started on http://127.0.0.1:${tryPort}`);
        return tryPort;
      } catch (err: unknown) {
        const error = err as NodeJS.ErrnoException;
        if (error.code === 'EADDRINUSE') {
          logger.info(`Port ${tryPort} in use, trying next...`);
          continue;
        }
        throw err;
      }
    }

    throw new Error(`Could not find available port (tried ${preferredPort}-${preferredPort + 10})`);
  }

  /**
   * Stop the HTTP server gracefully.
   */
  async stop(): Promise<void> {
    if (this.app && this.running) {
      await this.app.close();
      this.running = false;
      this.app = null;
      logger.info('HTTP server stopped');
    }
    this.token = null;
  }

  /**
   * Broadcast an event to all connected SSE clients.
   */
  broadcast(channel: string, data: unknown): void {
    broadcastEvent(channel, data);
  }

  /**
   * Get the current port the server is running on.
   */
  getPort(): number {
    return this.port;
  }

  getToken(): string | null {
    return this.token;
  }

  /**
   * Check if the server is currently running.
   */
  isRunning(): boolean {
    return this.running;
  }
}
