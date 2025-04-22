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
    const origin = request.headers.get('origin') || request.nextUrl.origin;
    
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
    
    // 计算大致的视频时长（如果不精确也没关系，主要是给播放器一个参考值）
    // TS文件大约每秒2MB (假设值，实际会根据编码和分辨率有变化)
    const estimatedDuration = Math.max(size / (2 * 1024 * 1024), 1);
    
    // 检查是否是TS文件
    if (video.fileType?.toLowerCase() !== 'ts') {
      return NextResponse.json(
        { error: '只支持TS格式的视频生成m3u8' },
        { status: 400 }
      );
    }
    
    // 获取网站的完整URL
    const baseUrl = origin;
    
    // 生成基本的m3u8内容
    // 使用更完整的配置和绝对URL
    const m3u8Content = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:${Math.ceil(estimatedDuration)}
#EXT-X-MEDIA-SEQUENCE:0
#EXTINF:${estimatedDuration.toFixed(1)},
${baseUrl}/api/videos/stream/${videoId}
#EXT-X-ENDLIST`;
    
    // 返回m3u8内容
    return new NextResponse(m3u8Content, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error: any) {
    console.error('生成m3u8错误:', error);
    return NextResponse.json(
      { error: `生成m3u8错误: ${error.message}` },
      { status: 500 }
    );
  }
}

// 处理CORS预检请求
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; 