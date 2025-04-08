"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Switch } from "@/components/ui/switch"
import { Platform } from "@/types"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { PowerIcon, PowerOffIcon, Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

interface PlatformsListProps {
  platforms: Platform[]
}

type StatusFilter = "all" | "enabled" | "disabled"

export function PlatformsList({ platforms }: PlatformsListProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [filteredPlatforms, setFilteredPlatforms] = useState<Platform[]>(platforms)

  // 筛选平台
  useEffect(() => {
    const filtered = platforms.filter(platform => {
      // 状态筛选
      const statusMatch = statusFilter === "all" 
        ? true 
        : statusFilter === "enabled" 
          ? platform.enabled 
          : !platform.enabled

      // 名称和描述筛选
      const searchLower = searchQuery.toLowerCase()
      const nameMatch = platform.name.toLowerCase().includes(searchLower)
      const descMatch = platform.description 
        ? platform.description.toLowerCase().includes(searchLower) 
        : false

      return statusMatch && (nameMatch || descMatch)
    })

    setFilteredPlatforms(filtered)
    
    // 更新选中项，移除不在筛选结果中的选中平台
    setSelectedPlatforms(prev => prev.filter(id => 
      filtered.some(platform => platform.id === id)
    ))
  }, [platforms, searchQuery, statusFilter])

  const handleToggleEnabled = async (id: string, currentlyEnabled: boolean) => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/platforms/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          enabled: !currentlyEnabled,
        }),
      })

      if (!response.ok) {
        throw new Error(currentlyEnabled ? "停用平台失败" : "启用平台失败")
      }

      toast.success(currentlyEnabled ? "平台已停用" : "平台已启用")
      
      // 使用多种方式刷新页面，确保任务列表能即时反映平台状态变化
      router.refresh()
      
      // 额外的刷新方式，确保页面数据完全更新
      setTimeout(() => {
        window.location.reload()
      }, 500)
    } catch (error) {
      console.error("Error toggling platform status:", error)
      toast.error(currentlyEnabled ? "停用平台失败" : "启用平台失败")
    } finally {
      setIsLoading(false)
    }
  }

  const handleBulkAction = async (action: 'enable' | 'disable') => {
    if (selectedPlatforms.length === 0) {
      toast.warning("请先选择平台")
      return
    }

    setIsLoading(true)
    
    try {
      let successCount = 0
      let failCount = 0
      
      // 使用Promise.all并行处理所有请求
      await Promise.all(
        selectedPlatforms.map(async (id) => {
          const platform = platforms.find(p => p.id === id)
          
          // 如果平台的当前状态已经是目标状态，则跳过
          if ((action === 'enable' && platform?.enabled) || 
              (action === 'disable' && !platform?.enabled)) {
            return
          }
          
          try {
            const response = await fetch(`/api/platforms/${id}`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                enabled: action === 'enable',
              }),
            })
            
            if (response.ok) {
              successCount++
            } else {
              failCount++
            }
          } catch (error) {
            console.error(`Error ${action}ing platform ${id}:`, error)
            failCount++
          }
        })
      )
      
      if (successCount > 0) {
        toast.success(`已成功${action === 'enable' ? '启用' : '停用'} ${successCount} 个平台`)
      }
      
      if (failCount > 0) {
        toast.error(`${failCount} 个平台${action === 'enable' ? '启用' : '停用'}失败`)
      }
      
      // 刷新页面
      if (successCount > 0) {
        router.refresh()
        
        // 额外的刷新方式
        setTimeout(() => {
          window.location.reload()
        }, 500)
      }
    } catch (error) {
      console.error(`Error during bulk ${action}:`, error)
      toast.error(`批量${action === 'enable' ? '启用' : '停用'}失败`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectAll = () => {
    if (selectedPlatforms.length === filteredPlatforms.length) {
      setSelectedPlatforms([])
    } else {
      setSelectedPlatforms(filteredPlatforms.map(p => p.id))
    }
  }

  const handleSelectPlatform = (id: string) => {
    if (selectedPlatforms.includes(id)) {
      setSelectedPlatforms(selectedPlatforms.filter(platformId => platformId !== id))
    } else {
      setSelectedPlatforms([...selectedPlatforms, id])
    }
  }

  const clearFilters = () => {
    setSearchQuery("")
    setStatusFilter("all")
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>直播平台</CardTitle>
        </CardHeader>
        <CardContent>
          {platforms.length === 0 ? (
            <p className="text-muted-foreground">暂无平台配置</p>
          ) : (
            <>
              {/* 筛选区域 */}
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="relative flex-1">
                  <Input
                    placeholder="搜索平台名称或描述..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Select 
                  value={statusFilter}
                  onValueChange={(value) => setStatusFilter(value as StatusFilter)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="按状态筛选" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    <SelectItem value="enabled">已启用</SelectItem>
                    <SelectItem value="disabled">已停用</SelectItem>
                  </SelectContent>
                </Select>
                {(searchQuery || statusFilter !== "all") && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={clearFilters}
                    className="self-center"
                  >
                    清除筛选
                  </Button>
                )}
              </div>

              {/* 筛选状态提示 */}
              {(searchQuery || statusFilter !== "all") && (
                <div className="mb-4 flex gap-2 items-center flex-wrap">
                  <span className="text-sm text-muted-foreground">当前筛选条件:</span>
                  {searchQuery && (
                    <Badge variant="outline" className="text-xs">
                      关键词: {searchQuery}
                      <button 
                        onClick={() => setSearchQuery("")}
                        className="ml-1 hover:text-foreground"
                      >
                        <X className="h-3 w-3 inline" />
                      </button>
                    </Badge>
                  )}
                  {statusFilter !== "all" && (
                    <Badge variant="outline" className="text-xs">
                      状态: {statusFilter === "enabled" ? "已启用" : "已停用"}
                      <button 
                        onClick={() => setStatusFilter("all")}
                        className="ml-1 hover:text-foreground"
                      >
                        <X className="h-3 w-3 inline" />
                      </button>
                    </Badge>
                  )}
                  <span className="text-sm text-muted-foreground ml-auto">
                    共找到 {filteredPlatforms.length} 个平台
                  </span>
                </div>
              )}

              {/* 批量操作按钮 */}
              <div className="flex gap-2 mb-4">
                <Button 
                  variant="outline" 
                  size="sm"
                  disabled={isLoading || filteredPlatforms.length === 0}
                  onClick={handleSelectAll}
                >
                  {selectedPlatforms.length === filteredPlatforms.length && filteredPlatforms.length > 0 
                    ? "取消全选" 
                    : "全选"
                  }
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-green-600 hover:text-green-700 hover:bg-green-100"
                  disabled={isLoading || selectedPlatforms.length === 0}
                  onClick={() => handleBulkAction('enable')}
                >
                  <PowerIcon className="h-4 w-4 mr-2" />
                  批量启用
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-100"
                  disabled={isLoading || selectedPlatforms.length === 0}
                  onClick={() => handleBulkAction('disable')}
                >
                  <PowerOffIcon className="h-4 w-4 mr-2" />
                  批量停用
                </Button>
                {selectedPlatforms.length > 0 && (
                  <span className="text-sm text-muted-foreground self-center ml-2">
                    已选择 {selectedPlatforms.length} 个平台
                  </span>
                )}
              </div>

              {filteredPlatforms.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-muted-foreground">没有找到符合条件的平台</p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]">
                          <Checkbox 
                            checked={filteredPlatforms.length > 0 && selectedPlatforms.length === filteredPlatforms.length}
                            onCheckedChange={handleSelectAll}
                          />
                        </TableHead>
                        <TableHead className="w-[200px]">平台名称</TableHead>
                        <TableHead>平台描述</TableHead>
                        <TableHead className="w-[100px] text-right">状态</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPlatforms.map((platform) => (
                        <TableRow key={platform.id}>
                          <TableCell>
                            <Checkbox 
                              checked={selectedPlatforms.includes(platform.id)}
                              onCheckedChange={() => handleSelectPlatform(platform.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            {platform.name}
                          </TableCell>
                          <TableCell>
                            {platform.description || "无描述"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {!platform.enabled && (
                                <span className="rounded-md bg-red-100 px-2 py-1 text-xs text-red-800">
                                  已停用
                                </span>
                              )}
                              <Switch
                                checked={platform.enabled}
                                onCheckedChange={() => handleToggleEnabled(platform.id, platform.enabled)}
                                disabled={isLoading}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

