import { Body, Controller, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiBody, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { loginSchema, registerSchema } from '@nestchat/contracts';
import { parseInput } from '../common/validation';
import { AuthService, type AuthResult, type SessionMeta } from './auth.service';

const COOKIE_NAME = 'nestchat_refresh';

@Controller('auth')
@ApiTags('Авторизация')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Создать аккаунт' })
  @ApiBody({ schema: { type: 'object', required: ['username', 'password'], properties: { username: { type: 'string', example: 'ivan_petrov' }, password: { type: 'string', format: 'password', example: 'password123' }, displayName: { type: 'string', example: 'Иван Петров' } } } })
  async register(@Body() body: unknown, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.respond(await this.auth.register(parseInput(registerSchema, body), this.meta(request)), response);
  }

  @Post('login')
  @ApiOperation({ summary: 'Войти' })
  @ApiBody({ schema: { type: 'object', required: ['username', 'password'], properties: { username: { type: 'string', example: 'ivan_petrov' }, password: { type: 'string', format: 'password', example: 'password123' } } } })
  async login(@Body() body: unknown, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.respond(await this.auth.login(parseInput(loginSchema, body), this.meta(request)), response);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Обновить токен доступа' })
  @ApiCookieAuth('refresh-cookie')
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.respond(await this.auth.refresh(request.cookies?.[COOKIE_NAME] ?? '', this.meta(request)), response);
  }

  @Post('logout')
  @ApiOperation({ summary: 'Завершить текущую сессию' })
  @ApiCookieAuth('refresh-cookie')
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.auth.logout(request.cookies?.[COOKIE_NAME]);
    response.clearCookie(COOKIE_NAME, { path: '/api/auth' });
    return { success: true };
  }

  private respond(result: AuthResult, response: Response) {
    response.cookie(COOKIE_NAME, result.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/api/auth',
      maxAge: 30 * 24 * 60 * 60 * 1_000,
    });
    return { accessToken: result.accessToken, user: result.user };
  }

  private meta(request: Request): SessionMeta {
    return { userAgent: request.get('user-agent') ?? null, ipAddress: request.ip ?? null };
  }
}
