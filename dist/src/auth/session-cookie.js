"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SESSION_COOKIE_NAME = void 0;
exports.getCookieOptions = getCookieOptions;
exports.setSessionCookie = setSessionCookie;
exports.clearSessionCookie = clearSessionCookie;
exports.SESSION_COOKIE_NAME = "sid";
function getCookieOptions(opts) {
    const isProd = process.env.NODE_ENV === "production";
    return {
        httpOnly: true,
        secure: isProd,
        sameSite: "lax",
        maxAge: opts.maxAgeMs,
        path: "/",
    };
}
function setSessionCookie(res, sessionId, opts) {
    res.cookie(exports.SESSION_COOKIE_NAME, sessionId, getCookieOptions(opts));
}
function clearSessionCookie(res) {
    const isProd = process.env.NODE_ENV === "production";
    res.clearCookie(exports.SESSION_COOKIE_NAME, {
        httpOnly: true,
        secure: isProd,
        sameSite: "lax",
        path: "/",
    });
}
//# sourceMappingURL=session-cookie.js.map