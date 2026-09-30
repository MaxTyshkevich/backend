import { IsString, Length } from 'class-validator';
import { LoginDto } from './login.dto';
import { Transform } from 'class-transformer';

export class RegisterDto extends LoginDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : (value as unknown),
  )
  @IsString()
  @Length(3, 20)
  name!: string;
}
