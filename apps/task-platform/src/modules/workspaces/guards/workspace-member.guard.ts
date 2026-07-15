import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { RequestWithCorrelation } from '@app/common';
import { WorkspacesRepository } from '../repositories/workspaces.repository';

@Injectable()
export class WorkspaceMemberGuard implements CanActivate {
  constructor(private readonly workspacesRepository: WorkspacesRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithCorrelation>();
    const workspaceId = (request.params as Record<string, string>).workspaceId;
    const userId = request.user?.id;

    const member = await this.workspacesRepository.findMember(
      workspaceId,
      userId as string,
    );
    if (!member) {
      throw new ForbiddenException('Not a member of this workspace');
    }
    return true;
  }
}
