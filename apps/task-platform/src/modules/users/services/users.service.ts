import { Injectable, NotFoundException } from '@nestjs/common';
import { User } from '@prisma/client';
import { UsersRepository } from '../repositories/users.repository';
import { UpdateUserDto } from '../dto/update-user.dto';

type SanitizedUser = Omit<User, 'passwordHash'>;

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async getProfile(userId: string): Promise<SanitizedUser> {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.sanitize(user);
  }

  async updateProfile(
    userId: string,
    dto: UpdateUserDto,
  ): Promise<SanitizedUser> {
    const existing = await this.usersRepository.findById(userId);
    if (!existing) {
      throw new NotFoundException('User not found');
    }
    const updated = await this.usersRepository.updateUser(userId, dto);
    return this.sanitize(updated);
  }

  private sanitize(user: User): SanitizedUser {
    const sanitized: Partial<User> = { ...user };
    delete sanitized.passwordHash;
    return sanitized as SanitizedUser;
  }
}
