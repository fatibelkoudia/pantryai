import { getQueueToken } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { FastifyAdapter as BullBoardFastifyAdapter } from '@bull-board/fastify';
import type { Queue } from 'bullmq';

const BASE_PATH = '/admin/queues';

// Mounts the BullMQ dashboard at /admin/queues so we can see the OCR queue
// (waiting/active/failed jobs, retries) in production.
//
// It's only mounted when BOTH BULLBOARD_USER and BULLBOARD_PASSWORD are set, and
// it sits behind HTTP basic auth. With no creds it isn't mounted at all, so the
// queue internals are never exposed by accident.
export async function setupBullBoard(app: NestFastifyApplication): Promise<void> {
  const logger = new Logger('BullBoard');
  const user = process.env['BULLBOARD_USER'];
  const password = process.env['BULLBOARD_PASSWORD'];

  if (!user || !password) {
    logger.log('BULLBOARD_USER/PASSWORD not set, dashboard disabled');
    return;
  }

  const ocrQueue = app.get<Queue>(getQueueToken('ocr'));

  const serverAdapter = new BullBoardFastifyAdapter();
  serverAdapter.setBasePath(BASE_PATH);
  createBullBoard({ queues: [new BullMQAdapter(ocrQueue)], serverAdapter });

  const fastify = app.getHttpAdapter().getInstance();
  const expected = 'Basic ' + Buffer.from(`${user}:${password}`).toString('base64');

  // Guard everything under the dashboard base path with basic auth.
  fastify.addHook('onRequest', (request, reply, done) => {
    if (!request.url.startsWith(BASE_PATH)) {
      done();
      return;
    }
    if (request.headers.authorization === expected) {
      done();
      return;
    }
    reply
      .header('WWW-Authenticate', 'Basic realm="PantryAI queues"')
      .code(401)
      .send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await app.register(serverAdapter.registerPlugin() as any, {
    basePath: BASE_PATH,
    prefix: BASE_PATH,
  });

  logger.log(`BullMQ dashboard at ${BASE_PATH}`);
}
