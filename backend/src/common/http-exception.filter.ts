import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus, HttpException } from '@nestjs/common';
import { Response } from 'express';
import { logger } from './logger';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const message =
      exception instanceof HttpException
        ? exception.message
        : exception instanceof Error
          ? exception.message
          : 'Internal Server Error';
    if (status >= 500) {
      logger.error('HTTP 5xx', 'HttpExceptionFilter', {
        status,
        message,
        stack: exception instanceof Error ? exception.stack : undefined,
      });
    }
    res.status(status).json(
      exception instanceof HttpException && typeof exception.getResponse() === 'object'
        ? exception.getResponse()
        : { statusCode: status, message },
    );
  }
}
