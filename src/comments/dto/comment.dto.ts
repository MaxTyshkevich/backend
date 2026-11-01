import { Transform } from 'class-transformer';
import { IsInt, IsString, Length, Max, Min, ValidateIf } from 'class-validator';

export class CommentDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : (value as unknown),
  )
  @IsString()
  @Length(1, 5000)
  text!: string;
}

const integerQuery = ({ value }: { value: unknown }) =>
  typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;

export class CommentsQueryDto {
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(integerQuery)
  @IsInt()
  @Min(1)
  @Max(100000)
  page: number = 1;

  @ValidateIf((_object, value) => value !== undefined)
  @Transform(integerQuery)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}
