import { NestFactory } from '@nestjs/core';
import 'dotenv/config';
import 'reflect-metadata';
import { AppModule } from './app.module.js';

// Worker-only entrypoint.
//
// This boots the same Nest app but without an HTTP server. We just create the
// application context, which is enough to start the BullMQ OcrProcessor and the
// scheduled jobs. Use this when you want the OCR work to run in its own
// container instead of inside the API process.
//
// Heads up: the OcrProcessor also runs inside the API app for the single-process
// setup we have now. If you run this worker and the API at the same time, both
// pull from the same queue and each job gets processed twice. So for now run
// either the API (which already does the OCR work) or this worker, not both.
// Splitting them properly is tracked as deviation D2.
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  app.enableShutdownHooks();
  console.log('PantryAI worker running (OCR queue + scheduled jobs, no HTTP)');
}

void bootstrap();
