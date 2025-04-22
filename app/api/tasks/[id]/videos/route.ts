import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getVideoUrl } from '@/lib/storage-utils';

/**
 * 获取任务的录制视频列表
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const taskId = params.id;
    
    // 查询任务以检查它是否存在
    const task = await db.recordingTask.findUnique({
      where: { id: taskId },
    });
    
    if (!task) {
      return NextResponse.json(
        { error: '任务不存在' },
        { status: 404 }
      );
    }
    
    // 查询与任务关联的所有视频
    const videos = await db.recordedVideo.findMany({
      where: { taskId },
      orderBy: { uploadedAt: 'desc' },
      include: {
        period: {
          select: {
            id: true,
            startedAt: true,
            endedAt: true
          }
        }
      }
    });
    
    // 为每个视频添加访问URL
    const videosWithUrls = videos.map(video => ({
      ...video,
      url: getVideoUrl(video.filePath),
      // 格式化大小为 MB
      formattedSize: `${(video.fileSize / (1024 * 1024)).toFixed(2)} MB`,
    }));
    
    return NextResponse.json(videosWithUrls);
  } catch (error: any) {
    console.error('获取视频列表时出错:', error);
    return NextResponse.json(
      { error: `获取视频列表时出错: ${error.message}` },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; 