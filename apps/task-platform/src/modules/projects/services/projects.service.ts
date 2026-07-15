import { Injectable, NotFoundException } from '@nestjs/common';
import { Project } from '@prisma/client';
import { ProjectsRepository } from '../repositories/projects.repository';
import { CreateProjectDto } from '../dto/create-project.dto';
import { UpdateProjectDto } from '../dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly projectsRepository: ProjectsRepository) {}

  create(workspaceId: string, dto: CreateProjectDto): Promise<Project> {
    return this.projectsRepository.create(
      dto.name,
      dto.description,
      workspaceId,
    );
  }

  findAll(workspaceId: string): Promise<Project[]> {
    return this.projectsRepository.findAll(workspaceId);
  }

  async findOne(id: string, workspaceId: string): Promise<Project> {
    const project = await this.projectsRepository.findById(id);
    if (!project || project.workspaceId !== workspaceId) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  async update(
    id: string,
    workspaceId: string,
    dto: UpdateProjectDto,
  ): Promise<Project> {
    await this.findOne(id, workspaceId);
    return this.projectsRepository.update(id, dto);
  }

  async remove(id: string, workspaceId: string): Promise<void> {
    await this.findOne(id, workspaceId);
    await this.projectsRepository.delete(id);
  }
}
