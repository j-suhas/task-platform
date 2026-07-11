import { randomUUID } from 'crypto';
import { RequestWithCorrelation } from './request-with-correlation.interface';

/**
 * `req.id` is set by pino-http's `genReqId` (reads X-Correlation-ID or
 * generates a uuid) and is the single source of truth for the request's
 * correlation id. This narrows its broader `ReqId` type down to the
 * string we actually produce, with a defensive fallback.
 */
export function getCorrelationId(request: RequestWithCorrelation): string {
  return typeof request.id === 'string' ? request.id : randomUUID();
}
