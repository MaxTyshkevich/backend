import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { Prisma } from '../generated/prisma/client';

type CatalogProduct = Prisma.ProductGetPayload<{ include: { category: true } }>;

function serialize({ badge, ...product }: CatalogProduct) {
  return { ...product, ...(badge === null ? {} : { badge }) };
}

@Injectable()
export class CatalogService {
  constructor(private readonly database: PrismaService) {}

  categories() {
    return this.database.category.findMany({ orderBy: { name: 'asc' } });
  }

  async listProducts(category?: unknown) {
    if (category !== undefined) {
      if (
        typeof category !== 'string' ||
        category.length > 100 ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(category)
      ) {
        throw new BadRequestException('Некорректная категория');
      }
      if (
        !(await this.database.category.findUnique({
          where: { slug: category },
        }))
      ) {
        throw new NotFoundException('Категория не найдена');
      }
    }
    const products = await this.database.product.findMany({
      where:
        category === undefined ? undefined : { category: { slug: category } },
      include: { category: true },
      orderBy: { id: 'asc' },
    });
    return products.map(serialize);
  }

  async product(id: string) {
    const product = await this.database.product.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!product) throw new NotFoundException('Товар не найден');
    return serialize(product);
  }
}
