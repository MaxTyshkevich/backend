import { Controller, Get } from '@nestjs/common';
import { CatalogService } from './catalog.service';

@Controller('api/categories')
export class CategoriesController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  categories() {
    return this.catalog.categories();
  }
}
