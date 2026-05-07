import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

interface WrappedResponse<T> {
  success: true;
  data: T;
}

@Injectable()
export class TransformResponseInterceptor<T> implements NestInterceptor<T, WrappedResponse<T>> {
  intercept(_ctx: ExecutionContext, next: CallHandler<T>): Observable<WrappedResponse<T>> {
    return next.handle().pipe(map((data) => ({ success: true as const, data })));
  }
}
