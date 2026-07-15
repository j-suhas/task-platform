import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/common';
import { Workspace, WorkspaceMember, WorkspaceRole } from '@prisma/client';

type WorkspaceMemberWithUser = WorkspaceMember & {
  user: { id: string; name: string; email: string };
};

@Injectable()
export class WorkspacesRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(name: string, ownerId: string): Promise<Workspace> {
    return this.prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({ data: { name } });
      await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: ownerId,
          role: WorkspaceRole.OWNER,
        },
      });
      return workspace;
    });
  }

  findAllForUser(userId: string): Promise<Workspace[]> {
    return this.prisma.workspace.findMany({
      where: { members: { some: { userId } } },
    });
  }

  findById(id: string): Promise<Workspace | null> {
    return this.prisma.workspace.findUnique({ where: { id } });
  }

  findMember(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMember | null> {
    return this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
  }

  addMember(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
  ): Promise<WorkspaceMember> {
    return this.prisma.workspaceMember.create({
      data: { workspaceId, userId, role },
    });
  }

  findMembers(workspaceId: string): Promise<WorkspaceMemberWithUser[]> {
    return this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }
}
