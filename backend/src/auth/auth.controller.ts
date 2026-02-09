import { Controller, Post, Body, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body('nickname') nickname: string,
    @Body('password') password: string,
    @Body('phone') phone?: string,
    @Body('email') email?: string,
    @Body('carPlateNumber') carPlateNumber?: string,
    @Body('carPlateType') carPlateType?: string,
    @Body('carType') carType?: string,
    @Body('carCapacity') carCapacity?: number,
    @Body('carModelAndYear') carModelAndYear?: string,
  ) {
    return this.authService.register(nickname, password, {
      phone,
      email,
      carPlateNumber,
      carPlateType,
      carType,
      carCapacity,
      carModelAndYear,
    });
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body('nickname') nickname: string,
    @Body('password') password: string,
    @Body('device') device?: string,
    @Body('rememberDevice') rememberDevice?: boolean,
    @Req() req?: { ip?: string; headers?: { 'user-agent'?: string } },
  ) {
    const ip = req?.ip;
    const deviceStr = device ?? req?.headers?.['user-agent'] ?? undefined;
    return this.authService.login(nickname, password, deviceStr, ip, !!rememberDevice);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body('nickname') nickname: string) {
    return this.authService.forgotPassword(nickname);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body('token') token: string, @Body('newPassword') newPassword: string) {
    return this.authService.resetPasswordWithToken(token, newPassword);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('admin/generate-reset-token')
  @HttpCode(HttpStatus.OK)
  async generateResetToken(@Body('userId') userId: string, @Req() req: { user: { id: string } }) {
    const token = this.authService.createPasswordResetToken(userId);
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const link = `${baseUrl.replace(/\/$/, '')}/forgot-password?token=${encodeURIComponent(token)}`;
    return { token, link };
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
