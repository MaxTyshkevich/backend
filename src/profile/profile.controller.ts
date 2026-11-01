import {
  Body,
  Controller,
  Get,
  Patch,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { SessionGuard, type AuthenticatedRequest } from '../auth/session.guard';
import { CsrfGuard } from '../common/guards/csrf.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileService } from './profile.service';

@Controller('api/profile/me')
@UseGuards(SessionGuard, CsrfGuard)
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Get()
  get(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return this.profile.get(request.user.id);
  }

  @Patch()
  update(
    @Req() request: AuthenticatedRequest,
    @Body() body: UpdateProfileDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return this.profile.update(request.user.id, body);
  }
}
