import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ShopController } from './shop.controller';
import { ShopService } from './shop.service';
import { DatabaseService } from './database.service';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

@Module({
  imports: [ConfigModule.forRoot()],
  controllers: [AppController, ShopController, AuthController],
  providers: [AppService, ShopService, DatabaseService, AuthService],
})
export class AppModule {}
