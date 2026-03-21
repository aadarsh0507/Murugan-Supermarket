import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const uploadsRootDir = path.resolve(__dirname, '../uploads');
export const itemUploadsDir = path.join(uploadsRootDir, 'items');
export const returnUploadsDir = path.join(uploadsRootDir, 'returns');

export const ensureDirectoryExists = (directoryPath) => {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }

  return directoryPath;
};
