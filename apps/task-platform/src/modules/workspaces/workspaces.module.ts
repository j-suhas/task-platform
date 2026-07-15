import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { WorkspacesController } from './controllers/workspaces.controller';
import { WorkspacesService } from './services/workspaces.service';
import { WorkspacesRepository } from './repositories/workspaces.repository';
import { WorkspaceMemberGuard } from './guards/workspace-member.guard';

@Module({
  imports: [UsersModule],
  controllers: [WorkspacesController],
  providers: [WorkspacesService, WorkspacesRepository, WorkspaceMemberGuard],
  exports: [WorkspacesRepository, WorkspaceMemberGuard],
})
export class WorkspacesModule {}
