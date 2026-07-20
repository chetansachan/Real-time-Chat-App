import type { ErrorCode } from '../types/error-codes';

/**
 * Domain error with a stable machine-readable code.
 * The HTTP filter and the WebSocket ack mapper both understand it.
 */
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly status: number = 400,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
