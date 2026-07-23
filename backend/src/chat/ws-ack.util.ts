import { WsException } from '@nestjs/websockets';
import type { Ack } from '../common/types/ack';
import { AppError } from '../common/errors/app-error';
import { ErrorCodes, type ErrorCode } from '../common/types/error-codes';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isErrorCode = (value: unknown): value is ErrorCode =>
  typeof value === 'string' && (Object.values(ErrorCodes) as string[]).includes(value);

/** Maps any thrown error onto the ack failure shape clients must handle. */
export function toAckFailure(error: unknown): Ack<never> {
  if (error instanceof AppError) {
    return { ok: false, error: { code: error.code, message: error.message } };
  }

  if (error instanceof WsException) {
    const payload = error.getError();
    if (isRecord(payload) && isErrorCode(payload.code) && typeof payload.message === 'string') {
      return { ok: false, error: { code: payload.code, message: payload.message } };
    }
    return {
      ok: false,
      error: {
        code: ErrorCodes.VALIDATION,
        message: typeof payload === 'string' ? payload : 'Invalid payload',
      },
    };
  }

  return { ok: false, error: { code: ErrorCodes.INTERNAL, message: 'Internal server error' } };
}
