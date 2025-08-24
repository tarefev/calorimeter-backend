import { NextFunction, Request, Response } from "express";
export interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
    };
    sessionId?: string;
}
export declare function sessionMiddleware(): (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
