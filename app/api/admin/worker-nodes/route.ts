import { getServerSession } from "next-auth"
import { NextResponse, NextRequest } from "next/server"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { updateAllWorkerNodesRecordingCounts } from "./utils"

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    // 检查用户是否是超级管理员
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "权限不足" }, { status: 403 })
    }

    // 获取请求中的参数
    const url = new URL(req.url)
    const skipCountUpdate = url.searchParams.get("skipCountUpdate") === "true"

    // 如果没有指定跳过更新，那么先更新所有工作节点的录制数
    if (!skipCountUpdate) {
      await updateAllWorkerNodesRecordingCounts();
    }

    // 获取工作节点列表
    const workerNodes = await (db as any).workerNode.findMany({
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    })

    return NextResponse.json(workerNodes)
  } catch (error) {
    console.error("[WORKER_NODES_GET]", error)
    return NextResponse.json({ error: "获取工作节点失败" }, { status: 500 })
  }
}

// 创建新工作节点
export async function POST(req: NextRequest) {
  try {
    const { nodeId, maxRecordings, platformId, projectId } = await req.json();

    // 数据验证
    if (!nodeId || !maxRecordings || !platformId) {
      return NextResponse.json({ error: "缺少必要字段" }, { status: 400 });
    }

    // 检查平台是否存在
    const platform = await (db as any).platform.findUnique({
      where: { id: platformId },
    });
    if (!platform) {
      return NextResponse.json({ error: "平台不存在" }, { status: 404 });
    }

    // 如果提供了projectId，检查项目是否存在
    if (projectId) {
      const project = await (db as any).project.findUnique({
        where: { id: projectId },
      });
      if (!project) {
        return NextResponse.json({ error: "项目不存在" }, { status: 404 });
      }
    }

    // 检查nodeId是否已存在
    const existingNode = await (db as any).workerNode.findUnique({
      where: { nodeId },
    });
    if (existingNode) {
      return NextResponse.json({ error: "工作节点ID已存在" }, { status: 400 });
    }

    // 创建工作节点
    const workerNode = await (db as any).workerNode.create({
      data: {
        nodeId,
        maxRecordings: parseInt(maxRecordings),
        platformId,
        projectId, // 可以是null（通用节点）或特定项目ID
      },
    });

    return NextResponse.json(workerNode);
  } catch (error: any) {
    console.error("创建工作节点出错:", error);
    return NextResponse.json(
      { error: error.message || "创建工作节点失败" },
      { status: 500 }
    );
  }
}

// 更新工作节点
export async function PUT(req: NextRequest) {
  try {
    const { id, maxRecordings, status, projectId } = await req.json();

    // 数据验证
    if (!id) {
      return NextResponse.json({ error: "缺少工作节点ID" }, { status: 400 });
    }

    // 检查工作节点是否存在
    const existingNode = await (db as any).workerNode.findUnique({
      where: { id },
    });
    if (!existingNode) {
      return NextResponse.json({ error: "工作节点不存在" }, { status: 404 });
    }

    // 如果提供了projectId，检查项目是否存在
    if (projectId !== undefined) { // 允许设置为null（通用节点）
      if (projectId !== null) {
        const project = await (db as any).project.findUnique({
          where: { id: projectId },
        });
        if (!project) {
          return NextResponse.json({ error: "项目不存在" }, { status: 404 });
        }
      }
    }

    // 准备更新数据
    const updateData: any = {};
    if (maxRecordings !== undefined) updateData.maxRecordings = parseInt(maxRecordings);
    if (status !== undefined) updateData.status = status;
    if (projectId !== undefined) updateData.projectId = projectId;

    // 更新工作节点
    const workerNode = await (db as any).workerNode.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(workerNode);
  } catch (error: any) {
    console.error("更新工作节点出错:", error);
    return NextResponse.json(
      { error: error.message || "更新工作节点失败" },
      { status: 500 }
    );
  }
} 