import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { CookieOptions, Response } from 'express';
import { AppConfigService, CurrentUser, Public } from '@app/common';
import type { RequestWithCorrelation } from '@app/common';
import { AuthService } from '../services/auth.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { FcmTokenDto } from '../dto/fcm-token.dto';
import { TokenResponseDto } from '../dto/token-response.dto';
import { RefreshResponseDto } from '../dto/refresh-response.dto';
import { REFRESH_TOKEN_TTL_MS } from '../auth.constants';

const REFRESH_TOKEN_COOKIE = 'refresh_token';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly appConfigService: AppConfigService,
  ) {}

  private refreshCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.appConfigService.nodeEnv === 'production',
      sameSite: 'strict',
      maxAge: REFRESH_TOKEN_TTL_MS,
    };
  }

  private readRefreshCookie(req: RequestWithCorrelation): string | undefined {
    return (req.cookies as Record<string, string> | undefined)?.[
      REFRESH_TOKEN_COOKIE
    ];
  }

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TokenResponseDto> {
    const { accessToken, refreshToken } = await this.authService.login(dto);
    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, this.refreshCookieOptions());
    return { accessToken };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: RequestWithCorrelation,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RefreshResponseDto> {
    const refreshToken = this.readRefreshCookie(req);
    if (!refreshToken) {
      throw new UnauthorizedException('Missing refresh token');
    }
    const { accessToken, refreshToken: newRefreshToken } =
      await this.authService.refresh(refreshToken);
    res.cookie(
      REFRESH_TOKEN_COOKIE,
      newRefreshToken,
      this.refreshCookieOptions(),
    );
    return { accessToken };
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  async logout(
    @Req() req: RequestWithCorrelation,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = this.readRefreshCookie(req);
    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }
    res.clearCookie(REFRESH_TOKEN_COOKIE, this.refreshCookieOptions());
  }

  @Post('fcm-token')
  @HttpCode(200)
  async registerFcmToken(
    @CurrentUser() user: { id: string; email: string },
    @Body() dto: FcmTokenDto,
  ) {
    await this.authService.registerFcmToken(user.id, dto.deviceId, dto.token);
  }

  @Delete('fcm-token/:deviceId')
  async removeFcmToken(
    @CurrentUser() user: { id: string; email: string },
    @Param('deviceId') deviceId: string,
  ) {
    await this.authService.removeFcmToken(user.id, deviceId);
  }

  @Get('me')
  async me(@CurrentUser() user: { id: string; email: string }) {
    return this.authService.getCurrentUser(user.id);
  }
}
