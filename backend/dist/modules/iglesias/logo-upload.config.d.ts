import { type FileFilterCallback } from 'multer';
import type { Request } from 'express';
export declare const LOGOS_DIR: string;
export declare const logoMulterOptions: {
    storage: import("multer").StorageEngine;
    fileFilter: (_req: Request, file: Express.Multer.File, callback: FileFilterCallback) => void;
    limits: {
        fileSize: number;
    };
};
