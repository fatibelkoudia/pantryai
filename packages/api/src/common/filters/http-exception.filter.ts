import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Sentry } from '../../instrument.js';

interface ErrorEnvelope {
  success: false;
  error: { code: string; message: string };
}

/**
 * Global error filter for a shared API error shape:
 * { success: false, error: { code, message } }
 *
 * code uses HttpStatus names (ex: NOT_FOUND, BAD_REQUEST).
 * Unknown errors become 500/INTERNAL_ERROR with a generic message.
 * Real details are logged on the server only.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const response = host.switchToHttp().getResponse();

    let status: number;
    let code: string;
    let message: string;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = HttpStatus[status] ?? 'HTTP_ERROR';
      message = this.extractMessage(exception);
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      code = 'INTERNAL_ERROR';
      message = 'Internal server error';
      this.logger.error(
        exception instanceof Error ? (exception.stack ?? exception.message) : String(exception),
      );
      // Only unexpected (non-HttpException) failures go to Sentry. No-op when
      // SENTRY_DSN is unset.
      Sentry.captureException(exception);
    }

    const body: ErrorEnvelope = { success: false, error: { code, message } };
    httpAdapter.reply(response, body, status);
  }

  private extractMessage(exception: HttpException): string {
    const res = exception.getResponse();
    if (typeof res === 'string') return res;
    if (typeof res === 'object' && res !== null) {
      const detail = (res as Record<string, unknown>)['message'];
      // ValidationPipe can return message as an array.
      if (Array.isArray(detail)) return detail.map((m) => String(m)).join(', ');
      if (typeof detail === 'string') return detail;
    }
    return exception.message;
  }
}
