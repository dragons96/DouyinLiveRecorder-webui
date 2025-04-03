"use client"

import { useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, Check, Clock, Edit, ExternalLink, StopCircle, Play, Trash, Server, Loader2, RefreshCcw, ChevronDown, ChevronUp, XCircle } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import type { RecordingTask } from "@/types"
import { formatDateTime } from "@/lib/utils"

interface TaskDetailsProps {
  task: RecordingTask
  isAdmin: boolean
  isTaskCreator?: boolean
  isSuperAdmin?: boolean
}

export function TaskDetails({ task, isAdmin, isTaskCreator = false, isSuperAdmin = false }: TaskDetailsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isLoading, setIsLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [localTask, setLocalTask] = useState<RecordingTask>(task)
  const [resourceAssignments, setResourceAssignments] = useState<any>(null)
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(false)
  const [recordingPeriods, setRecordingPeriods] = useState<any[]>([])
  const [isLoadingPeriods, setIsLoadingPeriods] = useState(false)
  const [clearingPeriods, setClearingPeriods] = useState(false)
  const [isPeriodsExpanded, setIsPeriodsExpanded] = useState(true)
  
  // 计算当前用户是否可以管理任务
  const canManageTask = isAdmin || isTaskCreator || isSuperAdmin
  
  // 解析直播链接
  let streamUrls: string[] = []
  try {
    streamUrls = JSON.parse(localTask.streamUrls)
  } catch (error) {
    console.error("Error parsing streamUrls:", error)
  }
  
  // 获取platformParams
  let platformParams: any = {}
  const isDouyinPlatform = localTask.platform?.name === "抖音"

  if (localTask.platformParams) {
    try {
      platformParams = JSON.parse(localTask.platformParams)
    } catch (error) {
      console.error("Error parsing platformParams:", error)
    }
  }
  
  // 显示项目名称的逻辑，尝试从不同来源获取
  const getProjectName = () => {
    if (localTask.project?.name) {
      return localTask.project.name;
    }
    
    // 如果没有project对象但有projectId，显示ID并建议刷新
    if (localTask.projectId) {
      return `项目ID: ${localTask.projectId}`;
    }
    
    return "未分配项目";
  };

  const getStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case 'RUNNING':
        return <Badge className="bg-green-500">运行中</Badge>
      case 'PAUSED':
        return <Badge className="bg-yellow-500 text-white">已暂停</Badge>
      case 'PENDING':
        return <Badge className="bg-yellow-500 text-white">已暂停</Badge>
      case 'FAILED':
        return <Badge variant="destructive">失败</Badge>
      default:
        return <Badge className="bg-yellow-500 text-white">已暂停</Badge>
    }
  }

  const handleStartTask = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/tasks/${localTask.id}/start`, {
        method: "POST",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "启动任务失败")
      }

      // 处理资源分配信息
      if (data.resourceInfo) {
        const { 
          totalStreams, 
          alreadyProcessingStreams, 
          nonShareableStreams, 
          newAllocatedResources 
        } = data.resourceInfo;
        
        // 构建成功消息，包含资源分配详情
        let successMessage = "任务已启动";
        
        // 如果有已经在处理的流，添加这部分信息
        if (alreadyProcessingStreams > 0 || nonShareableStreams > 0) {
          const totalShared = alreadyProcessingStreams;
          const totalNonShareable = nonShareableStreams;
          
          successMessage += `：${totalStreams} 个视频中`;
          
          // 添加共享资源信息
          if (totalShared > 0) {
            successMessage += `有 ${totalShared} 个可共享已有资源`;
          }
          
          // 添加不可共享资源信息
          if (totalNonShareable > 0) {
            if (totalShared > 0) {
              successMessage += `，${totalNonShareable} 个无法共享（属于其他项目）`;
            } else {
              successMessage += `有 ${totalNonShareable} 个无法共享（属于其他项目）`;
            }
          }
          
          // 添加新分配资源信息
          successMessage += `，实际分配了 ${newAllocatedResources} 个新资源。`;
        }
        
        toast.success(successMessage);
      } else {
        toast.success("任务已启动");
      }
      
      // 更新本地任务状态以提供即时反馈
      setLocalTask(prev => ({
        ...prev,
        status: "RUNNING"
      }))
      
      // 使用 router.refresh() 和 startTransition 尝试刷新数据
      startTransition(() => {
        router.refresh()
      })
      
      // 强制重新加载页面，确保数据更新（2秒后）
      setTimeout(() => {
        window.location.reload();
      }, 2000)
    } catch (error: any) {
      toast.error(error.message || "启动任务失败")
      console.error("Error starting task:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleStopTask = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/tasks/${localTask.id}/stop`, {
        method: "POST",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || data.error || "停止任务失败")
      }

      toast.success("任务已停止")
      
      // 更新本地任务状态以提供即时反馈
      setLocalTask(prev => ({
        ...prev,
        status: "PAUSED"
      }))
      
      // 使用 router.refresh() 和 startTransition 尝试刷新数据
      startTransition(() => {
        router.refresh()
      })
      
      // 强制重新加载页面，确保数据更新（2秒后）
      setTimeout(() => {
        window.location.reload();
      }, 2000)
    } catch (error: any) {
      toast.error(error.message || "停止任务失败")
      console.error("Error stopping task:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteTask = async () => {
    setDeleteLoading(true)
    try {
      const response = await fetch(`/api/tasks/${localTask.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "删除任务失败")
      }

      toast.success("任务已删除")
      
      // 导航到任务列表页
      router.push(`/tasks`)
    } catch (error: any) {
      toast.error(error.message || "删除任务失败")
      console.error("Error deleting task:", error)
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleEditTask = () => {
    router.push(`/projects/${localTask.projectId}/tasks/${localTask.id}/edit`)
  }

  // 获取任务的工作节点分配信息
  const fetchResourceAssignments = async () => {
    if (localTask.status !== 'RUNNING') return;
    
    setIsLoadingAssignments(true);
    try {
      const response = await fetch(`/api/tasks/${localTask.id}/workers`);
      if (response.ok) {
        const data = await response.json();
        setResourceAssignments(data);
      }
    } catch (error) {
      console.error("Error fetching task resource assignments:", error);
    } finally {
      setIsLoadingAssignments(false);
    }
  };
  
  // 当任务状态变为运行中时，获取资源分配情况
  useEffect(() => {
    if (localTask.status === 'RUNNING') {
      fetchResourceAssignments();
    }
  }, [localTask.status]);

  // 获取录制时间段记录的函数
  const fetchRecordingPeriods = async () => {
    setIsLoadingPeriods(true);
    try {
      const response = await fetch(`/api/tasks/${localTask.id}/recording-periods`);
      if (response.ok) {
        const data = await response.json();
        setRecordingPeriods(data);
      }
    } catch (error) {
      console.error("Error fetching recording periods:", error);
    } finally {
      setIsLoadingPeriods(false);
    }
  };
  
  // 当组件挂载时获取录制时间段记录
  useEffect(() => {
    fetchRecordingPeriods();
  }, [localTask.id]);

  // 清空录制时间段记录的函数
  const clearRecordingPeriods = async () => {
    if (!confirm('确定要清空所有录制记录吗？此操作无法撤销。')) {
      return;
    }
    
    setClearingPeriods(true);
    try {
      const response = await fetch(`/api/tasks/${localTask.id}/recording-periods`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        const data = await response.json();
        toast.success(`已清空 ${data.count} 条录制记录`);
        // 刷新列表
        await fetchRecordingPeriods();
      } else {
        const error = await response.json();
        throw new Error(error.error || '清空录制记录失败');
      }
    } catch (error: any) {
      toast.error(error.message || '清空录制记录失败');
      console.error('Error clearing recording periods:', error);
    } finally {
      setClearingPeriods(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>任务信息</CardTitle>
        {(canManageTask) && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleEditTask}
            disabled={localTask.status === "RUNNING"}
            title={localTask.status === "RUNNING" ? "请先停止任务再编辑任务" : "编辑任务"}
            className="flex items-center gap-1"
          >
            <Edit className="h-4 w-4" />
            编辑任务
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <h3 className="font-medium">任务名称</h3>
              <p>{localTask.name}</p>
            </div>
            <div>
              <h3 className="font-medium">状态</h3>
              <div className="mt-1">{getStatusBadge(localTask.status)}</div>
            </div>
            <div>
              <h3 className="font-medium">直播平台</h3>
              <div className="flex items-center gap-2">
                <span>{localTask.platform.name}</span>
                {!localTask.platform.enabled && (
                  <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
                    平台已停用
                  </Badge>
                )}
              </div>
            </div>
            <div>
              <h3 className="font-medium">所属项目</h3>
              <p>{getProjectName()}</p>
            </div>
          </div>
          
          {localTask.description && (
            <div>
              <h3 className="font-medium">任务描述</h3>
              <p className="whitespace-pre-wrap">{localTask.description}</p>
            </div>
          )}
          
          {/* 平台特定参数 */}
          <div className="border rounded-md p-4 bg-muted/20">
            <h3 className="font-medium mb-2">平台配置信息</h3>
            
            {/* 直播地址 */}
            {streamUrls && streamUrls.length > 0 && (
              <div className="mt-2">
                <h4 className="text-sm font-medium">直播地址</h4>
                <ul className="mt-1 space-y-2 text-sm">
                  {streamUrls.map((url: string, index: number) => (
                    <li key={index} className="break-all flex items-center">
                      <a 
                        href={url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-blue-600 hover:underline flex items-center"
                      >
                        {url}
                        <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* 抖音平台特定配置 */}
            {isDouyinPlatform && platformParams && (
              <>
                {platformParams.cookie && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium">Cookie</h4>
                    <div className="mt-1 p-2 rounded bg-muted/50 text-xs font-mono break-all">
                      {platformParams.cookie}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          
          {/* 工作节点分配信息 */}
          {localTask.status === 'RUNNING' && (
            <div className="border rounded-md p-4 bg-muted/20">
              <h3 className="font-medium mb-2 flex items-center">
                <Server className="h-4 w-4 mr-2" />
                资源分配信息
                {isLoadingAssignments && (
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                )}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={fetchResourceAssignments} 
                  className="ml-auto h-8 px-2 text-xs"
                  disabled={isLoadingAssignments}
                >
                  刷新
                </Button>
              </h3>
              
              {resourceAssignments ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">总视频数：</span>
                      <span className="font-medium">{resourceAssignments.totalStreams}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">已分配视频数：</span>
                      <span className="font-medium">{resourceAssignments.assignedStreams}</span>
                    </div>
                  </div>
                  
                  {/* 节点统计信息 */}
                  {resourceAssignments.assignmentStats && (
                    <div className="mt-2 text-sm border p-2 rounded-md bg-muted/10">
                      <h4 className="font-medium mb-1">节点分配统计：</h4>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">项目专用节点：</span>
                          <span className="font-medium">{resourceAssignments.assignmentStats.projectNodeAssignments}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">通用节点：</span>
                          <span className="font-medium">{resourceAssignments.assignmentStats.generalNodeAssignments}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">复用节点：</span>
                          <span className="font-medium">{resourceAssignments.assignmentStats.reusedAssignments}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">新分配节点：</span>
                          <span className="font-medium">{resourceAssignments.assignmentStats.newAssignments}</span>
                        </div>
                        
                        {/* 显示保持专用节点不降级的数量 */}
                        {resourceAssignments.assignmentStats.maintainedProjectNodes > 0 && (
                          <div className="col-span-2 flex justify-between mt-1 border-t pt-1">
                            <span className="text-muted-foreground">
                              保持专用节点不降级：
                              <span className="text-xs ml-1 text-amber-500">
                                (之前使用通用节点，现分配专用节点)
                              </span>
                            </span>
                            <span className="font-medium text-green-500">
                              {resourceAssignments.assignmentStats.maintainedProjectNodes}
                            </span>
                          </div>
                        )}
                        
                        {/* 显示跨项目节点数量 */}
                        {resourceAssignments.assignmentStats.crossProjectNodes > 0 && (
                          <div className="col-span-2 flex justify-between border-t pt-1">
                            <span className="text-muted-foreground">
                              跨项目节点数量：
                              <span className="text-xs ml-1 text-amber-500">
                                (无法共享，已分配新节点)
                              </span>
                            </span>
                            <span className="font-medium text-amber-500">
                              {resourceAssignments.assignmentStats.crossProjectNodes}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      <div className="mt-2 text-xs">
                        <div className="flex items-center">
                          <span className="text-muted-foreground">可用节点总数：</span>
                          <span className="ml-1">
                            {resourceAssignments.projectNodeCount + resourceAssignments.generalNodeCount}
                            <span className="text-muted-foreground ml-1">
                              (专用: {resourceAssignments.projectNodeCount}, 通用: {resourceAssignments.generalNodeCount})
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {resourceAssignments.assignments && resourceAssignments.assignments.length > 0 ? (
                    <div className="mt-2">
                      <h4 className="text-sm font-medium mb-1">分配详情：</h4>
                      <div className="text-xs space-y-2 max-h-[200px] overflow-y-auto p-2 bg-muted/30 rounded-md">
                        {resourceAssignments.assignments
                          .filter((assignment: any) => assignment.taskStatus === "PROCESSING")
                          .map((assignment: any, index: number) => (
                          <div key={index} className="p-2 border-b border-muted last:border-0">
                            <div className="flex justify-between">
                              <span className="break-all">
                                视频流: {assignment.streamUrl.substring(0, 40)}...
                              </span>
                              <Badge 
                                variant={
                                  assignment.streamingStatus === "STREAMING" ? "default" :
                                  assignment.streamingStatus === "WAITING" ? "outline" :
                                  "secondary"
                                }
                                className={
                                  assignment.streamingStatus === "STREAMING" ? "bg-green-500" :
                                  assignment.streamingStatus === "WAITING" ? "text-yellow-500 border-yellow-500" :
                                  "bg-gray-200 text-gray-500"
                                }
                              >
                                {assignment.streamingStatus === "STREAMING" ? "上播中" :
                                 assignment.streamingStatus === "WAITING" ? "等待上播" :
                                 "未知"}
                              </Badge>
                               {/* <Badge variant="default">
                                录制中
                              </Badge> */}
                            </div>
                            <div className="mt-1">
                              <span className="text-muted-foreground">分配节点:</span>{" "}
                              <span className="font-mono">
                                {assignment.workerNode.nodeId}
                              </span>
                              <Badge 
                                variant={assignment.workerNode.status === "RUNNING" ? "default" : "destructive"}
                                className="ml-2 text-[10px] px-1"
                              >
                                {assignment.workerNode.status}
                              </Badge>
                              
                              {/* 显示节点所属项目 */}
                              <span className="ml-2 text-muted-foreground">
                                {assignment.workerNode.projectId ? (
                                  <span>
                                    <span className="text-xs">专用节点</span>
                                    {assignment.workerNode.projectId !== localTask.projectId && (
                                      <Badge variant="outline" className="ml-1 text-[10px] px-1 text-amber-500">
                                        其他项目
                                      </Badge>
                                    )}
                                  </span>
                                ) : (
                                  <span className="text-xs">通用节点</span>
                                )}
                              </span>
                            </div>
                            <div className="text-muted-foreground flex items-center">
                              <span>引用计数: {assignment.referenceCount}</span>
                              {assignment.referenceCount > 1 && (
                                <Badge variant="outline" className="ml-2 text-[10px] px-1 text-green-500">
                                  资源共享 (+{assignment.referenceCount - 1})
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                        
                        {resourceAssignments.assignments.filter((a: any) => a.taskStatus === "PROCESSING").length === 0 && (
                          <div className="text-center py-4 text-muted-foreground">
                            当前没有正在录制中的分配
                          </div>
                        )}
                      </div>
                      
                      {/* 资源共享说明 */}
                      <div className="mt-3 text-xs text-muted-foreground p-2 bg-muted/10 rounded-md">
                        <h5 className="font-medium mb-1">资源共享规则:</h5>
                        <ul className="list-disc list-inside space-y-1">
                          <li>同一个视频流在相同项目下的多个任务中只会分配一次工作节点资源</li>
                          <li>通用工作节点（未绑定项目）处理的视频流可以被任何项目的任务共享</li>
                          <li>专用工作节点（绑定特定项目）处理的视频流只能被同一项目的任务共享</li>
                        </ul>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">暂无工作节点分配信息</div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center py-4 text-muted-foreground text-sm">
                  {isLoadingAssignments ? "正在加载资源分配信息..." : "点击刷新按钮获取资源分配信息"}
                </div>
              )}
            </div>
          )}
          
          {/* 任务创建和更新信息 */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <h3 className="font-medium">创建人</h3>
              <p>{localTask.user.name || localTask.user.email}</p>
            </div>
            <div>
              <h3 className="font-medium">创建时间</h3>
              <p>{formatDateTime(localTask.createdAt)}</p>
            </div>
            <div>
              <h3 className="font-medium">最后更新</h3>
              <p>{formatDateTime(localTask.updatedAt)}</p>
            </div>
            {localTask.startedAt && (
              <div>
                <h3 className="font-medium">当前启动时间</h3>
                <p>{formatDateTime(localTask.startedAt)}</p>
              </div>
            )}
            {localTask.endedAt && (
              <div>
                <h3 className="font-medium">上次结束时间</h3>
                <p>{formatDateTime(localTask.endedAt)}</p>
              </div>
            )}
          </div>
          
          {/* 录制时间段记录 */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <h3 className="text-lg font-medium">录制时间段记录</h3>
                {recordingPeriods.length > 0 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setIsPeriodsExpanded(!isPeriodsExpanded)}
                    className="ml-2"
                  >
                    {isPeriodsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                )}
                {recordingPeriods.length > 0 && <Badge className="ml-2">{recordingPeriods.length}</Badge>}
              </div>
              <div className="flex items-center gap-2">
                {recordingPeriods.length > 0 && localTask.status !== "RUNNING" && canManageTask && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={clearRecordingPeriods}
                    disabled={clearingPeriods}
                    className="text-red-500 border-red-200 hover:bg-red-50"
                  >
                    {clearingPeriods ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4 mr-1" />}
                    清空记录
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={fetchRecordingPeriods}
                  disabled={isLoadingPeriods}
                >
                  <RefreshCcw className={`h-4 w-4 mr-2 ${isLoadingPeriods ? "animate-spin" : ""}`} />
                  刷新
                </Button>
              </div>
            </div>
            {isLoadingPeriods ? (
              <div className="flex items-center justify-center py-4 text-muted-foreground text-sm">
                正在加载录制记录...
              </div>
            ) : recordingPeriods.length === 0 ? (
              <div className="flex items-center justify-center py-4 text-muted-foreground text-sm">
                暂无录制记录
              </div>
            ) : (
              <>
                {isPeriodsExpanded && (
                  <div className="space-y-3">
                    {recordingPeriods.map((period) => (
                      <div key={period.id} className="border rounded-md p-3">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                          <div>
                            <span className="font-medium">开始时间: </span>
                            <span>{formatDateTime(period.startedAt)}</span>
                          </div>
                          <div>
                            <span className="font-medium">结束时间: </span>
                            <span>{period.endedAt ? formatDateTime(new Date(period.endedAt)) : <Badge className="bg-green-500 text-white">录制中</Badge>}</span>
                          </div>
                          <div>
                            <span className="font-medium">录制时长: </span>
                            <span>
                              {period.endedAt 
                                ? Math.floor((new Date(period.endedAt).getTime() - new Date(period.startedAt).getTime()) / (1000 * 60)) 
                                : Math.floor((new Date().getTime() - new Date(period.startedAt).getTime()) / (1000 * 60))} 分钟
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {!isPeriodsExpanded && recordingPeriods.length > 0 && (
                  <div className="text-center py-2 text-muted-foreground border rounded-md">
                    点击展开查看 {recordingPeriods.length} 条录制记录
                  </div>
                )}
              </>
            )}
          </div>
          
          {/* 控制按钮 */}
          {canManageTask && (
            <CardFooter className="flex justify-between gap-2">
              {localTask.status === "RUNNING" ? (
                <Button
                  variant="destructive"
                  onClick={handleStopTask}
                  disabled={isLoading}
                  className="flex items-center gap-1"
                >
                  <StopCircle className="h-4 w-4" />
                  {isLoading ? "停止中..." : "停止任务"}
                </Button>
              ) : (
                <Button
                  variant="default"
                  onClick={handleStartTask}
                  disabled={isLoading || localTask.status === "COMPLETED" || !localTask.platform.enabled}
                  className="flex items-center gap-1"
                >
                  <Play className="h-4 w-4" />
                  {isLoading ? "启动中..." : "启动任务"}
                </Button>
              )}
              
              <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="flex items-center gap-1 ml-auto">
                    <Trash className="h-4 w-4" />
                    删除任务
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>确认删除</AlertDialogTitle>
                    <AlertDialogDescription>
                      此操作无法撤销。这将永久删除该任务及其所有相关日志。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteTask}
                      disabled={deleteLoading}
                    >
                      {deleteLoading ? "删除中..." : "确认删除"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardFooter>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

