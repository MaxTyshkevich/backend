import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './database/prisma.service';

@Controller('api/health')
export class HealthController {
  constructor(private readonly database: PrismaService) {}

  @Get()
  async health() {
    await this.database.$queryRaw`SELECT 1`;
    return { status: 'ok', storage: 'postgresql', contractVersion: 2 };
  }
}
