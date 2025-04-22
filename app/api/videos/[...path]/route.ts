import { NextRequest, NextResponse } from 'next/server';
import { getFullVideoPath } from '@/lib/storage-utils';
import fs from 'fs';
import path from 'path';

/**
 * 获取视频文件
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    // 构建文件路径
    const pathSegments = params.path;
    const filePath = path.join('storage', 'videos', ...pathSegments);
    const fullPath = getFullVideoPath(filePath);
    
    // 检查文件是否存在
    if (!fs.existsSync(fullPath)) {
      return NextResponse.json(
        { error: '文件不存在' },
        { status: 404 }
      );
    }
    
    // 获取文件的mime类型
    const ext = path.extname(fullPath).toLowerCase();
    let contentType = 'application/octet-stream';
    
    switch (ext) {
      case '.mp4':
        contentType = 'video/mp4';
        break;
      case '.ts':
        contentType = 'video/mp2t';
        break;
      case '.flv':
        contentType = 'video/x-flv';
        break;
      default:
        contentType = 'application/octet-stream';
    }
    
    // 读取文件并返回
    const fileContent = fs.readFileSync(fullPath);
    
    // 检查是否为下载请求
    const isDownload = request.nextUrl.searchParams.get('download') === 'true';
    
    // 创建响应
    const response = new NextResponse(fileContent);
    response.headers.set('Content-Type', contentType);
    
    // 如果是下载请求，设置Content-Disposition为attachment，否则为inline
    if (isDownload) {
      response.headers.set('Content-Disposition', `attachment; filename="${path.basename(fullPath)}"`);
    } else {
      response.headers.set('Content-Disposition', `inline; filename="${path.basename(fullPath)}"`);
    }
    
    return response;
  } catch (error: any) {
    console.error('获取视频文件时出错:', error);
    return NextResponse.json(
      { error: `获取视频文件时出错: ${error.message}` },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs'; 