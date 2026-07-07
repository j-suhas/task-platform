import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Logger } from 'nestjs-pino';
import { Response } from 'express';
import { RequestWithCorrelation } from './request-with-correlation.interface';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: Logger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<RequestWithCorrelation>();
    const response = httpContext.getResponse<Response>();

    const correlationId =
      (request as unknown as { id?: string }).id ??
      request.headers['x-correlation-id']?.toString();
    request.correlationId = correlationId;

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
