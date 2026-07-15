import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Workspace, WorkspaceRole } from '@prisma/client';
import { UsersRepository } from '../../users/repositories/users.repository';
import { WorkspacesRepository } from '../repositories/workspaces.repository';

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly workspacesRepository: WorkspacesRepository,
    private readonly usersRepository: UsersRepository,
  ) {}

  create(name: string, userId: string): Promise<Workspace> {
    return this.workspacesRepository.create(name, userId);
  }

  findAll(userId: string): Promise<Workspace[]> {
    return this.workspacesRepository.findAllForUser(userId);
  }

  async findOne(id: string): Promise<Workspace> {
    const workspace = await this.workspacesRepository.findById(id);
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }
    return workspace;
  }

  async invite(workspaceId: string, email: string) {
    const user = await this.usersRepository.findByEmail(email);
    if (!user) {
      throw new NotFoundException('No account exists for this email');
    }

    const existingMember = await this.workspacesRepository.findMember(
      workspaceId,
      user.id,
    );
    if (existingMember) {
      throw new ConflictException('User is already a member of this workspace');
    }

    return this.workspacesRepository.addMember(
      workspaceId,
      user.id,
      WorkspaceRole.MEMBER,
    );
  }

  getMembers(workspaceId: string) {
    return this.workspacesRepository.findMembers(workspaceId);
  }
}
