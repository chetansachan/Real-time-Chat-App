import type { Request, Response } from 'express';
import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import { AuthService, type AuthResult } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import type { PublicUser } from '../users/user.mapper';

interface AuthResponse {
  user: PublicUser;
  accessToken: string;
  expiresIn: number;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly cookieName: string;
  private readonly cookiePath: string;
  private readonly cookieSecure: boolean;
  private readonly refreshTtlSeconds: number;

  constructor(
    private readonly auth: AuthService,
    config: ConfigService,
  ) {
    this.cookieName = config.getOrThrow<string>('cookie.name');
    this.cookiePath = config.getOrThrow<string>('cookie.path');
    this.cookieSecure = config.getOrThrow<boolean>('cookie.secure');
    this.refreshTtlSeconds = config.getOrThrow<number>('refreshTtlSeconds');
  }

  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const result = await this.auth.register(dto);
    this.setRefreshCookie(res, result.refreshToken);
    return this.toBody(result);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const result = await this.auth.login(dto);
    this.setRefreshCookie(res, result.refreshToken);
    return this.toBody(result);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    try {
      const result = await this.auth.refresh(this.readRefreshToken(req));
      this.setRefreshCookie(res, result.refreshToken);
      return this.toBody(result);
    } catch (error) {
      this.clearRefreshCookie(res);
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ success: true }> {
    await this.auth.logout(this.readRefreshToken(req));
    this.clearRefreshCookie(res);
    return { success: true };
  }

  private toBody(result: AuthResult): AuthResponse {
    return {
      user: result.user,
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
    };
  }

  private readRefreshToken(req: Request): string | undefined {
    const cookies = req.cookies as Record<string, unknown> | undefined;
    const value = cookies?.[this.cookieName];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }

  private setRefreshCookie(res: Response, token: string): void {
    res.cookie(this.cookieName, token, {
      httpOnly: true,
      secure: this.cookieSecure,
      sameSite: 'lax',
      path: this.cookiePath,
      maxAge: this.refreshTtlSeconds * 1_000,
    });
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(this.cookieName, {
      httpOnly: true,
      secure: this.cookieSecure,
      sameSite: 'lax',
      path: this.cookiePath,
    });
  }
}
