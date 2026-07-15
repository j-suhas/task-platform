import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Priority, Task, TaskStatus, WorkspaceRole } from '@prisma/client';
import { TasksService } from './tasks.service';
import { TasksRepository } from '../repositories/tasks.repository';
import { ProjectsRepository } from '../../projects/repositories/projects.repository';
import { WorkspacesRepository } from '../../workspaces/repositories/workspaces.repository';
import { UsersRepository } from '../../users/repositories/users.repository';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Do the thing',
    description: null,
    status: TaskStatus.TODO,
    priority: Priority.MEDIUM,
    dueDate: null,
    tags: [],
    linkedUrls: null,
    projectId: 'project-1',
    sprintId: null,
    assigneeId: null,
    creatorId: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('TasksService', () => {
  let service: TasksService;
  let tasksRepository: jest.Mocked<TasksRepository>;
  let projectsRepository: jest.Mocked<ProjectsRepository>;
  let workspacesRepository: jest.Mocked<WorkspacesRepository>;
  let usersRepository: jest.Mocked<UsersRepository>;

  const project = {
    id: 'project-1',
    name: 'Project',
    description: null,
    workspaceId: 'workspace-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const member = {
    id: 'member-1',
    workspaceId: 'workspace-1',
    userId: 'user-1',
    role: WorkspaceRole.MEMBER,
    joinedAt: new Date(),
  };

  beforeEach(() => {
    tasksRepository = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      findBacklog: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      updateStatus: jest.fn(),
      updateAssignee: jest.fn(),
    } as unknown as jest.Mocked<TasksRepository>;

    projectsRepository = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<ProjectsRepository>;

    workspacesRepository = {
      create: jest.fn(),
      findAllForUser: jest.fn(),
      findById: jest.fn(),
      findMember: jest.fn(),
      addMember: jest.fn(),
      findMembers: jest.fn(),
    } as unknown as jest.Mocked<WorkspacesRepository>;

    usersRepository = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      updateUser: jest.fn(),
    } as unknown as jest.Mocked<UsersRepository>;

    service = new TasksService(
      tasksRepository,
      projectsRepository,
      workspacesRepository,
      usersRepository,
    );
  });

  describe('create', () => {
    it('creates a task when the project exists and the user is a member', async () => {
      const created = makeTask();
      projectsRepository.findById.mockResolvedValue(project);
      workspacesRepository.findMember.mockResolvedValue(member);
      tasksRepository.create.mockResolvedValue(created);

      const result = await service.create(
        'project-1',
        { title: 'Do the thing' },
        'user-1',
      );

      expect(result).toEqual(created);
      expect(tasksRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Do the thing',
          projectId: 'project-1',
        }),
      );
    });

    it('throws NotFoundException when the project does not exist', async () => {
      projectsRepository.findById.mockResolvedValue(null);

      await expect(
        service.create('missing-project', { title: 'x' }, 'user-1'),
      ).rejects.toThrow(NotFoundException);
      expect(workspacesRepository.findMember).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when the user is not a workspace member', async () => {
      projectsRepository.findById.mockResolvedValue(project);
      workspacesRepository.findMember.mockResolvedValue(null);

      await expect(
        service.create('project-1', { title: 'x' }, 'stranger'),
      ).rejects.toThrow(ForbiddenException);
      expect(tasksRepository.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the assignee does not exist', async () => {
      projectsRepository.findById.mockResolvedValue(project);
      workspacesRepository.findMember.mockResolvedValue(member);
      usersRepository.findById.mockResolvedValue(null);

      await expect(
        service.create(
          'project-1',
          { title: 'x', assigneeId: 'ghost' },
          'user-1',
        ),
      ).rejects.toThrow(NotFoundException);
      expect(tasksRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('getBoardView', () => {
    it('groups tasks by status', async () => {
      projectsRepository.findById.mockResolvedValue(project);
      workspacesRepository.findMember.mockResolvedValue(member);
      tasksRepository.findAll.mockResolvedValue([
        makeTask({ id: 't1', status: TaskStatus.TODO }),
        makeTask({ id: 't2', status: TaskStatus.IN_PROGRESS }),
        makeTask({ id: 't3', status: TaskStatus.BLOCKED }),
        makeTask({ id: 't4', status: TaskStatus.DONE }),
        makeTask({ id: 't5', status: TaskStatus.TODO }),
      ]);

      const result = await service.getBoardView('project-1', 'user-1');

      expect(result.TODO.map((t) => t.id)).toEqual(['t1', 't5']);
      expect(result.IN_PROGRESS.map((t) => t.id)).toEqual(['t2']);
      expect(result.BLOCKED.map((t) => t.id)).toEqual(['t3']);
      expect(result.DONE.map((t) => t.id)).toEqual(['t4']);
    });
  });

  describe('findOne', () => {
    it('returns the task when found and the user is a member', async () => {
      const existing = makeTask();
      tasksRepository.findById.mockResolvedValue(existing);
      projectsRepository.findById.mockResolvedValue(project);
      workspacesRepository.findMember.mockResolvedValue(member);

      const result = await service.findOne('task-1', 'user-1');

      expect(result).toEqual(existing);
    });

    it('throws NotFoundException when the task does not exist', async () => {
      tasksRepository.findById.mockResolvedValue(null);

      await expect(service.findOne('missing', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when the user is not a workspace member', async () => {
      tasksRepository.findById.mockResolvedValue(makeTask());
      projectsRepository.findById.mockResolvedValue(project);
      workspacesRepository.findMember.mockResolvedValue(null);

      await expect(service.findOne('task-1', 'stranger')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('updateStatus', () => {
    it('updates the task status', async () => {
      tasksRepository.findById.mockResolvedValue(makeTask());
      projectsRepository.findById.mockResolvedValue(project);
      workspacesRepository.findMember.mockResolvedValue(member);
      tasksRepository.updateStatus.mockResolvedValue(
        makeTask({ status: TaskStatus.IN_PROGRESS }),
      );

      const result = await service.updateStatus(
        'task-1',
        { status: TaskStatus.IN_PROGRESS },
        'user-1',
      );

      expect(result.status).toBe(TaskStatus.IN_PROGRESS);
      expect(tasksRepository.updateStatus).toHaveBeenCalledWith(
        'task-1',
        TaskStatus.IN_PROGRESS,
      );
    });
  });

  describe('assign', () => {
    it('assigns the task to an existing user', async () => {
      tasksRepository.findById.mockResolvedValue(makeTask());
      projectsRepository.findById.mockResolvedValue(project);
      workspacesRepository.findMember.mockResolvedValue(member);
      usersRepository.findById.mockResolvedValue({
        id: 'assignee-1',
      } as never);
      tasksRepository.updateAssignee.mockResolvedValue(
        makeTask({ assigneeId: 'assignee-1' }),
      );

      const result = await service.assign(
        'task-1',
        { assigneeId: 'assignee-1' },
        'user-1',
      );

      expect(result.assigneeId).toBe('assignee-1');
    });

    it('throws NotFoundException when the assignee does not exist', async () => {
      tasksRepository.findById.mockResolvedValue(makeTask());
      projectsRepository.findById.mockResolvedValue(project);
      workspacesRepository.findMember.mockResolvedValue(member);
      usersRepository.findById.mockResolvedValue(null);

      await expect(
        service.assign('task-1', { assigneeId: 'ghost' }, 'user-1'),
      ).rejects.toThrow(NotFoundException);
      expect(tasksRepository.updateAssignee).not.toHaveBeenCalled();
    });

    it('unassigns a task when assigneeId is null, without checking user existence', async () => {
      tasksRepository.findById.mockResolvedValue(
        makeTask({ assigneeId: 'assignee-1' }),
      );
      projectsRepository.findById.mockResolvedValue(project);
      workspacesRepository.findMember.mockResolvedValue(member);
      tasksRepository.updateAssignee.mockResolvedValue(
        makeTask({ assigneeId: null }),
      );

      const result = await service.assign(
        'task-1',
        { assigneeId: null },
        'user-1',
      );

      expect(result.assigneeId).toBeNull();
      expect(usersRepository.findById).not.toHaveBeenCalled();
      expect(tasksRepository.updateAssignee).toHaveBeenCalledWith(
        'task-1',
        null,
      );
    });
  });
});
