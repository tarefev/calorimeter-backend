import { Response, CookieOptions } from "express";
export declare const SESSION_COOKIE_NAME = "sid";
export type SessionCookieOptions = {
    maxAgeMs: number;
};
export declare function getCookieOptions(opts: SessionCookieOptions): CookieOptions;
export declare function setSessionCookie(res: Response, sessionId: string, opts: SessionCookieOptions): void;
export declare function clearSessionCookie(res: Response): void;
