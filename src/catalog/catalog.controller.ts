import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { SessionGuard } from '../auth/session.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../generated/prisma/enums';
import { CsrfGuard } from '../common/guards/csrf.guard';
import { CreateProductDto } from './dto/create-product.dto';

@Controller('api')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Post('products')
  @UseGuards(SessionGuard, RolesGuard, CsrfGuard)
  @Roles(Role.ADMIN)
  create(@Body() body: CreateProductDto) {
    return this.catalog.create(body);
  }

  @Get('categories')
  categories() {
    return this.catalog.categories();
  }

  @Get('products')
  products(@Query('category') category?: unknown) {
    return this.catalog.listProducts(category);
  }

  @Get('products/:id')
  product(@Param('id') id: string) {
    return this.catalog.product(id);
  }
}
