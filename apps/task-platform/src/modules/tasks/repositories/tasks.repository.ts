import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/common';
import { Prisma, Task, TaskStatus } from '@prisma/client';

export interface TaskFilters {
  status?: TaskStatus;
  assigneeId?: string;
  tag?: string;
  search?: string;
}

@Injectable()
export class TasksRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.TaskUncheckedCreateInput): Promise<Task> {
    return this.prisma.task.create({ data });
  }

  findAll(projectId: string, filters: TaskFilters = {}): Promise<Task[]> {
    const where: Prisma.TaskWhereInput = { projectId };

    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.assigneeId) {
      where.assigneeId = filters.assigneeId;
    }
    if (filters.tag) {
      where.tags = { has: filters.tag };
    }
    if (filters.search) {
      where.title = { contains: filters.search, mode: 'insensitive' };
    }

    return this.prisma.task.findMany({ where });
  }

  findById(id: string): Promise<Task | null> {
    return this.prisma.task.findUnique({ where: { id } });
  }

  findBacklog(projectId: string): Promise<Task[]> {
    return this.prisma.task.findMany({
      where: { projectId, sprintId: null, status: { not: TaskStatus.DONE } },
    });
  }

  update(id: string, data: Prisma.TaskUncheckedUpdateInput): Promise<Task> {
    return this.prisma.task.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.task.delete({ where: { id } });
  }

  updateStatus(id: string, status: TaskStatus): Promise<Task> {
    return this.prisma.task.update({ where: { id }, data: { status } });
  }

  updateAssignee(id: string, assigneeId: string): Promise<Task> {
    return this.prisma.task.update({ where: { id }, data: { assigneeId } });
  }
}
