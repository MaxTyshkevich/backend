import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

const selection = {
  id: true,
  name: true,
  profile: {
    select: { bio: true, avatarUrl: true, createdAt: true, updatedAt: true },
  },
} as const;

@Injectable()
export class ProfileService {
  constructor(private readonly database: PrismaService) {}

  async get(userId: string) {
    const user = await this.database.user.findUniqueOrThrow({
      where: { id: userId },
      select: selection,
    });
    return {
      ...user,
      profile: user.profile ?? {
        bio: '',
        avatarUrl: null,
        createdAt: null,
        updatedAt: null,
      },
    };
  }

  async update(userId: string, dto: UpdateProfileDto) {
    const { name, ...profile } = dto;
    return this.database.user.update({
      where: { id: userId },
      data: { name, profile: { upsert: { create: profile, update: profile } } },
      select: selection,
    });
  }
}
