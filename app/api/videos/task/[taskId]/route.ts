import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

export async function GET(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const taskId = (await params).taskId;
    
    if (!taskId) {
      return NextResponse.json(
        { error: '需要提供任务ID' },
        { status: 400 }
      );
    }

    // 从URL参数中获取分页、筛选和排序参数
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const recordUrl = searchParams.get('recordUrl') || undefined;
    const searchTerm = searchParams.get('searchTerm') || undefined;
    const sortField = searchParams.get('sortField') || 'createdAt';
    const sortDirection = searchParams.get('sortDirection') || 'desc';

    console.log('请求参数:', { page, pageSize, recordUrl, searchTerm, sortField, sortDirection });

    // 获取所有视频数据进行筛选
    // 注：这不是最高效的方式，但对于处理复杂筛选条件是可行的方案
    let videos = await db.recordedVideo.findMany({
      where: { taskId },
      include: {
        task: {
          select: {
            id: true,
            name: true
          }
        },
        period: {
          select: {
            id: true,
            startedAt: true,
            endedAt: true
          }
        }
      }
    });
    
    // 在内存中筛选视频链接
    if (recordUrl && recordUrl.trim() !== '') {
      videos = videos.filter(video => {
        if (!video.metadata) return false;
        try {
          const metadata = JSON.parse(video.metadata as string);
          return metadata.recordUrl === recordUrl;
        } catch (e) {
          return false;
        }
      });
    }
    
    // 在内存中筛选文件名
    if (searchTerm && searchTerm.trim() !== '') {
      const term = searchTerm.trim().toLowerCase();
      videos = videos.filter(video => 
        (video.filename && video.filename.toLowerCase().includes(term)) ||
        (video.recordName && video.recordName.toLowerCase().includes(term)) ||
        (video.originalFilename && video.originalFilename.toLowerCase().includes(term))
      );
    }
    
    // 在内存中排序
    const sortVideoData = (a: any, b: any) => {
      let valueA, valueB;
      
      switch (sortField) {
        case 'fileSize':
          valueA = a.fileSize;
          valueB = b.fileSize;
          break;
        case 'createdAt':
          valueA = new Date(a.createdAt).getTime();
          valueB = new Date(b.createdAt).getTime();
          break;
        case 'filename':
        default:
          // 使用originalFilename进行排序，如果不存在则回退到filename
          valueA = (a.originalFilename ? a.originalFilename : a.filename).toLowerCase();
          valueB = (b.originalFilename ? b.originalFilename : b.filename).toLowerCase();
          break;
      }
      
      if (sortDirection === 'asc') {
        return valueA > valueB ? 1 : -1;
      } else {
        return valueA < valueB ? 1 : -1;
      }
    };
    
    videos.sort(sortVideoData);
    
    // 计算总数和页数
    const totalCount = videos.length;
    const totalPages = Math.ceil(totalCount / pageSize) || 1; // 至少1页
    
    // 分页处理
    const paginatedVideos = videos.slice(
      (page - 1) * pageSize,
      page * pageSize
    );
    
    // 获取唯一的视频链接列表
    const uniqueRecordUrls = await getUniqueRecordUrls(taskId);

    // 返回结果
    return NextResponse.json({
      success: true,
      data: paginatedVideos.map(video => ({
        id: video.id,
        filename: video.filename,
        originalFilename: video.originalFilename,
        fileSize: video.fileSize,
        fileType: video.fileType,
        recordName: video.recordName,
        createdAt: video.createdAt,
        taskName: video.task?.name || null,
        periodInfo: video.period ? {
          id: video.period.id,
          startedAt: video.period.startedAt,
          endedAt: video.period.endedAt
        } : null,
        metadata: video.metadata ? JSON.parse(video.metadata as string) : null
      })),
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages
      },
      filterOptions: {
        recordUrls: uniqueRecordUrls
      }
    });
  } catch (error: any) {
    console.error('获取任务视频列表错误:', error);
    console.error('错误堆栈:', error.stack);
    return NextResponse.json(
      { error: `获取视频列表失败: ${error.message}` },
      { status: 500 }
    );
  }
}

// 获取唯一的视频链接列表
async function getUniqueRecordUrls(taskId: string): Promise<string[]> {
  try {
    // 获取所有视频元数据
    const videos = await db.recordedVideo.findMany({
      where: { taskId },
      select: { metadata: true }
    });
    
    // 提取并去重recordUrl
    const recordUrls = videos
      .map(video => {
        if (!video.metadata) return null;
        try {
          const metadata = JSON.parse(video.metadata as string);
          return metadata.recordUrl;
        } catch (e) {
          return null;
        }
      })
      .filter((url): url is string => url !== null && url !== undefined);
    
    return [...new Set(recordUrls)];
  } catch (error) {
    console.error('获取视频链接列表错误:', error);
    return [];
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; 