import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';

@Controller()
export class AppController {
  @Public()
  @Get()
  root() {
    return {
      name: 'RelaxDrive API',
      version: '1.0.0',
      docs: {
        health: '/health',
        auth: '/auth/login (POST), /auth/register (POST)',
        api: '/orders, /users, /audit, ...',
      },
    };
  }
}
