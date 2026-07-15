import { Body, Controller, Delete, Get, Param, Patch } from '@nestjs/common';
import { CurrentUser } from '@app/common';
import { TasksService } from '../services/tasks.service';
import { UpdateTaskDto } from '../dto/update-task.dto';
import { UpdateStatusDto } from '../dto/update-status.dto';
import { AssignTaskDto } from '../dto/assign-task.dto';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.tasksService.findOne(id, user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.tasksService.update(id, dto, user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.tasksService.remove(id, user.id);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.tasksService.updateStatus(id, dto, user.id);
  }

  @Patch(':id/assign')
  assign(
    @Param('id') id: string,
    @Body() dto: AssignTaskDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.tasksService.assign(id, dto, user.id);
  }
}
