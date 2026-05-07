import {
  ArgumentsHost,
  BadRequestException,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { HttpAdapterHost } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpExceptionFilter } from '../http-exception.filter.js';

const reply = vi.fn();
const httpAdapterHost = { httpAdapter: { reply } } as unknown as HttpAdapterHost;

// Minimal ArgumentsHost: this filter only reads switchToHttp().getResponse().
const response = { __isResponse: true };
const host = {
  switchToHttp: () => ({
    getResponse: () => response,
    getRequest: () => ({}),
  }),
} as unknown as ArgumentsHost;

// Silence logger output but keep it observable.
const loggerError = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;

  beforeEach(() => {
    vi.clearAllMocks();
    filter = new HttpExceptionFilter(httpAdapterHost);
  });

  it('maps an HttpException to the error envelope with the HttpStatus name as code', () => {
    filter.catch(new NotFoundException('Product not found'), host);

    expect(reply).toHaveBeenCalledWith(
      response,
      { success: false, error: { code: 'NOT_FOUND', message: 'Product not found' } },
      HttpStatus.NOT_FOUND,
    );
    expect(loggerError).not.toHaveBeenCalled();
  });

  it('joins class-validator array messages into a single string', () => {
    filter.catch(
      new BadRequestException({
        statusCode: 400,
        message: ['email must be an email', 'password is too short'],
        error: 'Bad Request',
      }),
      host,
    );

    expect(reply).toHaveBeenCalledWith(
      response,
      {
        success: false,
        error: { code: 'BAD_REQUEST', message: 'email must be an email, password is too short' },
      },
      HttpStatus.BAD_REQUEST,
    );
  });

  it('collapses an unknown error to 500 / INTERNAL_ERROR without leaking details', () => {
    filter.catch(new Error('connect ECONNREFUSED 10.0.0.5:5432 db-password=hunter2'), host);

    expect(reply).toHaveBeenCalledWith(
      response,
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );

    // Real error stays in logs and is not sent to the client.
    expect(loggerError).toHaveBeenCalledOnce();
    const sentBody = JSON.stringify(reply.mock.calls[0]?.[1]);
    expect(sentBody).not.toContain('ECONNREFUSED');
    expect(sentBody).not.toContain('hunter2');
  });
});
