# Task Platform

A personal task management platform with reminder scheduling and push notifications.

## Tech Stack

- [NestJS](https://nestjs.com/) monorepo
- TypeScript
- [Prisma](https://www.prisma.io/) + PostgreSQL
- [BullMQ](https://docs.bullmq.io/) + Redis
- JWT authentication (access + refresh tokens)
- Firebase Cloud Messaging (push notifications)
- Sentry (error tracking)

## Apps

- `apps/task-platform` — main API (auth, tasks, reminders CRUD)
- `apps/reminder-worker` — background worker that processes scheduled reminder jobs

## Local Setup

> TODO: fill in once Prisma and Docker are set up.

## Architecture

> TODO: add architecture diagram.
