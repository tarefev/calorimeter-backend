import { Request, Response } from "express";
type RegisterDto = {
    email: string;
    password: string;
};
export declare class AuthController {
    register(dto: RegisterDto, res: Response): Promise<Response<any, Record<string, any>>>;
    login(dto: RegisterDto, res: Response): Promise<Response<any, Record<string, any>>>;
    logout(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    me(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    createLinkToken(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    confirmLink(req: Request, body: {
        token?: string;
        telegramUserId?: string;
    }, res: Response): Promise<Response<any, Record<string, any>>>;
}
export {};
