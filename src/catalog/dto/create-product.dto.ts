import { Transform } from 'class-transformer';
import { IsInt, IsString, Length, Matches, Max, Min } from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateProductDto {
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  id!: string;

  @Transform(trim)
  @IsString()
  @Length(1, 200)
  title!: string;

  @Transform(trim)
  @IsString()
  @Length(1, 10000)
  description!: string;

  @IsInt()
  @Min(0)
  @Max(2147483647)
  priceMinor!: number;

  @Transform(trim)
  @IsString()
  @Length(1, 100)
  categoryId!: string;
}
