import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestWithCorrelation } from '../interceptors/request-with-correlation.interface';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithCorrelation>();
    return request.user;
  },
);
