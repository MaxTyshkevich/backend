import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CartModule } from '../cart/cart.module';
import { ShopController } from './shop.controller';
import { CatalogController } from '../catalog/catalog.controller';
import { CatalogService } from '../catalog/catalog.service';

@Module({
  imports: [AuthModule, CartModule],
  controllers: [ShopController, CatalogController],
  providers: [CatalogService],
})
export class ShopModule {}
