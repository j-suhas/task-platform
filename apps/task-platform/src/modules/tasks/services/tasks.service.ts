import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Project, Task } from '@prisma/client';
import { ProjectsRepository } from '../../projects/repositories/projects.repository';
import { WorkspacesRepository } from '../../workspaces/repositories/workspaces.repository';
import { UsersRepository } from '../../users/repositories/users.repository';
import { TaskFilters, TasksRepository } from '../repositories/tasks.repository';
import { CreateTaskDto } from '../dto/create-task.dto';
import { UpdateTaskDto } from '../dto/update-task.dto';
import { UpdateStatusDto } from '../dto/update-status.dto';
import { AssignTaskDto } from '../dto/assign-task.dto';

type BoardView = Record<'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE', Task[]>;

@Injectable()
export class TasksService {
  constructor(
    private readonly tasksRepository: TasksRepository,
    private readonly projectsRepository: ProjectsRepository,
    private readonly workspacesRepository: WorkspacesRepository,
    private readonly usersRepository: UsersRepository,
  ) {}

  private async assertProjectMembership(
    projectId: string,
    userId: string,
  ): Promise<Project> {
    const project = await this.projectsRepository.findById(projectId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const member = await this.workspacesRepository.findMember(
      project.workspaceId,
      userId,
    );
    if (!member) {
      throw new ForbiddenException("Not a member of this project's workspace");
    }

    return project;
  }

  // TODO: optimize with single JOIN query post-MVP if latency becomes
  // noticeable (currently 3 sequential DB calls: task -> project -> member)
  private async assertTaskMembership(
    taskId: string,
    userId: string,
  ): Promise<Task> {
    const task = await this.tasksRepository.findById(taskId);
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    await this.assertProjectMembership(task.projectId, userId);

    return task;
  }

  async create(
    projectId: string,
    dto: CreateTaskDto,
    creatorId: string,
  ): Promise<Task> {
    await this.assertProjectMembership(projectId, creatorId);

    if (dto.assigneeId) {
      const assignee = await this.usersRepository.findById(dto.assigneeId);
      if (!assignee) {
        throw new NotFoundException('Assignee not found');
      }
    }

    return this.tasksRepository.create({
      title: dto.title,
      description: dto.description,
      priority: dto.priority,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      tags: dto.tags,
      linkedUrls: dto.linkedUrls as Prisma.InputJsonValue | undefined,
      projectId,
      sprintId: dto.sprintId,
      assigneeId: dto.assigneeId,
      creatorId,
    });
  }

  async findAll(
    projectId: string,
    filters: TaskFilters,
    userId: string,
  ): Promise<Task[]> {
    await this.assertProjectMembership(projectId, userId);
    return this.tasksRepository.findAll(projectId, filters);
  }

  async getBoardView(projectId: string, userId: string): Promise<BoardView> {
    await this.assertProjectMembership(projectId, userId);
    const tasks = await this.tasksRepository.findAll(projectId);

    const board: BoardView = {
      TODO: [],
      IN_PROGRESS: [],
      BLOCKED: [],
      DONE: [],
    };

    for (const task of tasks) {
      if (task.status in board) {
        board[task.status as keyof BoardView].push(task);
      }
    }

    return board;
  }

  async getBacklog(projectId: string, userId: string): Promise<Task[]> {
    await this.assertProjectMembership(projectId, userId);
    return this.tasksRepository.findBacklog(projectId);
  }

  async findOne(id: string, userId: string): Promise<Task> {
    return this.assertTaskMembership(id, userId);
  }

  async update(id: string, dto: UpdateTaskDto, userId: string): Promise<Task> {
    await this.assertTaskMembership(id, userId);

    if (dto.assigneeId) {
      const assignee = await this.usersRepository.findById(dto.assigneeId);
      if (!assignee) {
        throw new NotFoundException('Assignee not found');
      }
    }

    return this.tasksRepository.update(id, {
      ...dto,
      linkedUrls: dto.linkedUrls as Prisma.InputJsonValue | undefined,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
    });
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.assertTaskMembership(id, userId);
    await this.tasksRepository.delete(id);
  }

  async updateStatus(
    id: string,
    dto: UpdateStatusDto,
    userId: string,
  ): Promise<Task> {
    await this.assertTaskMembership(id, userId);
    return this.tasksRepository.updateStatus(id, dto.status);
  }

  async assign(id: string, dto: AssignTaskDto, userId: string): Promise<Task> {
    await this.assertTaskMembership(id, userId);

    if (dto.assigneeId !== null) {
      const assignee = await this.usersRepository.findById(dto.assigneeId);
      if (!assignee) {
        throw new NotFoundException('Assignee not found');
      }
    }

    return this.tasksRepository.updateAssignee(id, dto.assigneeId);
  }
}
