import { getServerSession } from "next-auth"
import { NextResponse, NextRequest } from "next/server"
import { authOptions } from "@/lib/auth"
import { updateAllWorkerNodesRecordingCounts, updateWorkerNodeRecordingCount } from "../utils"

// 更新单个或所有工作节点的录制数计数
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    // 检查用户是否是超级管理员
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "权限不足" }, { status: 403 })
    }

    // 获取请求体
    const data = await req.json()
    const { workerNodeId } = data

    let result

    if (workerNodeId) {
      // 更新单个工作节点的录制数
      result = await updateWorkerNodeRecordingCount(workerNodeId)
      return NextResponse.json({ 
        success: true, 
        message: `工作节点(${workerNodeId})录制数已更新`, 
        currentRecordings: result 
      })
    } else {
      // 更新所有工作节点的录制数
      result = await updateAllWorkerNodesRecordingCounts()
      return NextResponse.json({ 
        success: true, 
        message: `所有工作节点录制数已更新`, 
        updatedCount: result 
      })
    }
  } catch (error: any) {
    console.error("更新工作节点录制数失败:", error)
    return NextResponse.json(
      { error: error.message || "更新工作节点录制数失败" },
      { status: 500 }
    )
  }
} 