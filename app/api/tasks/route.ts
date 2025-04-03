import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { validatePlatformUrl } from "@/lib/platform-utils"

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    const body = await req.json()
    const { name, description, platformId, projectId, platformParams, enabled } = body

    if (!name || !platformId || !projectId) {
      return NextResponse.json({ error: "请填写所有必填字段" }, { status: 400 })
    }

    // 检查项目是否存在
    const project = await db.project.findUnique({
      where: {
        id: projectId,
      },
    })

    if (!project) {
      return NextResponse.json({ error: "项目不存在" }, { status: 404 })
    }

    // 检查是否有权限创建该项目的任务
    // 超级管理员可以在任何项目中创建任务
    const isSuperAdmin = session.user.role === "SUPER_ADMIN";
    if (!isSuperAdmin) {
      const userProject = await db.project.findFirst({
        where: {
          id: projectId,
          OR: [
            {
              users: {
                some: {
                  id: session.user.id,
                },
              },
            },
            {
              managers: {
                some: {
                  id: session.user.id,
                },
              },
            },
          ],
        },
      })

      if (!userProject) {
        return NextResponse.json({ error: "无权在此项目中创建任务" }, { status: 403 })
      }
    }

    // 检查平台是否存在
    const platform = await db.platform.findUnique({
      where: {
        id: platformId,
      },
    })

    if (!platform) {
      return NextResponse.json({ error: "直播平台不存在" }, { status: 404 })
    }
    
    // 验证直播地址
    let streamUrlsData = [];
    
    if (platformParams) {
      try {
        // 解析平台参数
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
        streamUrlsData = validUrls;
      } catch (error) {
        console.error("解析平台参数错误:", error);
        return NextResponse.json({ error: "直播地址格式无效" }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: "必须提供平台参数" }, { status: 400 });
    }

    // 准备任务数据
    const taskData = {
      name,
      description,
      platformId,
      projectId,
      platformParams: platformParams,
      streamUrls: JSON.stringify(streamUrlsData),
      enabled: enabled ?? true,
      userId: session.user.id,
      status: "PAUSED",
    }

    try {
      // 创建任务
      const task = await db.recordingTask.create({
        data: taskData,
      })
      
      console.log("任务创建成功:", task.id)

      // 添加任务创建日志
      await db.taskLog.create({
        data: {
          message: `任务已创建${enabled === false ? '（禁用状态）' : ''}`,
          level: "INFO",
          taskId: task.id,
        },
      })

      // 同步创建直播流记录和任务-直播流关联
      if (Array.isArray(streamUrlsData) && streamUrlsData.length > 0) {
        for (const streamUrl of streamUrlsData) {
          // 查找或创建LiveStream记录
          let liveStream = await (db as any).liveStream.findUnique({
            where: { url: streamUrl }
          });

          if (!liveStream) {
            liveStream = await (db as any).liveStream.create({
              data: {
                url: streamUrl,
                platformId
              }
            });
            console.log(`创建新直播流: ${liveStream.id} (${streamUrl})`);
          }

          // 创建任务与直播流的关联
          await (db as any).taskLivestreamAssignment.create({
            data: {
              taskId: task.id,
              livestreamId: liveStream.id,
              status: "PENDING"
            }
          });
        }
      }

      return NextResponse.json(task, { status: 201 })
    } catch (error) {
      console.error("Create task error:", error)
      return NextResponse.json({ error: "创建任务失败" }, { status: 500 })
    }
  } catch (error) {
    console.error("POST /api/tasks error:", error)
    return NextResponse.json({ error: "内部服务器错误" }, { status: 500 })
  }
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get("projectId")

    // 构建查询条件
    const where: any = {
      userId: session.user.id,
    }

    if (projectId) {
      where.projectId = projectId
    }

    // 获取用户的所有任务
    const tasks = await db.recordingTask.findMany({
      where,
      include: {
        platform: true,
        project: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    return NextResponse.json(tasks)
  } catch (error) {
    console.error("GET /api/tasks error:", error)
    return NextResponse.json({ error: "获取任务列表失败" }, { status: 500 })
  }
}

