import { IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/)
  digestTime?: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}
