import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { UsersModule } from '../users/users.module';
import { ProjectTasksController } from './controllers/project-tasks.controller';
import { TasksController } from './controllers/tasks.controller';
import { TasksService } from './services/tasks.service';
import { TasksRepository } from './repositories/tasks.repository';

@Module({
  imports: [ProjectsModule, WorkspacesModule, UsersModule],
  controllers: [ProjectTasksController, TasksController],
  providers: [TasksService, TasksRepository],
})
export class TasksModule {}
