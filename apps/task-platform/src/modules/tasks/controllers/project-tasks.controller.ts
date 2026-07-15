import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '@app/common';
import { TasksService } from '../services/tasks.service';
import { CreateTaskDto } from '../dto/create-task.dto';
import { ListTasksQueryDto } from '../dto/list-tasks-query.dto';

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
    @Query() query: ListTasksQueryDto,
  ) {
    return this.tasksService.findAll(projectId, query, user.id);
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
