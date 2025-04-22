import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 处理日期时间显示
 * 当数据库中存储的是UTC时间时，需要转换为东八区
 * 当数据库中已经存储了东八区时间时，不需要转换
 * @param date 日期字符串或Date对象
 * @param needConversion 是否需要时区转换（默认不需要，因为数据库中已经是东八区时间）
 * @param format 是否格式化为本地时间字符串
 * @returns 处理后的Date对象或格式化的字符串
 */
export function formatDateTime(date: string | Date, needConversion: boolean = false, format: boolean = true): Date | string {
  // 创建Date对象
  const dateObj = date instanceof Date ? date : new Date(date);
  
  let resultDate: Date;
  
  if (needConversion) {
    // 如果需要时区转换（数据库中是UTC时间）
    // 东八区偏移量 (UTC+8)，单位为分钟
    const offsetMinutes = 8 * 60;
    
    // 获取UTC时间的毫秒数
    const utcTime = dateObj.getTime();
    
    // 添加东八区偏移量
    resultDate = new Date(utcTime + offsetMinutes * 60 * 1000);
  } else {
    // 如果不需要转换（数据库中已经是东八区时间）
    resultDate = dateObj;
  }
  
  // 根据参数决定是返回格式化字符串还是Date对象
  if (format) {
    return resultDate.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  }
  
  return resultDate;
}

// 保留原函数以便向后兼容，但修改默认行为
export function toLocalTime(date: string | Date, format: boolean = true): Date | string {
  // 现在默认不进行时区转换
  return formatDateTime(date, false, format);
}

/**
 * 格式化日期，返回YYYY-MM-DD HH:MM:SS格式的字符串
 * @param date 日期字符串或Date对象
 * @returns 格式化后的日期字符串
 */
export function formatDate(date: string | Date): string {
  return formatDateTime(date, false, true) as string;
}

/**
 * 格式化文件大小
 * @param bytes 文件大小（字节）
 * @param decimals 小数点位数
 * @returns 格式化后的文件大小字符串
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
