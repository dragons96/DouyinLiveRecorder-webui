import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

// 存储文件的基本目录
const STORAGE_DIR = process.env.STORAGE_DIR || path.join(process.cwd(), 'storage');
const VIDEOS_DIR = path.join(STORAGE_DIR, 'videos');

// 确保存储目录存在
export function ensureStorageDirectories() {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
  
  if (!fs.existsSync(VIDEOS_DIR)) {
    fs.mkdirSync(VIDEOS_DIR, { recursive: true });
  }
}

// 获取视频文件的存储路径
export function getVideoStoragePath(recordName: string, fileType: string): string {
  // 生成唯一文件名
  const uuid = randomUUID();
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const dirPath = path.join(VIDEOS_DIR, recordName, dateStr);
  
  // 确保目录存在
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  
  return dirPath;
}

// 保存上传的视频文件
export async function saveVideoFile(
  file: File,
  recordName: string,
  fileType: string
): Promise<{ filePath: string; filename: string; fileSize: number }> {
  const dirPath = getVideoStoragePath(recordName, fileType);
  
  // 生成唯一文件名
  const uuid = randomUUID();
  const originalFilename = file.name;
  const filename = `${uuid}_${originalFilename}`;
  const fullPath = path.join(dirPath, filename);
  
  // 保存文件
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  fs.writeFileSync(fullPath, buffer);
  
  // 获取文件大小
  const stats = fs.statSync(fullPath);
  
  return {
    filePath: path.relative(process.cwd(), fullPath), // 相对路径
    filename: filename,
    fileSize: stats.size
  };
}

// 获取视频文件的URL
export function getVideoUrl(filePath: string): string {
  const relativePath = filePath.replace(/\\/g, '/'); // 替换Windows路径分隔符
  return `/api/videos/${relativePath}`;
}

// 获取视频文件的完整本地路径
export function getFullVideoPath(filePath: string): string {
  if (path.isAbsolute(filePath)) {
    return filePath;
  }
  return path.join(process.cwd(), filePath);
} 