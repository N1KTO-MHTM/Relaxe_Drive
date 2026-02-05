import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';
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
  ) {}

  async register(nickname: string, password: string, role?: string) {
    const r = (role === 'ADMIN' || role === 'DRIVER' ? role : 'DISPATCHER') as Role;
    return this.usersService.create({ nickname, password, role: r });
  }

  async validateUser(nickname: string, password: string) {
    const user = await this.usersService.findByNickname(nickname);
    if (user && (await bcrypt.compare(password, user.passwordHash))) {
      const { passwordHash, ...result } = user;
      return result;
    }
    return null;
  }

  async login(nickname: string, password: string, device?: string, ip?: string) {
    const user = await this.validateUser(nickname, password);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const session = await this.usersService.createSession(user.id, device, ip);
    const accessToken = this.jwtService.sign(
      { sub: user.id, nickname: user.nickname, role: user.role, type: 'access' } as TokenPayload,
      { expiresIn: this.config.get('JWT_ACCESS_TTL', '15m') },
    );
    const refreshToken = this.jwtService.sign(
      { sub: user.id, type: 'refresh' } as TokenPayload,
      { expiresIn: this.config.get('JWT_REFRESH_TTL', '7d') },
    );
    await this.audit.log(user.id, 'auth.login', 'session', { nickname: user.nickname }, ip);
    return {
      accessToken,
      refreshToken,
      expiresIn: this.config.get('JWT_ACCESS_TTL', '15m'),
      user: { id: user.id, nickname: user.nickname, role: user.role, locale: user.locale },
      sessionId: session.id,
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
}
