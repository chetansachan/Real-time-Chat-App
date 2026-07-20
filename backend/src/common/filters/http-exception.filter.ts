import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Catch, HttpException, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppError } from '../errors/app-error';
import { ErrorCodes, type ErrorCode } from '../types/error-codes';

interface ErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: string[];
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const statusToCode = (status: number): ErrorCode => {
  switch (status) {
    case 400:
    case 422:
      return ErrorCodes.VALIDATION;
    case 401:
      return ErrorCodes.UNAUTHORIZED;
    case 403:
      return ErrorCodes.FORBIDDEN;
    case 404:
      return ErrorCodes.NOT_FOUND;
    case 409:
      return ErrorCodes.CONFLICT;
    case 429:
      return ErrorCodes.RATE_LIMITED;
    default:
      return status >= 500 ? ErrorCodes.INTERNAL : ErrorCodes.VALIDATION;
  }
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    if (exception instanceof AppError) {
      response.status(exception.status).json({
        error: { code: exception.code, message: exception.message },
      } satisfies ErrorBody);
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const raw = exception.getResponse();
      let message = exception.message;
      let details: string[] | undefined;

      if (typeof raw === 'string') {
        message = raw;
      } else if (isRecord(raw)) {
        const rawMessage = raw.message;
        if (Array.isArray(rawMessage)) {
          details = rawMessage.map(String);
          message = 'Validation failed';
        } else if (typeof rawMessage === 'string') {
          message = rawMessage;
        }
      }

      response.status(status).json({
        error: { code: statusToCode(status), message, ...(details ? { details } : {}) },
      } satisfies ErrorBody);
      return;
    }

    this.logger.error(
      `Unhandled error on ${request.method} ${request.url}`,
      exception instanceof Error ? exception.stack : String(exception),
    );
    response.status(500).json({
      error: { code: ErrorCodes.INTERNAL, message: 'Internal server error' },
    } satisfies ErrorBody);
  }
}
