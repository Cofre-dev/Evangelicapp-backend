"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTemporaryPassword = generateTemporaryPassword;
const crypto_1 = require("crypto");
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
const DIGITS = '23456789';
const ALL = LETTERS + DIGITS;
function generateTemporaryPassword() {
    const chars = [LETTERS[(0, crypto_1.randomInt)(LETTERS.length)], DIGITS[(0, crypto_1.randomInt)(DIGITS.length)]];
    for (let i = 0; i < 8; i++) {
        chars.push(ALL[(0, crypto_1.randomInt)(ALL.length)]);
    }
    return chars.join('');
}
//# sourceMappingURL=generate-temporary-password.js.map