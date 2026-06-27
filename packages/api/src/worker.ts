import './instrument.js';
import { NestFactory } from '@nestjs/core';
import 'dotenv/config';
import 'reflect-metadata';
import { AppModule } from './app.module.js';

// Worker-only entrypoint.
//
// This boots the same Nest app but without an HTTP server. We just create the
// application context, which is enough to start the BullMQ OcrProcessor and the
// scheduled jobs. Run this in its own container so the OCR work doesn't share a
// process (and an event loop) with the API.
//
// Which process actually runs the OcrProcessor is decided by RUN_OCR_WORKER (see
// ocr.module.ts): the worker container sets it to 'true', the API container
// leaves it off. That's what keeps a job from being processed twice when both
// run against the same Redis. This is the D2 split from the deployment diagram.
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  app.enableShutdownHooks();
  console.log('PantryAI worker running (OCR queue + scheduled jobs, no HTTP)');
}

void bootstrap();
