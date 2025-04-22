import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * 获取任务录制视频的统计信息
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
    
    // 获取视频文件总数
    const totalVideos = await db.recordedVideo.count({
      where: { taskId },
    });
    
    // 获取不同类型视频的数量
    const videosByType = await db.$queryRaw`
      SELECT fileType, COUNT(*) as count, SUM(fileSize) as totalSize
      FROM recorded_videos
      WHERE taskId = ${taskId}
      GROUP BY fileType
    `;
    
    // 计算总存储大小
    const totalSize = await db.recordedVideo.aggregate({
      where: { taskId },
      _sum: {
        fileSize: true,
      },
    });
    
    // 获取最近上传的5个视频
    const recentVideos = await db.recordedVideo.findMany({
      where: { taskId },
      orderBy: { uploadedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        filename: true,
        fileType: true,
        fileSize: true,
        uploadedAt: true,
      },
    });
    
    // 组装统计信息
    const stats = {
      totalVideos,
      totalSizeBytes: totalSize._sum.fileSize || 0,
      // 转换为MB
      totalSizeMB: (totalSize._sum.fileSize || 0) / (1024 * 1024),
      videosByType,
      recentVideos,
    };
    
    return NextResponse.json(stats);
  } catch (error: any) {
    console.error('获取视频统计信息时出错:', error);
    return NextResponse.json(
      { error: `获取视频统计信息时出错: ${error.message}` },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; 