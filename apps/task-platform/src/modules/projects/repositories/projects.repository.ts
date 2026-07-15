import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/common';
import { Project } from '@prisma/client';

@Injectable()
export class ProjectsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(
    name: string,
    description: string | undefined,
    workspaceId: string,
  ): Promise<Project> {
    return this.prisma.project.create({
      data: { name, description, workspaceId },
    });
  }

  findAll(workspaceId: string): Promise<Project[]> {
    return this.prisma.project.findMany({ where: { workspaceId } });
  }

  findById(id: string): Promise<Project | null> {
    return this.prisma.project.findUnique({ where: { id } });
  }

  update(
    id: string,
    data: { name?: string; description?: string },
  ): Promise<Project> {
    return this.prisma.project.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.project.delete({ where: { id } });
  }
}
