"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Edit, Save, X } from "lucide-react"
import { toast } from "@/components/ui/use-toast"

interface PlatformCapacity {
  id: string
  platformId: string
  maxRecordings: number
  currentRecordings: number
  platform: {
    id: string
    name: string
  }
}

interface WorkerNode {
  id: string
  nodeId: string
  status: string
  maxRecordings: number
  currentRecordings: number
  lastSeenAt: string | null
  projectId: string | null
  createdAt: string
  updatedAt: string
  project?: {
    id: string
    name: string
  } | null
  platformCapacities?: PlatformCapacity[]
}

interface WorkerNodesListProps {
  workerNodes: WorkerNode[]
  isAdmin?: boolean
  isSuperAdmin?: boolean
  platforms?: { id: string; name: string }[]
}

export function WorkerNodesList({ workerNodes, isAdmin = false, isSuperAdmin = false, platforms = [] }: WorkerNodesListProps) {
  const [editMode, setEditMode] = useState<{nodeId: string, platformId: string} | null>(null);
  const [inputValue, setInputValue] = useState<number>(0);
  const [isUpdating, setIsUpdating] = useState(false);

  const getStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case "RUNNING":
        return <Badge className="bg-green-500 text-white">运行中</Badge>
      case "STOPPED":
        return <Badge variant="secondary">已停止</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const formatLastSeen = (lastSeen: string | null) => {
    if (!lastSeen) return "从未连接"
    try {
      return formatDistanceToNow(new Date(lastSeen), { addSuffix: true, locale: zhCN })
    } catch (e) {
      return "未知"
    }
  }

  // 检查工作节点是否关联了项目
  const hasProject = (node: WorkerNode) => {
    return !!node.projectId && !!node.project;
  }

  // 获取节点在特定平台的容量信息
  const getPlatformCapacity = (node: WorkerNode, platformId: string) => {
    if (!node.platformCapacities) return null;
    return node.platformCapacities.find(cap => cap.platformId === platformId);
  }
  
  // 计算节点在所有平台的最大录制数总和
  const calculateTotalMaxRecordings = (node: WorkerNode) => {
    if (!node.platformCapacities || node.platformCapacities.length === 0) {
      return node.maxRecordings;
    }
    
    // 只计算启用中平台的容量
    return node.platformCapacities
      .filter(capacity => 
        // 检查平台是否在传入的platforms列表中（即为启用状态）
        platforms.some(p => p.id === capacity.platformId)
      )
      .reduce(
        (sum, capacity) => sum + capacity.maxRecordings, 
        0
      );
  }
  
  // 获取所有平台的当前录制数总和
  const getTotalCurrentRecordings = (node: WorkerNode) => {
    if (!node.platformCapacities || node.platformCapacities.length === 0) {
      return node.currentRecordings;
    }
    
    // 只计算启用中平台的当前录制数
    return node.platformCapacities
      .filter(capacity => 
        // 检查平台是否在传入的platforms列表中（即为启用状态）
        platforms.some(p => p.id === capacity.platformId)
      )
      .reduce(
        (sum, capacity) => sum + capacity.currentRecordings, 
        0
      );
  }

  // 渲染使用率进度条
  const renderUsageBar = (current: number, max: number) => {
    return (
      <div className="flex items-center gap-2">
        <div className="h-2 w-24 rounded-full bg-gray-100">
          <div
            className={`h-full rounded-full ${
              current / max > 0.8
                ? "bg-red-500"
                : current / max > 0.5
                ? "bg-yellow-500"
                : "bg-green-500"
            }`}
            style={{
              width: `${Math.min((current / max) * 100, 100)}%`,
            }}
          />
        </div>
        <span>{Math.round((current / max) * 100)}%</span>
      </div>
    );
  }

  // 渲染通用视图（所有平台汇总）
  const renderGeneralView = () => {
    return (
      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>节点ID</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>所属项目</TableHead>
              <TableHead>最大录制数(总)</TableHead>
              <TableHead>当前录制数(总)</TableHead>
              <TableHead>使用率</TableHead>
              <TableHead>最后活跃</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workerNodes.map((node) => {
              const totalMaxRecordings = calculateTotalMaxRecordings(node);
              const totalCurrentRecordings = getTotalCurrentRecordings(node);
              
              return (
                <TableRow key={node.id}>
                  <TableCell className="font-medium">{node.nodeId}</TableCell>
                  <TableCell>{getStatusBadge(node.status)}</TableCell>
                  <TableCell>
                    {hasProject(node) ? (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        {node.project?.name || `项目(${node.projectId})`}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                        通用
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{totalMaxRecordings}</TableCell>
                  <TableCell>{totalCurrentRecordings}</TableCell>
                  <TableCell>
                    {renderUsageBar(totalCurrentRecordings, totalMaxRecordings)}
                  </TableCell>
                  <TableCell>{formatLastSeen(node.lastSeenAt)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  }

  // 处理编辑按钮点击
  const handleEditClick = (node: WorkerNode, platformId: string, currentMax: number) => {
    setEditMode({ nodeId: node.id, platformId });
    setInputValue(currentMax);
  };
  
  // 处理取消编辑
  const handleCancelEdit = () => {
    setEditMode(null);
  };
  
  // 处理保存编辑
  const handleSaveEdit = async (nodeId: string, platformId: string) => {
    try {
      setIsUpdating(true);
      
      // 获取当前节点和平台
      const node = workerNodes.find(n => n.id === nodeId);
      if (!node) {
        throw new Error('找不到对应的工作节点');
      }
      
      // 获取该平台的当前录制数
      const capacity = getPlatformCapacity(node, platformId);
      const currentRecordings = capacity?.currentRecordings || 0;
      
      // 检查最大录制数是否小于当前录制数
      if (inputValue < currentRecordings) {
        throw new Error(`最大录制数不能小于当前录制数(${currentRecordings})`);
      }
      
      // 调用API更新最大录制数
      const response = await fetch(`/api/admin/worker-nodes/${nodeId}/platform-capacity`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          platformId,
          maxRecordings: inputValue 
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '更新失败');
      }
      
      // 成功提示
      toast({
        title: "更新成功",
        description: "工作节点平台最大录制数已更新",
      });
      
      // 退出编辑模式
      setEditMode(null);
      
      // 刷新页面以获取最新数据
      window.location.reload();
    } catch (error) {
      console.error('更新平台容量失败:', error);
      toast({
        title: "更新失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // 渲染按平台的详细视图
  const renderPlatformView = (platformId: string) => {
    const platformName = platforms.find(p => p.id === platformId)?.name || "未知平台";
    return (
      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>节点ID</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>所属项目</TableHead>
              <TableHead>{`${platformName}最大录制数`}</TableHead>
              {isSuperAdmin && <TableHead>操作</TableHead>}
              <TableHead>{`${platformName}当前录制数`}</TableHead>
              <TableHead>使用率</TableHead>
              <TableHead>最后活跃</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workerNodes.map((node) => {
              const capacity = getPlatformCapacity(node, platformId);
              // 如果节点没有该平台的容量配置，显示默认值
              const maxRecordings = capacity?.maxRecordings || node.maxRecordings;
              const currentRecordings = capacity?.currentRecordings || 0;
              const isEditing = editMode?.nodeId === node.id && editMode?.platformId === platformId;
              
              return (
                <TableRow key={node.id}>
                  <TableCell className="font-medium">{node.nodeId}</TableCell>
                  <TableCell>{getStatusBadge(node.status)}</TableCell>
                  <TableCell>
                    {hasProject(node) ? (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        {node.project?.name || `项目(${node.projectId})`}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                        通用
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {capacity ? maxRecordings : (
                      <span className="text-gray-400">未配置</span>
                    )}
                  </TableCell>
                  
                  {/* 超级管理员操作列 */}
                  {isSuperAdmin && (
                    <TableCell>
                      {isEditing ? (
                        <div className="flex items-center space-x-2">
                          <Input
                            type="number"
                            value={inputValue}
                            onChange={(e) => setInputValue(parseInt(e.target.value) || 0)}
                            min={currentRecordings}
                            className="w-20 h-8"
                          />
                          <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={() => handleSaveEdit(node.id, platformId)}
                            disabled={isUpdating || inputValue < currentRecordings}
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={handleCancelEdit}
                            disabled={isUpdating}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8"
                          onClick={() => handleEditClick(node, platformId, maxRecordings)}
                        >
                          <Edit className="h-4 w-4 mr-1" /> 修改
                        </Button>
                      )}
                    </TableCell>
                  )}
                  
                  <TableCell>{currentRecordings}</TableCell>
                  <TableCell>
                    {capacity ? 
                      renderUsageBar(currentRecordings, maxRecordings) : 
                      <span className="text-gray-400">未配置</span>
                    }
                  </TableCell>
                  <TableCell>{formatLastSeen(node.lastSeenAt)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>工作节点列表</CardTitle>
      </CardHeader>
      <CardContent>
        {workerNodes.length === 0 ? (
          <p className="text-muted-foreground text-center py-6">暂无工作节点</p>
        ) : (
          <Tabs defaultValue="general">
            <div className="relative">
              <TabsList className="flex flex-wrap gap-1 h-auto justify-start w-full">
                <TabsTrigger value="general">总览</TabsTrigger>
                {platforms.map(platform => (
                  <TabsTrigger key={platform.id} value={platform.id}>
                    {platform.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            
            <TabsContent value="general" className="mt-4">
              {renderGeneralView()}
            </TabsContent>
            
            {platforms.map(platform => (
              <TabsContent key={platform.id} value={platform.id} className="mt-4">
                {renderPlatformView(platform.id)}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </CardContent>
    </Card>
  )
} 