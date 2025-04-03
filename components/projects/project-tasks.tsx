"use client"

import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Project } from "@/types"
import { useRouter } from "next/navigation"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Play, Pause, AlertTriangle, Edit, Eye, AlertCircle, Loader2 } from "lucide-react"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface ProjectTasksProps {
  project: Project
  isAdmin: boolean
  currentUserId: string
}

export function ProjectTasks({ project, isAdmin, currentUserId }: ProjectTasksProps) {
  const router = useRouter()
  const [loadingTaskId, setLoadingTaskId] = useState<string | null>(null)
  const [recordingStatus, setRecordingStatus] = useState<Record<string, {
    totalStreams: number;
    activeStreams: number;
    stoppedNodes: Array<{ nodeId: string; status: string; streamUrl: string }>;
  }>>({})

  // 判断用户是否是项目成员
  const isMember = project.users.some(user => user.id === currentUserId) || project.managers.some(manager => manager.id === currentUserId)

  // 检查当前用户是否是任务创建者
  const isTaskCreator = (taskUserId: string) => taskUserId === currentUserId

  // 获取任务状态对应的徽章显示
  const getStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case 'RUNNING':
        return <Badge className="bg-green-500">运行中</Badge>
      case 'STOPPED':
        return <Badge variant="outline">已停止</Badge>
      case 'COMPLETED':
        return <Badge variant="secondary">已完成</Badge>
      case 'FAILED':
        return <Badge variant="destructive">失败</Badge>
      default:
        return <Badge variant="outline">未开始</Badge>
    }
  }

  // 添加获取录制状态的函数
  const fetchRecordingStatus = async (taskId: string) => {
    if (taskId && project.tasks.find(t => t.id === taskId)?.status === "RUNNING") {
      try {
        const response = await fetch(`/api/tasks/${taskId}/recording-status`);
        if (response.ok) {
          const data = await response.json();
          setRecordingStatus(prev => ({
            ...prev,
            [taskId]: data
          }));
        }
      } catch (error) {
        console.error("Error fetching recording status:", error);
      }
    }
  }

  // 在组件渲染后获取正在运行的任务的录制状态
  useEffect(() => {
    const runningTasks = project.tasks.filter(task => task.status === "RUNNING");
    runningTasks.forEach(task => {
      fetchRecordingStatus(task.id);
    });
    
    // 设置定时器，每30秒刷新一次状态
    const intervalId = setInterval(() => {
      runningTasks.forEach(task => {
        fetchRecordingStatus(task.id);
      });
    }, 30000);
    
    return () => clearInterval(intervalId);
  }, [project.tasks]);

  // 渲染录制状态的函数
  const renderRecordingStatus = (task: any) => {
    // 只有运行中的任务才显示录制状态
    if (task.status !== "RUNNING") {
      return <span className="text-muted-foreground">-</span>;
    }
    
    const status = recordingStatus[task.id];
    if (!status) {
      return <span className="text-muted-foreground">加载中...</span>;
    }
    
    const { totalStreams, activeStreams, stoppedNodes } = status;
    
    // 如果有停止的节点，显示警告图标并添加tooltip
    if (stoppedNodes && stoppedNodes.length > 0) {
      return (
        <div className="flex items-center">
          <span className="mr-2">{activeStreams}/{totalStreams}</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <AlertCircle className="h-4 w-4 text-amber-500" />
              </TooltipTrigger>
              <TooltipContent>
                <div>
                  <p className="font-medium">以下工作节点已停止:</p>
                  <ul className="text-xs mt-1">
                    {stoppedNodes.map((node, idx) => (
                      <li key={idx}>
                        {node.nodeId} ({node.status}) - {node.streamUrl.substring(0, 20)}...
                      </li>
                    ))}
                  </ul>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      );
    }
    
    return <span>{activeStreams}/{totalStreams}</span>;
  };

  // 处理任务操作
  const handleTaskAction = async (taskId: string, action: string) => {
    setLoadingTaskId(taskId)
    try {
      const response = await fetch(`/api/tasks/${taskId}/${action}`, {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error(`Failed to ${action} task`)
      }

      toast.success(`任务${action === 'start' ? '启动' : '停止'}成功`)
      
      // 如果任务启动成功，5秒后获取录制状态
      if (action === 'start') {
        setTimeout(() => {
          fetchRecordingStatus(taskId);
        }, 5000);
      }
      
      router.refresh()
    } catch (error) {
      console.error(`Error ${action} task:`, error)
      toast.error(`任务${action === 'start' ? '启动' : '停止'}失败`)
    } finally {
      setLoadingTaskId(null)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>录制任务</CardTitle>
          <CardDescription>管理项目的直播录制任务</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {project.tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <p className="text-sm text-muted-foreground">暂无录制任务</p>
            <p className="text-xs text-muted-foreground mt-1">请前往<Link href="/tasks" className="text-primary hover:underline">录制任务</Link>页面创建任务</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>任务名称</TableHead>
                  <TableHead>平台</TableHead>
                  <TableHead>创建人</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>录制情况</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {project.tasks.map((task) => {
                  // 判断当前用户是否可以编辑此任务（项目管理员或任务创建者）
                  const canManageTask = isAdmin || isTaskCreator(task.userId);
                  return (
                    <TableRow key={task.id}>
                      <TableCell className="font-medium">
                        <Link href={`/projects/${project.id}/tasks/${task.id}`} className="hover:underline">
                          {task.name}
                        </Link>
                      </TableCell>
                      <TableCell>{task.platform.name}</TableCell>
                      <TableCell>{task.user.name || task.user.email}</TableCell>
                      <TableCell>{getStatusBadge(task.status)}</TableCell>
                      <TableCell>{renderRecordingStatus(task)}</TableCell>
                      <TableCell>{new Date(task.createdAt).toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" disabled={loadingTaskId === task.id}>
                              {loadingTaskId === task.id ? 
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div> : 
                                <MoreHorizontal className="h-4 w-4" />
                              }
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/projects/${project.id}/tasks/${task.id}`}>
                                <Eye className="mr-2 h-4 w-4" />
                                查看详情
                              </Link>
                            </DropdownMenuItem>
                            {canManageTask && task.status !== 'RUNNING' && (
                              <DropdownMenuItem 
                                onClick={() => handleTaskAction(task.id, 'start')}
                                disabled={loadingTaskId === task.id}
                              >
                                <Play className="mr-2 h-4 w-4" />
                                启动任务
                              </DropdownMenuItem>
                            )}
                            {canManageTask && task.status === 'RUNNING' && (
                              <DropdownMenuItem 
                                onClick={() => handleTaskAction(task.id, 'stop')}
                                disabled={loadingTaskId === task.id}
                              >
                                <Pause className="mr-2 h-4 w-4" />
                                停止任务
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

