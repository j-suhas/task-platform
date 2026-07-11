import type { Request } from 'express';

export interface RequestWithCorrelation extends Request {
  correlationId?: string;
  user?: { id: string; email: string };
}
