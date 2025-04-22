import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import fs from 'fs';
import path from 'path';
import { stat } from 'fs/promises';

export async function GET(
  request: NextRequest,
  { params }: { params: { videoId: string } }
) {
  try {
    const videoId = params.videoId;
    
    if (!videoId) {
      return NextResponse.json(
        { error: '需要提供视频ID' },
        { status: 400 }
      );
    }
    
    // 获取视频信息
    const video = await db.recordedVideo.findUnique({
      where: {
        id: videoId
      }
    });
    
    if (!video || !video.filePath) {
      return NextResponse.json(
        { error: '视频未找到或文件路径无效' },
        { status: 404 }
      );
    }
    
    // 检查文件是否存在
    if (!fs.existsSync(video.filePath)) {
      return NextResponse.json(
        { error: '视频文件不存在' },
        { status: 404 }
      );
    }
    
    // 获取文件大小
    const { size } = await stat(video.filePath);
    
    // 获取文件扩展名
    const ext = path.extname(video.filePath).toLowerCase();
    
    // 设置正确的内容类型
    let contentType = 'video/mp4'; // 默认为MP4
    
    if (ext === '.webm') contentType = 'video/webm';
    if (ext === '.ogg') contentType = 'video/ogg';
    if (ext === '.mkv') contentType = 'video/x-matroska';
    if (ext === '.flv') contentType = 'video/x-flv';
    if (ext === '.ts') {
      // 获取请求中的特定参数，用于处理TS格式
      const forceMp4Type = request.nextUrl.searchParams.get('force_mp4');
      
      if (forceMp4Type === 'true') {
        // 某些情况下，将TS文件作为MP4提供可能更兼容
        contentType = 'video/mp4';
      } else {
        // 针对HLS.js，使用标准MIME类型
        contentType = 'video/mp2t';
        
        // 检查Accept头，如果客户端支持octet-stream，也可以使用
        const acceptHeader = request.headers.get('Accept');
        if (acceptHeader && acceptHeader.includes('application/octet-stream')) {
          contentType = 'application/octet-stream';
        }
      }
    }
    
    // 获取Range请求头，支持分段传输
    const range = request.headers.get('range');
    
    // 添加通用响应头, 使用索引签名允许添加任意字符串键
    const commonHeaders: { [key: string]: string } = {
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      // 添加跨域支持
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type',
      // 添加缓存控制，适度缓存以提高性能
      'Cache-Control': 'public, max-age=3600',
    };
    
    if (range) {
      // 处理Range请求
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : size - 1;
      
      // 确保范围有效
      const finalStart = isNaN(start) ? 0 : Math.max(0, start);
      const finalEnd = isNaN(end) ? size - 1 : Math.min(end, size - 1);
      
      // 计算实际读取的内容大小
      const chunkSize = (finalEnd - finalStart) + 1;
      
      // 对于过大的请求范围，可能需要限制大小
      const maxChunkSize = 5 * 1024 * 1024; // 5MB
      const limitedEnd = finalStart + Math.min(chunkSize - 1, maxChunkSize - 1);
      
      // 创建文件流
      const fileStream = fs.createReadStream(video.filePath, { 
        start: finalStart, 
        end: limitedEnd < finalEnd ? limitedEnd : finalEnd
      });
      
      // 添加范围相关的响应头
      const rangeHeaders = {
        ...commonHeaders,
        'Content-Range': `bytes ${finalStart}-${limitedEnd < finalEnd ? limitedEnd : finalEnd}/${size}`,
        'Content-Length': ((limitedEnd < finalEnd ? limitedEnd : finalEnd) - finalStart + 1).toString(),
      };
      
      // 返回206部分内容响应
      return new NextResponse(fileStream as any, {
        status: 206,
        headers: rangeHeaders,
      });
    } else {
      // 获取请求中指定的内容类型
      const requestedType = request.nextUrl.searchParams.get('content_type');
      if (requestedType) {
        // 允许客户端指定返回的内容类型（用于特殊情况）
        if (requestedType === 'mp4' || requestedType === 'video/mp4') {
          commonHeaders['Content-Type'] = 'video/mp4';
        } else if (requestedType === 'ts' || requestedType === 'video/mp2t') {
          commonHeaders['Content-Type'] = 'video/mp2t';
        } else if (requestedType === 'binary' || requestedType === 'application/octet-stream') {
          commonHeaders['Content-Type'] = 'application/octet-stream';
          // 添加下载头，强制下载而非在线播放
          commonHeaders['Content-Disposition'] = `attachment; filename="${path.basename(video.filePath)}"`;
        }
      }
      
      // 小文件或者直接请求时使用整个文件
      // 对于大文件，建议使用Range请求，这里设置一个合理的上限
      const isLargeFile = size > 50 * 1024 * 1024; // 50MB
      
      if (isLargeFile) {
        // 对于大文件，返回一个206响应，提供前5MB内容并提示使用Range
        const chunkSize = 5 * 1024 * 1024; // 5MB
        const fileStream = fs.createReadStream(video.filePath, { start: 0, end: chunkSize - 1 });
        
        return new NextResponse(fileStream as any, {
          status: 206,
          headers: {
            ...commonHeaders,
            'Content-Range': `bytes 0-${chunkSize - 1}/${size}`,
            'Content-Length': chunkSize.toString(),
            'X-Large-File': 'true',
            'X-File-Size': size.toString(),
          },
        });
      } else {
        // 正常的小文件情况
        const fileStream = fs.createReadStream(video.filePath);
        
        return new NextResponse(fileStream as any, {
          status: 200,
          headers: {
            ...commonHeaders,
            'Content-Length': size.toString(),
          },
        });
      }
    }
  } catch (error: any) {
    console.error('视频流处理错误:', error);
    return NextResponse.json(
      { error: `视频流错误: ${error.message}` },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
// 禁用响应体解析，适合流式传输大文件
export const dynamic = 'force-dynamic'; 