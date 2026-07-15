import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@app/common';
import { WorkspacesService } from '../services/workspaces.service';
import { CreateWorkspaceDto } from '../dto/create-workspace.dto';
import { InviteMemberDto } from '../dto/invite-member.dto';
import { WorkspaceMemberGuard } from '../guards/workspace-member.guard';

@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Post()
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateWorkspaceDto) {
    return this.workspacesService.create(dto.name, user.id);
  }

  @Get()
  findAll(@CurrentUser() user: { id: string }) {
    return this.workspacesService.findAll(user.id);
  }

  @UseGuards(WorkspaceMemberGuard)
  @Get(':workspaceId')
  findOne(@Param('workspaceId') workspaceId: string) {
    return this.workspacesService.findOne(workspaceId);
  }

  @UseGuards(WorkspaceMemberGuard)
  @Post(':workspaceId/invite')
  invite(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: InviteMemberDto,
  ) {
    return this.workspacesService.invite(workspaceId, dto.email);
  }

  @UseGuards(WorkspaceMemberGuard)
  @Get(':workspaceId/members')
  getMembers(@Param('workspaceId') workspaceId: string) {
    return this.workspacesService.getMembers(workspaceId);
  }
}
