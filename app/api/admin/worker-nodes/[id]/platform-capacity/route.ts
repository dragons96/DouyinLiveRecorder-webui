import { getServerSession } from "next-auth"
import { NextResponse, NextRequest } from "next/server"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

interface RouteParams {
  params: {
    id: string // 工作节点ID
  }
}

// 获取工作节点的平台容量配置
export async function GET(req: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    // 检查用户是否是超级管理员
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "权限不足" }, { status: 403 })
    }

    // 获取工作节点信息
    const workerNode = await db.workerNode.findUnique({
      where: { id: params.id },
      include: {
        platformCapacities: {
          include: {
            platform: {
              select: {
                id: true,
                name: true,
              }
            }
          }
        }
      }
    });

    if (!workerNode) {
      return NextResponse.json({ error: "工作节点不存在" }, { status: 404 })
    }

    // 获取所有平台
    const allPlatforms = await db.platform.findMany({
      select: {
        id: true,
        name: true,
      }
    });

    // 创建完整的平台容量映射
    const platformCapacities = [];
    
    // 遍历所有平台
    for (const platform of allPlatforms) {
      // 查找该平台的容量配置
      const existingCapacity = workerNode.platformCapacities.find(
        cap => cap.platformId === platform.id
      );
      
      if (existingCapacity) {
        // 如果已有配置，直接添加
        platformCapacities.push(existingCapacity);
      } else {
        // 如果没有配置，创建一个默认配置
        platformCapacities.push({
          id: null,
          workerNodeId: workerNode.id,
          platformId: platform.id,
          platform: platform,
          maxRecordings: workerNode.maxRecordings, // 使用工作节点的默认最大录制数
          currentRecordings: 0,
          createdAt: null,
          updatedAt: null,
          // 标记为未配置
          isConfigured: false
        });
      }
    }

    return NextResponse.json({
      workerNode: {
        id: workerNode.id,
        nodeId: workerNode.nodeId,
        status: workerNode.status,
        maxRecordings: workerNode.maxRecordings,
        currentRecordings: workerNode.currentRecordings,
      },
      platformCapacities
    });
  } catch (error) {
    console.error("[WORKER_NODE_PLATFORM_CAPACITY_GET]", error)
    return NextResponse.json({ error: "获取工作节点平台容量失败" }, { status: 500 })
  }
}

// 更新工作节点的平台容量配置
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    // 检查用户是否是超级管理员
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "权限不足" }, { status: 403 })
    }

    // 获取请求数据
    const { platformId, maxRecordings } = await req.json();

    // 数据验证
    if (!platformId || maxRecordings === undefined) {
      return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
    }

    if (maxRecordings < 0) {
      return NextResponse.json({ error: "最大录制数不能为负数" }, { status: 400 });
    }

    // 检查工作节点是否存在
    const workerNode = await db.workerNode.findUnique({
      where: { id: params.id }
    });

    if (!workerNode) {
      return NextResponse.json({ error: "工作节点不存在" }, { status: 404 });
    }

    // 检查平台是否存在
    const platform = await db.platform.findUnique({
      where: { id: platformId }
    });

    if (!platform) {
      return NextResponse.json({ error: "平台不存在" }, { status: 404 });
    }

    // 查找是否已存在平台容量配置
    const existingCapacity = await db.workerNodePlatformCapacity.findUnique({
      where: {
        workerNodeId_platformId: {
          workerNodeId: params.id,
          platformId: platformId
        }
      }
    });

    let updatedCapacity;
    
    if (existingCapacity) {
      // 更新现有配置
      updatedCapacity = await db.workerNodePlatformCapacity.update({
        where: { id: existingCapacity.id },
        data: { 
          maxRecordings: parseInt(maxRecordings.toString())
        }
      });
    } else {
      // 创建新配置
      updatedCapacity = await db.workerNodePlatformCapacity.create({
        data: {
          workerNodeId: params.id,
          platformId: platformId,
          maxRecordings: parseInt(maxRecordings.toString()),
          currentRecordings: 0
        }
      });
    }

    return NextResponse.json({
      success: true,
      capacity: updatedCapacity
    });
  } catch (error) {
    console.error("[WORKER_NODE_PLATFORM_CAPACITY_PUT]", error)
    return NextResponse.json({ error: "更新工作节点平台容量失败" }, { status: 500 })
  }
}

// 删除工作节点的平台容量配置
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    // 检查用户是否是超级管理员
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "权限不足" }, { status: 403 })
    }

    // 获取URL查询参数
    const url = new URL(req.url);
    const platformId = url.searchParams.get('platformId');

    if (!platformId) {
      return NextResponse.json({ error: "缺少平台ID参数" }, { status: 400 });
    }

    // 检查工作节点是否存在
    const workerNode = await db.workerNode.findUnique({
      where: { id: params.id }
    });

    if (!workerNode) {
      return NextResponse.json({ error: "工作节点不存在" }, { status: 404 });
    }

    // 检查是否存在平台容量配置
    const existingCapacity = await db.workerNodePlatformCapacity.findUnique({
      where: {
        workerNodeId_platformId: {
          workerNodeId: params.id,
          platformId: platformId
        }
      }
    });

    if (!existingCapacity) {
      return NextResponse.json({ error: "未找到该平台的容量配置" }, { status: 404 });
    }

    // 删除平台容量配置
    await db.workerNodePlatformCapacity.delete({
      where: { id: existingCapacity.id }
    });

    return NextResponse.json({
      success: true,
      message: "已删除平台容量配置"
    });
  } catch (error) {
    console.error("[WORKER_NODE_PLATFORM_CAPACITY_DELETE]", error)
    return NextResponse.json({ error: "删除工作节点平台容量失败" }, { status: 500 })
  }
} 