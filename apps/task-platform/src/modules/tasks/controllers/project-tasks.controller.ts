import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '@app/common';
import { TaskStatus } from '@prisma/client';
import { TasksService } from '../services/tasks.service';
import { CreateTaskDto } from '../dto/create-task.dto';

@Controller('projects/:projectId/tasks')
export class ProjectTasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateTaskDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.tasksService.create(projectId, dto, user.id);
  }

  @Get()
  findAll(
    @Param('projectId') projectId: string,
    @CurrentUser() user: { id: string },
    @Query('status') status?: TaskStatus,
    @Query('assigneeId') assigneeId?: string,
    @Query('tag') tag?: string,
    @Query('search') search?: string,
  ) {
    return this.tasksService.findAll(
      projectId,
      { status, assigneeId, tag, search },
      user.id,
    );
  }

  @Get('board')
  getBoardView(
    @Param('projectId') projectId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.tasksService.getBoardView(projectId, user.id);
  }

  @Get('backlog')
  getBacklog(
    @Param('projectId') projectId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.tasksService.getBacklog(projectId, user.id);
  }
}
