import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  const workspace = await prisma.workspace.create({
    data: { name: 'Family' },
  });

  const owner = await prisma.user.create({
    data: {
      email: 'owner@family.dev',
      name: 'Family Owner',
      passwordHash,
      workspaceMemberships: {
        create: { workspaceId: workspace.id, role: 'OWNER' },
      },
    },
  });

  const member = await prisma.user.create({
    data: {
      email: 'member@family.dev',
      name: 'Family Member',
      passwordHash,
      workspaceMemberships: {
        create: { workspaceId: workspace.id, role: 'MEMBER' },
      },
    },
  });

  const project = await prisma.project.create({
    data: {
      name: 'Personal',
      workspaceId: workspace.id,
    },
  });

  const [firstTask] = await Promise.all([
    prisma.task.create({
      data: {
        title: 'Buy groceries',
        status: 'TODO',
        projectId: project.id,
        creatorId: owner.id,
        assigneeId: member.id,
      },
    }),
    prisma.task.create({
      data: {
        title: 'Plan weekend trip',
        status: 'IN_PROGRESS',
        projectId: project.id,
        creatorId: owner.id,
        assigneeId: owner.id,
      },
    }),
    prisma.task.create({
      data: {
        title: 'Pay electricity bill',
        status: 'DONE',
        projectId: project.id,
        creatorId: member.id,
        assigneeId: owner.id,
      },
    }),
  ]);

  await prisma.reminder.create({
    data: {
      taskId: firstTask.id,
      scheduledAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
