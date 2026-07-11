import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Logger } from 'nestjs-pino';
import type { Response } from 'express';
import { RequestWithCorrelation } from './request-with-correlation.interface';
import { getCorrelationId } from './correlation-id.util';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: Logger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<RequestWithCorrelation>();
    const response = httpContext.getResponse<Response>();

    request.correlationId = getCorrelationId(request);

    const startTime = Date.now();

    response.on('finish', () => {
      this.logger.log({
        method: request.method,
        path: request.originalUrl ?? request.url,
        statusCode: response.statusCode,
        duration: Date.now() - startTime,
        correlationId: request.correlationId,
        userId: request.user?.id ?? null,
      });
    });

    return next.handle();
  }
}
