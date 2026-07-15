import { IsString } from 'class-validator';

export class LinkedUrlDto {
  @IsString()
  title!: string;

  @IsString()
  url!: string;
}
