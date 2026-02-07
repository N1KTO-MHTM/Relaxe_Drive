import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';
import { logger } from '../common/logger';
import type { Role } from '../common/types/role';

export interface TokenPayload {
  sub: string;
  nickname: string;
  role: string;
  type: 'access' | 'refresh';
}

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private config: ConfigService,
    private audit: AuditService,
  ) { }

  async register(
    nickname: string,
    password: string,
    opts?: {
      role?: string;
      phone?: string;
      email?: string;
      carPlateNumber?: string;
      carId?: string;
      carType?: string;
      carCapacity?: number;
      carModelAndYear?: string;
    },
  ) {
    // New registrations are DRIVER only; role override not accepted from public register
    const role: Role = 'DRIVER';
    // Drivers must fill phone and car type to submit for pending approval
    if (!opts?.phone?.trim()) {
      throw new BadRequestException('Phone is required for driver registration.');
    }
    if (!opts?.carType?.trim()) {
      throw new BadRequestException('Car type is required for driver registration.');
    }
    const created = await this.usersService.create({
      nickname,
      password,
      role,
      phone: opts?.phone,
      email: opts?.email,
      carPlateNumber: opts?.carPlateNumber,
      carId: opts?.carId,
      carType: opts?.carType,
      carCapacity: opts?.carCapacity,
      carModelAndYear: opts?.carModelAndYear,
    });
    await this.audit.log(created.id, 'user.create', 'user', {
      nickname: created.nickname,
      role: created.role,
      email: created.email ?? undefined,
      driverId: created.driverId ?? undefined,
    });
    return created;
  }

  async validateUser(nickname: string, password: string) {
    const user = await this.usersService.findByNicknameForLogin(nickname);
    if (user && (await bcrypt.compare(password, user.passwordHash))) {
      const { passwordHash, ...result } = user;
      return result;
    }
    return null;
  }

  async login(nickname: string, password: string, device?: string, ip?: string, rememberDevice = false) {
    const user = await this.validateUser(nickname, password);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (user.blocked) throw new UnauthorizedException('Account is blocked');
    if (user.role === 'DRIVER' && user.approvedAt == null) {
      throw new UnauthorizedException(`Account pending approval. Please contact support. Status for user ${user.id} is still pending.`);
    }
    if (user.bannedUntil && user.bannedUntil > new Date()) {
      throw new UnauthorizedException(`Account temporarily banned. Reason: ${user.banReason || 'Not specified'}`);
    }
    let sessionId: string | undefined;
    try {
      const session = await this.usersService.createSession(user.id, device, ip);
      sessionId = session.id;
    } catch (e) {
      logger.warn('createSession failed', 'AuthService', { err: String(e) });
    }
    const refreshTtl = rememberDevice ? this.config.get('JWT_REFRESH_TTL_REMEMBER', '30d') : this.config.get('JWT_REFRESH_TTL', '7d');
    const accessToken = this.jwtService.sign(
      { sub: user.id, nickname: user.nickname, role: user.role, type: 'access' } as TokenPayload,
      { expiresIn: this.config.get('JWT_ACCESS_TTL', '15m') },
    );
    const refreshToken = this.jwtService.sign(
      { sub: user.id, type: 'refresh' } as TokenPayload,
      { expiresIn: refreshTtl },
    );
    const loginPayload = { nickname: user.nickname, device: device ?? null, phone: user.phone ?? null };
    try {
      await this.audit.log(user.id, 'auth.login', 'session', loginPayload, ip);
      await this.audit.log(user.id, 'user.login', 'user', loginPayload, ip);
    } catch (e) {
      logger.warn('audit.log failed', 'AuthService', { err: String(e) });
    }
    return {
      accessToken,
      refreshToken,
      expiresIn: this.config.get('JWT_ACCESS_TTL', '15m'),
      user: {
        id: user.id,
        nickname: user.nickname,
        role: user.role,
        locale: user.locale ?? 'en',
        email: user.email ?? undefined,
        phone: user.phone ?? undefined,
        ...(user.role === 'DRIVER' && {
          driverId: user.driverId ?? undefined,
          carId: user.carId ?? undefined,
          carType: user.carType ?? undefined,
          carPlateNumber: user.carPlateNumber ?? undefined,
          carCapacity: user.carCapacity ?? undefined,
          carModelAndYear: user.carModelAndYear ?? undefined,
        }),
      },
      sessionId: sessionId ?? null,
    };
  }

  async refresh(refreshToken: string, ip?: string) {
    try {
      const payload = this.jwtService.verify<TokenPayload>(refreshToken);
      if (payload.type !== 'refresh') throw new UnauthorizedException();
      const user = await this.usersService.findById(payload.sub);
      if (!user) throw new UnauthorizedException();
      const accessToken = this.jwtService.sign(
        { sub: user.id, nickname: user.nickname, role: user.role, type: 'access' } as TokenPayload,
        { expiresIn: this.config.get('JWT_ACCESS_TTL', '15m') },
      );
      return { accessToken, expiresIn: this.config.get('JWT_ACCESS_TTL', '15m') };
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async logout(userId: string, sessionId?: string, ip?: string) {
    if (sessionId) await this.usersService.revokeSession(sessionId);
    await this.audit.log(userId, 'auth.logout', 'session', {}, ip);
  }

  async forgotPassword(nickname: string) {
    await this.audit.log(null, 'auth.forgot_password_request', 'user', { nickname });
    return { ok: true, message: 'If this user exists, contact your administrator to reset the password.' };
  }

  /** One-time password reset token (admin generates for user). Valid 24h. */
  createPasswordResetToken(userId: string) {
    return this.jwtService.sign(
      { sub: userId, type: 'password_reset' as const },
      { expiresIn: this.config.get('JWT_RESET_TTL', '24h') },
    );
  }

  /** Reset password using token from admin-generated link. */
  async resetPasswordWithToken(token: string, newPassword: string) {
    if (!newPassword || newPassword.length < 6) {
      throw new UnauthorizedException('Password must be at least 6 characters');
    }
    try {
      const payload = this.jwtService.verify<{ sub: string; type: string }>(token);
      if (payload.type !== 'password_reset') throw new UnauthorizedException('Invalid token');
      const user = await this.usersService.findById(payload.sub);
      if (!user) throw new UnauthorizedException('Invalid token');
      await this.usersService.setPassword(payload.sub, newPassword);
      await this.audit.log(payload.sub, 'auth.password_reset_via_token', 'user', {});
      return { ok: true };
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException('Invalid or expired reset link');
    }
  }
}
