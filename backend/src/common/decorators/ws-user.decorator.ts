import type { ExecutionContext } from '@nestjs/common';
import { createParamDecorator, UnauthorizedException } from '@nestjs/common';
import type { SocketUser } from '../types/auth-user';

export const WsUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): SocketUser => {
    const socket = context.switchToWs().getClient<{ data?: { user?: SocketUser } }>();
    const user = socket.data?.user;
    if (!user) {
      throw new UnauthorizedException('Socket is not authenticated');
    }
    return user;
  },
);
