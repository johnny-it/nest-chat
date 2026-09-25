import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request & { id?: string }>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = exception instanceof HttpException ? exception.getResponse() : null;
    const objectBody = typeof body === 'object' && body !== null ? body : {};
    const message =
      typeof body === 'string'
        ? body
        : 'message' in objectBody
          ? String(objectBody.message)
          : 'Внутренняя ошибка сервера';
    response.status(status).json({
      code: 'code' in objectBody ? String(objectBody.code) : `HTTP_${status}`,
      message,
      ...('fieldErrors' in objectBody ? { fieldErrors: objectBody.fieldErrors } : {}),
      requestId: request.id ?? response.getHeader('x-request-id') ?? 'unknown',
    });
  }
}
