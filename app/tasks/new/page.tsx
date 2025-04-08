"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { getSession } from "next-auth/react"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"

export default function NewTaskPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [platforms, setPlatforms] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    platformId: "",
    projectId: "",
  })
  const [enabled, setEnabled] = useState(true) // 默认启用任务
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [platformParams, setPlatformParams] = useState({
    liveUrls: "",
    cookie: ""
  })
  
  const [selectedPlatform, setSelectedPlatform] = useState<any>(null)

  useEffect(() => {
    const fetchPlatforms = async () => {
      try {
        const response = await fetch("/api/platforms")
        if (response.ok) {
          const data = await response.json()
          // 只保留可用的平台
          const enabledPlatforms = data.filter((platform: any) => platform.enabled === true)
          setPlatforms(enabledPlatforms)
        }
      } catch (error) {
        console.error("Error fetching platforms:", error)
      }
    }

    const fetchProjects = async () => {
      try {
        const session = await getSession()
        if (!session) return

        // 检查是否是超级管理员
        const isSuperAdmin = session.user.role === "SUPER_ADMIN"
        setIsSuperAdmin(isSuperAdmin)

        const response = await fetch("/api/projects")
        if (response.ok) {
          const data = await response.json()
          
          if (isSuperAdmin) {
            // 超级管理员可以访问所有项目
            setProjects(data)
          } else {
            // 普通用户只能访问自己所属的项目或管理的项目
            const accessibleProjects = data.filter((project: any) => {
              return (
                project.managers.some((manager: any) => manager.id === session.user.id) ||
                project.users.some((user: any) => user.id === session.user.id)
              )
            })
            setProjects(accessibleProjects)
          }
        }
      } catch (error) {
        console.error("Error fetching projects:", error)
      }
    }

    fetchPlatforms()
    fetchProjects()
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
    
    // 如果选择的是平台，更新选中的平台对象
    if (name === "platformId") {
      const platform = platforms.find(p => p.id === value)
      setSelectedPlatform(platform || null)
    }
  }
  
  const handlePlatformParamsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setPlatformParams({
      ...platformParams,
      [e.target.name]: e.target.value,
    });
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name || !formData.platformId || !formData.projectId) {
      toast.error("请填写所有必填字段")
      return
    }
    
    // 验证直播地址是否填写
    if (!platformParams.liveUrls.trim()) {
      toast.error("请至少提供一个直播地址");
      return;
    }

    setIsLoading(true)

    try {
      // 处理平台特定参数
      let platformSpecificParams: any = {};
      
      // 处理直播地址
      if (platformParams.liveUrls.trim()) {
        platformSpecificParams.liveUrls = platformParams.liveUrls
          .trim()
          .split('\n')
          .map(url => url.trim())
          .filter(url => url);
      }
        
      // 如果有Cookie
      if (platformParams.cookie.trim()) {
        platformSpecificParams.cookie = platformParams.cookie.trim();
      }
      
      // 准备发送的数据
      const requestData = {
        ...formData,
        enabled: enabled,
        platformParams: JSON.stringify(platformSpecificParams)
      };
      
      console.log("发送创建任务请求:", JSON.stringify(requestData));
      
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });

      // 保存响应文本以便调试
      const responseText = await response.text();
      console.log("创建任务响应:", responseText);
      
      let data;
      try {
        // 尝试解析JSON响应
        data = JSON.parse(responseText);
      } catch (e) {
        console.error("解析响应JSON失败:", e);
        throw new Error(`服务器响应解析失败: ${responseText.substring(0, 100)}`);
      }

      if (!response.ok) {
        throw new Error(data.error || "创建任务失败");
      }

      toast.success("任务创建成功");
      // 修改跳转逻辑，直接返回全局任务列表页
      router.push(`/tasks`);
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "创建任务失败");
      console.error("Error creating task:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // 判断是否显示抖音特定配置
  const showDouyinConfig = selectedPlatform?.name === "抖音"

  return (
    <DashboardShell>
      <DashboardHeader
        heading="新建录制任务"
        text="创建新的直播录制任务"
      />

      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>任务信息</CardTitle>
            <CardDescription>填写录制任务的基本信息</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">任务名称 *</Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="输入任务名称"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">任务描述</Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="输入任务描述"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="project">所属项目 *</Label>
              <Select
                value={formData.projectId}
                onValueChange={(value) => handleSelectChange("projectId", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择项目" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {projects.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {isSuperAdmin 
                    ? "没有可用的项目。请先创建一个项目。" 
                    : "没有可用的项目。您需要是一个项目的成员或管理员才能创建任务。"}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="platform">直播平台 *</Label>
              <Select
                value={formData.platformId}
                onValueChange={(value) => handleSelectChange("platformId", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择直播平台" />
                </SelectTrigger>
                <SelectContent>
                  {platforms.map((platform) => (
                    <SelectItem key={platform.id} value={platform.id}>
                      {platform.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* 任务启用/禁用开关 */}
            <div className="flex items-center space-x-2 pt-2">
              <Switch 
                id="task-enabled" 
                checked={enabled} 
                onCheckedChange={setEnabled}
              />
              <Label htmlFor="task-enabled" className="cursor-pointer">
                {enabled ? "任务创建后立即启用" : "任务创建后保持禁用状态"}
              </Label>
              <span className="text-xs text-muted-foreground ml-auto">
                {!enabled && "禁用状态下的任务将不会自动启动"}
              </span>
            </div>

            {/* 平台配置部分 */}
            <div className="space-y-4 rounded-md border p-4 mt-4">
              <h3 className="font-medium">直播平台配置</h3>
              
              <div className="space-y-2">
                <Label htmlFor="liveUrls">直播地址列表 <span className="text-red-500">*</span></Label>
                <Textarea
                  id="liveUrls"
                  name="liveUrls"
                  value={platformParams.liveUrls}
                  onChange={handlePlatformParamsChange}
                  placeholder={`每行一个直播地址，例如：${selectedPlatform?.name === '抖音' ? 
'https://live.douyin.com/123456789、https://live.douyin.com/yall1102 或 https://v.douyin.com/iQFeBnt/' : 
'请输入直播地址'}`}
                  rows={3}
                  required
                />
                <p className="text-xs text-muted-foreground">每行输入一个直播地址</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="cookie">Cookie (可选)</Label>
                <Textarea
                  id="cookie"
                  name="cookie"
                  value={platformParams.cookie}
                  onChange={handlePlatformParamsChange}
                  placeholder="可选：输入Cookie"
                  rows={2}
                />
                <p className="text-xs text-muted-foreground">可选字段，用于需要登录才能访问的直播</p>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              className="mr-2"
              disabled={isLoading}
            >
              取消
            </Button>
            <Button type="submit" disabled={isLoading || projects.length === 0}>
              {isLoading ? "创建中..." : "创建任务"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </DashboardShell>
  )
} 