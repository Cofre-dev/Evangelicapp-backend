"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logoMulterOptions = exports.LOGOS_DIR = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const multer_1 = require("multer");
const path_1 = require("path");
exports.LOGOS_DIR = (0, path_1.join)(process.cwd(), 'uploads', 'logos');
if (!(0, fs_1.existsSync)(exports.LOGOS_DIR)) {
    (0, fs_1.mkdirSync)(exports.LOGOS_DIR, { recursive: true });
}
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024;
exports.logoMulterOptions = {
    storage: (0, multer_1.diskStorage)({
        destination: exports.LOGOS_DIR,
        filename: (_req, file, callback) => {
            callback(null, `${(0, crypto_1.randomUUID)()}${(0, path_1.extname)(file.originalname).toLowerCase()}`);
        },
    }),
    fileFilter: (_req, file, callback) => {
        if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
            callback(new common_1.BadRequestException('El logo debe ser PNG, JPG o WEBP'));
            return;
        }
        callback(null, true);
    },
    limits: { fileSize: MAX_LOGO_SIZE_BYTES },
};
//# sourceMappingURL=logo-upload.config.js.map