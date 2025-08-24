"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashPassword = hashPassword;
exports.verifyPassword = verifyPassword;
const bcrypt = require("bcrypt");
const DEFAULT_SALT_ROUNDS = 12;
async function hashPassword(plainPassword, saltRounds = DEFAULT_SALT_ROUNDS) {
    if (!plainPassword) {
        throw new Error("Password must be a non-empty string");
    }
    return bcrypt.hash(plainPassword, saltRounds);
}
async function verifyPassword(plainPassword, passwordHash) {
    if (!plainPassword || !passwordHash) {
        return false;
    }
    return bcrypt.compare(plainPassword, passwordHash);
}
//# sourceMappingURL=password.util.js.map