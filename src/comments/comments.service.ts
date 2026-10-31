import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CommentDto, CommentsQueryDto } from './dto/comment.dto';

const publicFields = {
  id: true,
  productId: true,
  text: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { id: true, name: true } },
} as const;

@Injectable()
export class CommentsService {
  constructor(private readonly database: PrismaService) {}

  async list(productId: string, { page, limit }: CommentsQueryDto) {
    if (
      !(await this.database.product.findUnique({
        where: { id: productId },
        select: { id: true },
      }))
    ) {
      throw new NotFoundException('Товар не найден');
    }
    const items = await this.database.comment.findMany({
      where: { productId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
      select: publicFields,
    });
    return { items, page, limit };
  }

  async create(productId: string, userId: string, dto: CommentDto) {
    if (
      !(await this.database.product.findUnique({
        where: { id: productId },
        select: { id: true },
      }))
    ) {
      throw new NotFoundException('Товар не найден');
    }
    try {
      return await this.database.comment.create({
        data: { productId, userId, text: dto.text },
        select: publicFields,
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2003')
        throw new NotFoundException('Товар или пользователь не найден');
      throw error;
    }
  }

  async update(id: string, userId: string, dto: CommentDto) {
    try {
      return await this.database.comment.update({
        where: { id, userId },
        data: { text: dto.text },
        select: publicFields,
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2025')
        throw new NotFoundException('Комментарий не найден');
      throw error;
    }
  }

  async remove(id: string, userId: string) {
    const result = await this.database.comment.deleteMany({
      where: { id, userId },
    });
    if (!result.count) throw new NotFoundException('Комментарий не найден');
  }
}
