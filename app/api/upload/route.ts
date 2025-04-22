import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureStorageDirectories, saveVideoFile } from '@/lib/storage-utils';
import path from 'path';
import fs from 'fs';
import { Readable } from 'stream';

// 确保存储目录存在
ensureStorageDirectories();

/**
 * 处理视频文件上传
 */
export async function POST(request: NextRequest) {
  try {
    // 检查授权
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json(
        { error: '未提供授权令牌' },
        { status: 401 }
      );
    }
    
    // 处理文件上传（multipart/form-data）
    const formData = await request.formData();
    
    // 从表单数据中获取记录信息，而不是从请求头
    const recordName = formData.get('record_name') as string;
    const recordUrl = formData.get('record_url') as string;
    const fileType = formData.get('file_type') as string || 'UNKNOWN';
    const deviceId = formData.get('device_id') as string;
    const file = formData.get('file') as File;
    
    if (!recordName) {
      return NextResponse.json(
        { error: '未提供记录名称' },
        { status: 400 }
      );
    }
    
    if (!file) {
      return NextResponse.json(
        { error: '未提供文件' },
        { status: 400 }
      );
    }
    
    console.log(`接收上传请求: 名称=${recordName}, URL=${recordUrl}, 类型=${fileType}, 设备=${deviceId}`);
    console.log(`请求来源: ${request.headers.get('User-Agent')}`);
    console.log(`请求路径: ${request.url}`);
    console.log(`请求头: ${JSON.stringify(Object.fromEntries([...request.headers]))}`);
    
    // 查找相关任务 - 首先尝试通过记录URL匹配
    let task = null;
    try {
      if (recordUrl) {
        // 1. 首先尝试通过streamUrls字段内容匹配
        task = await db.recordingTask.findFirst({
          where: {
            streamUrls: {
              contains: recordUrl
            }
          },
          include: {
            recordingPeriods: {
              orderBy: {
                startedAt: 'desc'
              },
              take: 1,
            }
          }
        });
        
        if (!task) {
          // 2. 查找与URL相关的直播流
          const livestream = await db.liveStream.findFirst({
            where: {
              url: recordUrl
            },
            include: {
              taskAssignments: {
                include: {
                  task: {
                    include: {
                      recordingPeriods: {
                        orderBy: {
                          startedAt: 'desc'
                        },
                        take: 1,
                      }
                    }
                  }
                }
              }
            }
          });
          
          if (livestream && livestream.taskAssignments && livestream.taskAssignments.length > 0) {
            // 找到关联任务
            task = livestream.taskAssignments[0].task;
          }
        }
      }
      
      // 3. 如果通过URL未找到，尝试通过名称匹配
      if (!task) {
        task = await db.recordingTask.findFirst({
          where: {
            name: {
              contains: recordName
            }
          },
          include: {
            recordingPeriods: {
              orderBy: {
                startedAt: 'desc'
              },
              take: 1,
            }
          }
        });
      }
      
      console.log(`任务查找结果: ${task ? `找到任务 ${task.id} (${task.name})` : '未找到匹配任务'}`);
    } catch (error) {
      console.error('查找任务时出错:', error);
    }
    
    // 保存文件到磁盘
    const { filePath, filename, fileSize } = await saveVideoFile(file, recordName, fileType);
    
    // 获取当前活跃的录制期间（如果有）
    let periodId = null;
    if (task && task.recordingPeriods && task.recordingPeriods.length > 0) {
      const latestPeriod = task.recordingPeriods[0];
      // 如果最近的录制期间没有结束时间或者在24小时内，关联到这个期间
      if (!latestPeriod.endedAt || 
          (new Date().getTime() - new Date(latestPeriod.startedAt).getTime()) < 24 * 60 * 60 * 1000) {
        periodId = latestPeriod.id;
      }
    }
    
    // 在数据库中创建文件记录
    const recordedVideo = await db.recordedVideo.create({
      data: {
        filename,
        originalFilename: file.name,
        filePath,
        fileSize,
        fileType,
        recordName,
        taskId: task?.id, // 如果找到匹配任务，关联任务ID
        periodId, // 关联录制期间
        metadata: JSON.stringify({
          recordUrl: recordUrl || null,
          deviceId: deviceId || null,
          uploadTime: new Date().toISOString()
        })
      }
    });
    
    // 返回成功响应
    return NextResponse.json({
      success: true,
      message: '文件上传成功',
      data: {
        id: recordedVideo.id,
        filename: recordedVideo.filename,
        fileType: recordedVideo.fileType,
        fileSize: recordedVideo.fileSize,
        taskId: task?.id || null,
        taskName: task?.name || null
      }
    });
  } catch (error: any) {
    console.error('文件上传处理错误:', error);
    return NextResponse.json(
      { error: `上传处理错误: ${error.message}` },
      { status: 500 }
    );
  }
}

// 配置API路由
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const config = {
  api: {
    // 禁用默认的 bodyParser，以支持大文件上传
    bodyParser: false,
  },
}; 