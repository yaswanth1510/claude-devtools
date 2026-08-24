/**
 * SSE (Server-Sent Events) route for real-time event streaming.
 *
 * Routes:
 * - GET /api/events: SSE stream with keep-alive pings
 */

import { getErrorMessage } from '@shared/utils/errorHandling';
import { createLogger } from '@shared/utils/logger';

import type { FastifyInstance, FastifyReply } from 'fastify';

const logger = createLogger('HTTP:events');

const KEEPALIVE_INTERVAL_MS = 30_000;

/** All connected SSE clients */
const clients = new Set<FastifyReply>();

/**
 * Registers the SSE events endpoint.
 */
export function registerEventRoutes(app: FastifyInstance): void {
  app.get('/api/events', async (request, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    clients.add(reply);
    logger.info(`SSE client connected (total: ${clients.size})`);

    // Keep-alive ping. A write error means the socket is gone before the 'close'
    // event fired, so drop the client instead of throwing from the timer.
    const timer = setInterval(() => {
      try {
        reply.raw.write(':ping\n\n');
      } catch (error) {
        logger.warn(`SSE keep-alive failed, dropping client: ${getErrorMessage(error)}`);
        clearInterval(timer);
        clients.delete(reply);
      }
    }, KEEPALIVE_INTERVAL_MS);

    // Cleanup on disconnect
    request.raw.on('close', () => {
      clearInterval(timer);
      clients.delete(reply);
      logger.info(`SSE client disconnected (total: ${clients.size})`);
    });

    // Prevent Fastify from ending the response
    await reply;
  });
}

/**
 * Broadcasts an event to all connected SSE clients.
 */
export function broadcastEvent(channel: string, data: unknown): void {
  const payload = `event: ${channel}\ndata: ${JSON.stringify(data)}\n\n`;

  for (const client of clients) {
    try {
      client.raw.write(payload);
    } catch (error) {
      // Client is gone (or its socket errored): drop it from the broadcast set.
      logger.warn(
        `Dropping SSE client after failed write on channel "${channel}": ${getErrorMessage(error)}`
      );
      clients.delete(client);
    }
  }
}
