import { Controller, Post, Body, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body('nickname') nickname: string,
    @Body('password') password: string,
    @Body('role') role?: string,
  ) {
    return this.authService.register(nickname, password, role);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body('nickname') nickname: string,
    @Body('password') password: string,
    @Body('device') device?: string,
    @Req() req?: { ip?: string },
  ) {
    const ip = req?.ip;
    return this.authService.login(nickname, password, device, ip);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body('nickname') nickname: string) {
    return this.authService.forgotPassword(nickname);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body('refreshToken') refreshToken: string, @Req() req?: { ip?: string }) {
    return this.authService.refresh(refreshToken, req?.ip);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: { user: { id: string }; ip?: string },
    @Body('sessionId') sessionId?: string,
  ) {
    await this.authService.logout(req.user.id, sessionId, req.ip);
    return { ok: true };
  }
}
