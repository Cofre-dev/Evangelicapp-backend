import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { Strategy } from 'passport-jwt';
import { JwtPayload } from '../../../common/interfaces/jwt-payload.interface';
export interface JwtRefreshPayload extends JwtPayload {
    refreshToken: string;
}
declare const JwtRefreshStrategy_base: new (...args: any[]) => Strategy;
export declare class JwtRefreshStrategy extends JwtRefreshStrategy_base {
    private readonly config;
    constructor(config: ConfigService);
    validate(req: Request, payload: JwtPayload): JwtRefreshPayload;
}
export {};
