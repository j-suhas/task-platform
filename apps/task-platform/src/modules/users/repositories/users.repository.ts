import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/common';
import { User } from '@prisma/client';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  updateUser(
    id: string,
    data: { name?: string; digestTime?: string; timezone?: string },
  ): Promise<User> {
    return this.prisma.user.update({ where: { id }, data });
  }
}
