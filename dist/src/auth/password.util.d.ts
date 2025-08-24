export declare function hashPassword(plainPassword: string, saltRounds?: number): Promise<string>;
export declare function verifyPassword(plainPassword: string, passwordHash: string): Promise<boolean>;
