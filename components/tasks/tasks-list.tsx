"use client"

import { useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { MoreHorizontal, Play, Pause, AlertTriangle, AlertCircle, Loader2, ArrowDown, ArrowUp } from "lucide-react"
import { useSession } from "next-auth/react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface ExtendedRecordingTask {
  id: string
  name: string
  description: string | null
  status: string
  createdAt: Date
  updatedAt: Date
  userId: string
  projectId: string
  platformId: string
  user: {
    id: string
    name: string | null
    email: string
  }
  platform: {
    id: string
    name: string
    enabled: boolean
  }
  project?: {
    id: string
    name: string
  }
  logs?: any[]
}

interface TasksListProps {
  tasks: ExtendedRecordingTask[]
  isAdmin?: boolean
  projectId?: string
  showProject?: boolean
  isSuperAdmin?: boolean
}

export function TasksList({ tasks, isAdmin = false, projectId, showProject = false, isSuperAdmin = false }: TasksListProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const [isPending, startTransition] = useTransition()
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({})
  const [sortBy, setSortBy] = useState<'createdAt' | 'name' | 'status'>('createdAt')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [recordingStatus, setRecordingStatus] = useState<Record<string, {
    totalStreams: number;
    activeStreams: number;
    stoppedNodes: Array<{ nodeId: string; status: string; streamUrl: string }>;
  }>>({})
  const [streamingStatus, setStreamingStatus] = useState<Record<string, {
    totalStreams: number;
    streamingCount: number;
  }>>({})

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Badge variant="outline">待启动</Badge>
      case "RUNNING":
        return <Badge className="bg-green-500 text-white">录制中</Badge>
      case "PAUSED":
        return <Badge className="bg-yellow-500 text-white">已暂停</Badge>
      case "FAILED":
        return <Badge variant="destructive">失败</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const handleStatusChange = async (taskId: string, status: string) => {
    setIsLoading((prev) => ({ ...prev, [taskId]: true }))

    try {
      const response = await fetch(`/api/tasks/${taskId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      })

      if (!response.ok) {
        throw new Error("操作失败")
      }

      toast.success("任务状态已更新")
      router.refresh()
    } catch (error) {
      toast.error("操作失败")
      console.error("Error updating task status:", error)
    } finally {
      setIsLoading((prev) => ({ ...prev, [taskId]: false }))
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    if (window.confirm("确定要删除此任务吗？此操作无法撤销。")) {
      setIsLoading(prev => ({ ...prev, [taskId]: true }));
      
      try {
        const response = await fetch(`/api/tasks/${taskId}`, {
          method: "DELETE",
        });
        
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "删除任务失败");
        }
        
        toast.success("任务已删除");
        
        // 刷新页面以更新任务列表
        startTransition(() => {
          router.refresh();
        });
      } catch (error: any) {
        console.error("删除任务失败:", error);
        toast.error(error.message || "删除任务失败");
      } finally {
        setIsLoading(prev => ({ ...prev, [taskId]: false }));
      }
    }
  }

  const handleStart = async (taskId: string) => {
    setIsLoading(prev => ({ ...prev, [taskId]: true }));
    
    try {
      const response = await fetch(`/api/tasks/${taskId}/start`, {
        method: "POST",
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "启动任务失败");
      }
      
      // 更新本地任务状态
      const taskIndex = sortedTasks.findIndex(t => t.id === taskId);
      if (taskIndex !== -1) {
        const updatedTasks = [...sortedTasks];
        updatedTasks[taskIndex].status = "RUNNING";
      }

      // 刷新页面以更新任务列表
      startTransition(() => {
        router.refresh();
      });
      
      // 2秒后强制刷新，确保UI状态最新
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      
      toast.success("任务已启动");
      
      // 获取录制状态
      setTimeout(() => {
        fetchRecordingStatus(taskId);
      }, 1000);
      
    } catch (error: any) {
      toast.error(error.message || "启动任务失败");
    } finally {
      setIsLoading(prev => ({ ...prev, [taskId]: false }));
    }
  };

  const handleStop = async (taskId: string) => {
    setIsLoading(prev => ({ ...prev, [taskId]: true }));
    
    try {
      const response = await fetch(`/api/tasks/${taskId}/stop`, {
        method: "POST",
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "停止任务失败");
      }
      
      // 更新本地任务状态
      const taskIndex = sortedTasks.findIndex(t => t.id === taskId);
      if (taskIndex !== -1) {
        const updatedTasks = [...sortedTasks];
        updatedTasks[taskIndex].status = "PAUSED";
      }

      // 刷新页面以更新任务列表
      startTransition(() => {
        router.refresh();
      });
      
      // 2秒后强制刷新，确保UI状态最新
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      
      toast.success("任务已暂停");
    } catch (error: any) {
      console.error("停止任务失败:", error);
      toast.error(error.message || "停止任务失败");
    } finally {
      setIsLoading(prev => ({ ...prev, [taskId]: false }));
    }
  };

  // 处理排序
  const handleSort = (column: 'createdAt' | 'name' | 'status') => {
    if (sortBy === column) {
      // 如果已经在按这列排序，切换排序方向
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      // 否则，按新列排序，默认降序
      setSortBy(column)
      setSortDirection('desc')
    }
  }

  // 获取排序图标
  const getSortIcon = (column: 'createdAt' | 'name' | 'status') => {
    if (sortBy !== column) return null
    return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4 ml-1" /> : <ArrowDown className="h-4 w-4 ml-1" />
  }

  // 根据当前排序状态排序任务
  const sortedTasks = [...tasks].sort((a, b) => {
    if (sortBy === 'createdAt') {
      const dateA = new Date(a.createdAt).getTime()
      const dateB = new Date(b.createdAt).getTime()
      return sortDirection === 'asc' ? dateA - dateB : dateB - dateA
    } else if (sortBy === 'name') {
      return sortDirection === 'asc' 
        ? a.name.localeCompare(b.name) 
        : b.name.localeCompare(a.name)
    } else if (sortBy === 'status') {
      return sortDirection === 'asc' 
        ? a.status.localeCompare(b.status) 
        : b.status.localeCompare(a.status)
    }
    return 0
  })

  // 检查当前用户是否为任务创建者
  const isTaskCreator = (task: ExtendedRecordingTask) => {
    if (!session?.user?.id) return false;
    return task.userId === session.user.id;
  };

  // 检查用户是否有权限操作任务（超级管理员、项目管理员或任务创建者）
  const canManageTask = (task: ExtendedRecordingTask) => {
    if (isSuperAdmin) return true;
    if (isAdmin) return true;
    return isTaskCreator(task);
  };

  // 添加获取录制状态的函数
  const fetchRecordingStatus = async (taskId: string) => {
    if (taskId && tasks.find(t => t.id === taskId)?.status === "RUNNING") {
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

  // 添加获取上播状态的函数
  const fetchStreamingStatus = async (taskId: string) => {
    if (taskId && tasks.find(t => t.id === taskId)?.status === "RUNNING") {
      try {
        const response = await fetch(`/api/tasks/${taskId}/streaming-status`);
        if (response.ok) {
          const data = await response.json();
          setStreamingStatus(prev => ({
            ...prev,
            [taskId]: data
          }));
        }
      } catch (error) {
        console.error("Error fetching streaming status:", error);
      }
    }
  }

  // 在组件渲染后获取正在运行的任务的录制状态和上播状态
  useEffect(() => {
    const runningTasks = tasks.filter(task => task.status === "RUNNING");
    runningTasks.forEach(task => {
      fetchRecordingStatus(task.id);
      fetchStreamingStatus(task.id);
    });
    
    // 设置定时器，每30秒刷新一次状态
    const intervalId = setInterval(() => {
      runningTasks.forEach(task => {
        fetchRecordingStatus(task.id);
        fetchStreamingStatus(task.id);
      });
    }, 30000);
    
    return () => clearInterval(intervalId);
  }, [tasks]);

  // 渲染录制状态的函数
  const renderRecordingStatus = (task: ExtendedRecordingTask) => {
    // 只有运行中的任务才显示录制状态
    if (task.status !== "RUNNING") {
      return <div className="flex justify-center"><span className="text-muted-foreground">-</span></div>;
    }
    
    const status = recordingStatus[task.id];
    if (!status) {
      return <div className="flex justify-center"><span className="text-muted-foreground">加载中...</span></div>;
    }
    
    const { totalStreams, activeStreams, stoppedNodes } = status;
    
    // 如果有停止的节点，显示警告图标并添加tooltip
    if (stoppedNodes && stoppedNodes.length > 0) {
      return (
        <div className="flex items-center justify-center">
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
    
    return <div className="flex justify-center"><span>{activeStreams}/{totalStreams}</span></div>;
  };

  // 渲染上播状态的函数
  const renderStreamingStatus = (task: ExtendedRecordingTask) => {
    // 只有运行中的任务才显示上播状态
    if (task.status !== "RUNNING") {
      return <div className="flex justify-center"><span className="text-muted-foreground">-</span></div>;
    }
    
    const status = streamingStatus[task.id];
    if (!status) {
      return <div className="flex justify-center"><span className="text-muted-foreground">加载中...</span></div>;
    }
    
    const { totalStreams, streamingCount } = status;
    
    // 移除绿色高亮，使用普通黑色文本
    return <div className="flex justify-center"><span>{streamingCount}/{totalStreams}</span></div>;
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>录制任务列表</CardTitle>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertTriangle className="h-8 w-8 text-muted-foreground" />
            <h3 className="mt-2 text-lg font-semibold">暂无任务</h3>
            <p className="text-sm text-muted-foreground">暂无录制任务</p>
          </div>
        ) : (
          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 transition-colors" 
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center">
                      任务名称 {getSortIcon('name')}
                    </div>
                  </TableHead>
                  <TableHead>直播平台</TableHead>
                  {showProject && <TableHead>所属项目</TableHead>}
                  <TableHead>创建人</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 transition-colors" 
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center justify-center">
                      状态 {getSortIcon('status')}
                    </div>
                  </TableHead>
                  <TableHead className="text-center">录制情况</TableHead>
                  <TableHead className="text-center">上播情况</TableHead>
                  <TableHead>快捷操作</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 transition-colors text-center" 
                    onClick={() => handleSort('createdAt')}
                  >
                    <div className="flex items-center justify-center">
                      创建时间 {getSortIcon('createdAt')}
                    </div>
                  </TableHead>
                  <TableHead className="text-right">更多操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedTasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium whitespace-nowrap">
                      <Link href={`/projects/${task.projectId}/tasks/${task.id}`} className="hover:underline">
                        {task.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {task.platform.name}
                        {!task.platform.enabled && (
                          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
                            平台已停用
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    {showProject && (
                      <TableCell>
                        <Link href={`/projects/${task.projectId}`} className="hover:underline">
                          {task.project?.name || `项目ID: ${task.projectId}`}
                        </Link>
                      </TableCell>
                    )}
                    <TableCell>{task.user.name || task.user.email}</TableCell>
                    <TableCell className="text-center">{getStatusBadge(task.status)}</TableCell>
                    <TableCell className="text-center">{renderRecordingStatus(task)}</TableCell>
                    <TableCell className="text-center">{renderStreamingStatus(task)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {(canManageTask(task) && (task.status === "PENDING" || task.status === "PAUSED") && task.platform.enabled) ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStart(task.id)}
                            disabled={isLoading[task.id]}
                            className="h-7 px-2"
                          >
                            {isLoading[task.id] ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3 mr-1" />}
                            启动
                          </Button>
                        ) : null}
                        
                        {(canManageTask(task) && task.status === "RUNNING") ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStop(task.id)}
                            disabled={isLoading[task.id]}
                            className="h-7 px-2"
                          >
                            {isLoading[task.id] ? <Loader2 className="h-3 w-3 animate-spin" /> : <Pause className="h-3 w-3 mr-1" />}
                            暂停
                          </Button>
                        ) : null}
                        
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-center">{new Date(task.createdAt).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" disabled={isLoading[task.id]}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/projects/${task.projectId}/tasks/${task.id}`}>查看详情</Link>
                          </DropdownMenuItem>
                          {canManageTask(task) && (
                            <DropdownMenuItem
                              onClick={() => handleDeleteTask(task.id)}
                              disabled={isLoading[task.id]}
                              className="text-destructive"
                            >
                              删除任务
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
} 