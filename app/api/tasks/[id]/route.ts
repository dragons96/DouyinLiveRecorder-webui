import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { checkProjectAccess } from "@/lib/auth-utils"
import { updateWorkerNodeRecordingCount } from "../../admin/worker-nodes/utils"
import { checkUserRole } from "@/lib/auth-utils"
import { validatePlatformUrl } from "@/lib/platform-utils"

interface RouteParams {
  params: {
    id: string
  }
}

interface TaskLivestreamAssignment {
  id: string;
  livestreamId: string;
}

interface LivestreamWorkerAssignment {
  id: string;
  livestreamId: string;
  workerNodeId: string;
  referenceCount: number;
}

// 释放任务占用的直播流资源
async function releaseTaskLivestreams(taskId: string) {
  try {
    // 记录更新过录制数的工作节点ID，用于后续调用updateWorkerNodeRecordingCount
    const updatedWorkerIds = new Set<string>();

    // 查询任务的所有直播流关联
    const taskLivestreamAssignments = await (db as any).taskLivestreamAssignment.findMany({
      where: { taskId },
      include: { livestream: true }
    });

    // 遍历每个任务-直播流关联
    for (const assignment of taskLivestreamAssignments) {
      // 查询直播流与工作节点的关联
      const livestreamWorkerAssignment = await (db as any).livestreamWorkerAssignment.findFirst({
        where: { livestreamId: assignment.livestreamId },
      }) as LivestreamWorkerAssignment | null;

      if (livestreamWorkerAssignment) {
        if (livestreamWorkerAssignment.referenceCount > 1) {
          // 如果引用计数大于1，则减少引用计数
          await (db as any).livestreamWorkerAssignment.update({
            where: { id: livestreamWorkerAssignment.id },
            data: {
              referenceCount: livestreamWorkerAssignment.referenceCount - 1,
            },
          });
        } else {
          // 更新直播流与工作节点的关联状态为COMPLETED，引用计数为0
          await (db as any).livestreamWorkerAssignment.update({
            where: { id: livestreamWorkerAssignment.id },
            data: {
              status: "COMPLETED",
              referenceCount: 0,
            },
          });
        }
        
        // 添加到需要更新录制数的工作节点列表
        updatedWorkerIds.add(livestreamWorkerAssignment.workerNodeId);
      }
    }
    
    // 更新所有涉及到的工作节点的录制数
    for (const workerId of updatedWorkerIds) {
      await updateWorkerNodeRecordingCount(workerId);
    }
  } catch (error) {
    console.error("释放任务直播流资源失败:", error);
    throw error;
  }
}

