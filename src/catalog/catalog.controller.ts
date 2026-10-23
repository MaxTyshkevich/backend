import { Controller, Get, Param, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';

@Controller('api')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

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
