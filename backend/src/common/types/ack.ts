import type { ErrorCode } from './error-codes';

export interface AckSuccess<T> {
  ok: true;
  data: T;
}

export interface AckFailure {
  ok: false;
  error: {
    code: ErrorCode;
    message: string;
  };
}

/**
 * Discriminated union returned by every socket acknowledgement.
 * Clients must branch on `ok` before reading the payload.
 */
export type Ack<T> = AckSuccess<T> | AckFailure;
