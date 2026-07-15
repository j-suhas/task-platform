import { IsString } from 'class-validator';

export class FcmTokenDto {
  @IsString()
  token!: string;

  @IsString()
  deviceId!: string;
}
