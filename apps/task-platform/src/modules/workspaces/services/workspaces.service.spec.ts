import { ConflictException, NotFoundException } from '@nestjs/common';
import { User, WorkspaceRole } from '@prisma/client';
import { WorkspacesService } from './workspaces.service';
import { WorkspacesRepository } from '../repositories/workspaces.repository';
import { UsersRepository } from '../../users/repositories/users.repository';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'member@test.com',
    name: 'Member',
    passwordHash: 'hashed',
    digestTime: '07:00',
    timezone: 'Asia/Kolkata',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('WorkspacesService', () => {
  let service: WorkspacesService;
  let workspacesRepository: jest.Mocked<WorkspacesRepository>;
  let usersRepository: jest.Mocked<UsersRepository>;

  beforeEach(() => {
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

    service = new WorkspacesService(workspacesRepository, usersRepository);
  });

  describe('create', () => {
    it('creates a workspace owned by the requesting user', async () => {
      const workspace = {
        id: 'workspace-1',
        name: 'Family',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      workspacesRepository.create.mockResolvedValue(workspace);

      const result = await service.create('Family', 'user-1');

      expect(result).toEqual(workspace);
      expect(workspacesRepository.create).toHaveBeenCalledWith(
        'Family',
        'user-1',
      );
    });
  });

  describe('invite', () => {
    it('adds an existing user as a MEMBER', async () => {
      usersRepository.findByEmail.mockResolvedValue(makeUser());
      workspacesRepository.findMember.mockResolvedValue(null);
      workspacesRepository.addMember.mockResolvedValue({
        id: 'member-1',
        workspaceId: 'workspace-1',
        userId: 'user-1',
        role: WorkspaceRole.MEMBER,
        joinedAt: new Date(),
      });

      await service.invite('workspace-1', 'member@test.com');

      expect(workspacesRepository.addMember).toHaveBeenCalledWith(
        'workspace-1',
        'user-1',
        WorkspaceRole.MEMBER,
      );
    });

    it('throws NotFoundException when no account exists for the email', async () => {
      usersRepository.findByEmail.mockResolvedValue(null);

      await expect(
        service.invite('workspace-1', 'unknown@test.com'),
      ).rejects.toThrow(NotFoundException);
      expect(workspacesRepository.addMember).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the user is already a member', async () => {
      usersRepository.findByEmail.mockResolvedValue(makeUser());
      workspacesRepository.findMember.mockResolvedValue({
        id: 'member-1',
        workspaceId: 'workspace-1',
        userId: 'user-1',
        role: WorkspaceRole.MEMBER,
        joinedAt: new Date(),
      });

      await expect(
        service.invite('workspace-1', 'member@test.com'),
      ).rejects.toThrow(ConflictException);
      expect(workspacesRepository.addMember).not.toHaveBeenCalled();
    });
  });
});
