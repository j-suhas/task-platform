import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { Logger } from 'nestjs-pino';
import { RequestWithCorrelation } from '../interceptors/request-with-correlation.interface';
import { getCorrelationId } from '../interceptors/correlation-id.util';

const SERVER_ERROR_THRESHOLD = 500;

function toErrorCode(exception: HttpException): string {
  const name = exception.constructor.name.replace(/Exception$/, '') || 'Http';
  return name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithCorrelation>();
    const correlationId = getCorrelationId(request);

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const rawMessage =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : ((exceptionResponse as Record<string, unknown>).message ??
            exception.message);

      if (status >= SERVER_ERROR_THRESHOLD) {
        this.logger.error(
          { correlationId, err: exception, statusCode: status },
          'HTTP exception',
        );
      }

      response.status(status).json({
        success: false,
        error: {
          code: toErrorCode(exception),
          message: Array.isArray(rawMessage)
            ? rawMessage.join(', ')
            : rawMessage,
          correlationId,
        },
      });
      return;
    }

    this.logger.error({ correlationId, err: exception }, 'Unhandled exception');

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        correlationId,
      },
    });
  }
}
