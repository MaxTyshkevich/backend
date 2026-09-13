import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ShopController } from './shop.controller';
import { ShopService } from './shop.service';

@Module({
  imports: [ConfigModule.forRoot()],
  controllers: [AppController, ShopController],
  providers: [AppService, ShopService],
})
export class AppModule {}
