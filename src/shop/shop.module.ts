import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CartModule } from '../cart/cart.module';
import { ShopController } from './shop.controller';

@Module({
  imports: [AuthModule, CartModule],
  controllers: [ShopController],
})
export class ShopModule {}
