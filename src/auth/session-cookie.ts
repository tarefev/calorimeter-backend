import { Response, CookieOptions } from "express";

export const SESSION_COOKIE_NAME = "sid";

export type SessionCookieOptions = {
  maxAgeMs: number;
};

export function getCookieOptions(opts: SessionCookieOptions): CookieOptions {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: opts.maxAgeMs,
    path: "/",
  };
}

export function setSessionCookie(
  res: Response,
  sessionId: string,
  opts: SessionCookieOptions
): void {
  res.cookie(SESSION_COOKIE_NAME, sessionId, getCookieOptions(opts));
}

export function clearSessionCookie(res: Response): void {
  const isProd = process.env.NODE_ENV === "production";
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
  });
}
