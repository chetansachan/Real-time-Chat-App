import { Injectable, ValidationPipe } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import type { ValidationError } from 'class-validator';
import { ErrorCodes } from '../common/types/error-codes';

const flatten = (errors: ValidationError[]): string[] =>
  errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...flatten(error.children ?? []),
  ]);

/**
 * Socket payloads need a different failure type than HTTP: ValidationPipe would
 * otherwise throw a BadRequestException that does not map onto an ack.
 */
@Injectable()
export class WsValidationPipe extends ValidationPipe {
  constructor() {
    super({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors: ValidationError[]) =>
        new WsException({
          code: ErrorCodes.VALIDATION,
          message: 'Validation failed',
          details: flatten(errors),
        }),
    });
  }
}