export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    const { id } = params

    if (!session) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    // 获取任务详情
    const task = await db.recordingTask.findUnique({
      where: {
        id,
      },
    })

    if (!task) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 })
    }

    // 检查权限 - 只有任务创建者或超级管理员可以删除任务
    const isSuperAdmin = await checkUserRole(session.user.id, "SUPER_ADMIN")
    if (task.userId !== session.user.id && !isSuperAdmin) {
      return NextResponse.json({ error: "权限不足" }, { status: 403 })
    }

    // 如果任务正在运行中，先释放工作节点资源
    if (task.status === "RUNNING") {
      await releaseTaskLivestreams(id);
    }

    // 删除任务相关的直播流关联
    await db.taskLivestreamAssignment.deleteMany({
      where: {
        taskId: id,
      },
    })

    // 删除任务日志
    await db.taskLog.deleteMany({
      where: {
        taskId: id,
      },
    })

    // 删除任务
    await db.recordingTask.delete({
      where: {
        id,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[TASK_DELETE]", error)
    return NextResponse.json({ error: "删除任务失败" }, { status: 500 })
  }
}

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    const { id } = params

    if (!session) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    // 获取任务详情
    const task = await db.recordingTask.findUnique({
      where: {
        id,
      },
      include: {
        platform: true,
        project: true,
        logs: {
          orderBy: {
            createdAt: "desc",
          },
          take: 50,
        },
      },
    })

    if (!task) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 })
    }

    // 检查权限 - 只有任务创建者或超级管理员可以查看任务
    const isSuperAdmin = await checkUserRole(session.user.id, "SUPER_ADMIN")
    if (task.userId !== session.user.id && !isSuperAdmin) {
      return NextResponse.json({ error: "权限不足" }, { status: 403 })
    }

    return NextResponse.json(task)
  } catch (error) {
    console.error("[TASK_GET]", error)
    return NextResponse.json({ error: "获取任务详情失败" }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    const { id } = params

    if (!session) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    // 获取任务详情
    const existingTask = await db.recordingTask.findUnique({
      where: {
        id,
      },
      include: {
        platform: true,
      },
    })

    if (!existingTask) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 })
    }

    // 检查权限 - 只有任务创建者或超级管理员可以更新任务
    const isSuperAdmin = await checkUserRole(session.user.id, "SUPER_ADMIN")
    if (existingTask.userId !== session.user.id && !isSuperAdmin) {
      return NextResponse.json({ error: "权限不足" }, { status: 403 })
    }

    const body = await req.json()
    const { name, description, platformId, projectId, platformParams } = body

    // 如果更改了平台，需要检查新平台是否存在
    let platform = existingTask.platform;
    let finalStreamUrls = existingTask.streamUrls;
    
    if (platformId && platformId !== existingTask.platformId) {
      const newPlatform = await db.platform.findUnique({
        where: {
          id: platformId,
        },
      })

      if (!newPlatform) {
        return NextResponse.json({ error: "直播平台不存在" }, { status: 404 })
      }
      
      platform = newPlatform;
    }
    
    // 如果有新的平台参数，需要验证
    if (platformParams) {
      try {
        // 解析平台参数
        let streamUrlsData = [];
        const parsedParams = JSON.parse(platformParams);
        
        // 检查是否直接提供了URL数组
        if (Array.isArray(parsedParams)) {
          streamUrlsData = parsedParams;
        } 
        // 检查是否有liveUrls字段
        else if (parsedParams.liveUrls) {
          // 如果liveUrls是字符串，按行分割
          if (typeof parsedParams.liveUrls === 'string') {
            streamUrlsData = parsedParams.liveUrls
              .split('\n')
              .map((url: string) => url.trim())
              .filter((url: string) => url);
          }
          // 如果liveUrls已经是数组
          else if (Array.isArray(parsedParams.liveUrls)) {
            streamUrlsData = parsedParams.liveUrls;
          }
        }
        
        if (streamUrlsData.length === 0) {
          return NextResponse.json({ error: `${platform.name}平台任务必须提供直播链接列表` }, { status: 400 });
        }
        
        // 验证直播链接格式
        const validUrls = [];
        const invalidUrls = [];
        
        for (const url of streamUrlsData) {
          if (!url || typeof url !== 'string') continue;
          
          const validation = validatePlatformUrl(platform.name, url);
          if (validation.isValid) {
            validUrls.push(url);
          } else {
            invalidUrls.push({ url, message: validation.message });
          }
        }
        
        if (validUrls.length === 0) {
          return NextResponse.json({ 
            error: `所有直播链接格式均不正确，请检查后重试`,
            invalidUrls 
          }, { status: 400 });
        }
        
        // 只保留有效的URL
        finalStreamUrls = JSON.stringify(validUrls);
      } catch (error) {
        return NextResponse.json({ error: "直播地址格式无效" }, { status: 400 });
      }
    }

    // 更新任务
    const updatedTask = await db.recordingTask.update({
      where: {
        id,
      },
      data: {
        name,
        description,
        platformId: platformId || undefined,
        projectId: projectId || undefined,
        platformParams: platformParams || undefined,
        streamUrls: finalStreamUrls || undefined,
      },
    })

    // 记录更新日志
    await db.taskLog.create({
      data: {
        message: "任务信息已更新",
        level: "INFO",
        taskId: id,
      },
    })

    return NextResponse.json(updatedTask)
  } catch (error) {
    console.error("[TASK_PATCH]", error)
    return NextResponse.json({ error: "更新任务失败" }, { status: 500 })
  }
}

