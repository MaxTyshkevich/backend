import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SessionGuard, type AuthenticatedRequest } from '../auth/session.guard';
import { CsrfGuard } from '../common/guards/csrf.guard';
import { CommentsService } from './comments.service';
import { CommentDto, CommentsQueryDto } from './dto/comment.dto';

@Controller('api')
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get('products/:productId/comments')
  list(
    @Param('productId') productId: string,
    @Query() query: CommentsQueryDto,
  ) {
    return this.comments.list(productId, query);
  }

  @Post('products/:productId/comments')
  @UseGuards(SessionGuard, CsrfGuard)
  create(
    @Param('productId') productId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: CommentDto,
  ) {
    return this.comments.create(productId, request.user.id, body);
  }

  @Patch('comments/:id')
  @UseGuards(SessionGuard, CsrfGuard)
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: CommentDto,
  ) {
    return this.comments.update(id, request.user.id, body);
  }

  @Delete('comments/:id')
  @HttpCode(204)
  @UseGuards(SessionGuard, CsrfGuard)
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.comments.remove(id, request.user.id);
  }
}
