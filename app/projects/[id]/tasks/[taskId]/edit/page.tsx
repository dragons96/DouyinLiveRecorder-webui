"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { getSession } from "next-auth/react"
import { use } from "react"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"

interface EditTaskPageProps {
  params: Promise<{
    id: string
    taskId: string
  }>
}

export default function EditTaskPage({ params }: EditTaskPageProps) {
  // 使用 React.use() 解包 params
  const unwrappedParams = use(params)
  const { id: projectId, taskId } = unwrappedParams;
  
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingTask, setIsLoadingTask] = useState(true)
  const [platforms, setPlatforms] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    platformId: "",
    projectId: projectId,
  })
  const [platformParams, setPlatformParams] = useState({
    liveUrls: "",
    cookie: ""
  })
  
  const [selectedPlatform, setSelectedPlatform] = useState<any>(null)
  const [task, setTask] = useState<any>(null)
  const [allPlatforms, setAllPlatforms] = useState<any[]>([])

  useEffect(() => {
    const fetchTask = async () => {
      try {
        setIsLoadingTask(true);
        const taskResponse = await fetch(`/api/tasks/${taskId}`);
        if (!taskResponse.ok) {
          throw new Error('获取任务失败');
        }
        const taskData = await taskResponse.json();
        
        // 设置表单数据
        setFormData({
          name: taskData.name,
          description: taskData.description || '',
          platformId: taskData.platformId,
          projectId: taskData.projectId,
        });
        
        setSelectedPlatform(taskData.platform);
        
        // 处理平台特定参数
        if (taskData.platformParams) {
          try {
            const parsedParams = JSON.parse(taskData.platformParams);
            
            // 如果是Array，说明是早期的抖音平台数据格式
            if (Array.isArray(parsedParams)) {
              setPlatformParams({
                liveUrls: parsedParams.join('\n'),
                cookie: ''
              });
            } 
            // 否则使用新的统一格式
            else {
              const liveUrls = parsedParams.liveUrls ? 
                (Array.isArray(parsedParams.liveUrls) ? 
                  parsedParams.liveUrls.join('\n') : 
                  parsedParams.liveUrls) : 
                '';
                
              setPlatformParams({
                liveUrls: liveUrls,
                cookie: parsedParams.cookie || ''
              });
            }
          } catch (error) {
            console.error('解析平台参数失败:', error);
            // 如果解析失败，使用streamUrls作为备选
            if (taskData.streamUrls) {
              try {
                const urls = JSON.parse(taskData.streamUrls);
                setPlatformParams({
                  liveUrls: Array.isArray(urls) ? urls.join('\n') : '',
                  cookie: ''
                });
              } catch (e) {
                console.error('解析streamUrls失败:', e);
              }
            }
          }
        } else if (taskData.streamUrls) {
          // 没有platformParams但有streamUrls的情况
          try {
            const urls = JSON.parse(taskData.streamUrls);
            setPlatformParams({
              liveUrls: Array.isArray(urls) ? urls.join('\n') : '',
              cookie: ''
            });
          } catch (e) {
            console.error('解析streamUrls失败:', e);
          }
        }
      } catch (error) {
        console.error('获取任务详情失败:', error);
        toast.error('获取任务详情失败');
      } finally {
        setIsLoadingTask(false);
      }
    };

    const fetchPlatforms = async () => {
      try {
        const response = await fetch("/api/platforms")
        if (response.ok) {
          const data = await response.json()
          // 过滤出可用的平台
          const enabledPlatforms = data.filter((platform: any) => platform.enabled === true)
          // 保存所有平台以便检查任务当前平台的启用状态
          setAllPlatforms(data)
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
        
        // 根据用户角色决定获取所有项目还是用户关联的项目
        const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN"
        const endpoint = "/api/projects"
        
        const response = await fetch(endpoint)
        if (response.ok) {
          const data = await response.json()
          setProjects(data)
        }
      } catch (error) {
        console.error("Error fetching projects:", error)
      }
    }

    fetchTask()
    fetchPlatforms()
    fetchProjects()
  }, [projectId, taskId])
  
  // 当平台变更时，更新选中的平台对象
  useEffect(() => {
    if (platforms.length > 0 && formData.platformId) {
      const platform = platforms.find(p => p.id === formData.platformId)
      setSelectedPlatform(platform || null)
    }
  }, [platforms, formData.platformId])

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
  };

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

    // 检查所选平台是否已停用
    const isPlatformDisabled = allPlatforms.some(p => p.id === formData.platformId && !p.enabled);
    if (isPlatformDisabled) {
      toast.error("所选平台已停用，请选择一个可用的平台");
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
        platformParams: JSON.stringify(platformSpecificParams)
      };
      
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "更新任务失败");
      }

      toast.success("任务更新成功");
      router.push(`/tasks`);
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "更新任务失败");
      console.error("Error updating task:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // 判断是否显示抖音特定配置
  const showDouyinConfig = selectedPlatform?.name === "抖音"

  if (isLoadingTask) {
    return (
      <DashboardShell>
        <DashboardHeader
          heading="编辑录制任务"
          text="修改直播录制任务信息"
        />
        <Card>
          <CardContent className="flex justify-center items-center py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            <p className="ml-2">加载任务信息中...</p>
          </CardContent>
        </Card>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell>
      <DashboardHeader
        heading="编辑录制任务"
        text="修改直播录制任务信息"
      />

      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>任务信息</CardTitle>
            <CardDescription>更新录制任务的基本信息</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">任务名称 *</Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
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
              <Label htmlFor="projectId">所属项目 *</Label>
              <Select
                name="projectId"
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="platformId">直播平台 *</Label>
              <Select
                name="platformId"
                value={formData.platformId}
                onValueChange={(value) => handleSelectChange("platformId", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择直播平台" />
                </SelectTrigger>
                <SelectContent>
                  {/* 优先显示当前选中的平台，即使其已停用 */}
                  {formData.platformId && allPlatforms.some(p => p.id === formData.platformId && !p.enabled) && (
                    <SelectItem key={formData.platformId} value={formData.platformId}>
                      {allPlatforms.find(p => p.id === formData.platformId)?.name} (已停用)
                    </SelectItem>
                  )}
                  {platforms.map((platform) => (
                    <SelectItem key={platform.id} value={platform.id}>
                      {platform.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* 当选中的平台已停用时显示警告信息 */}
              {formData.platformId && allPlatforms.some(p => p.id === formData.platformId && !p.enabled) && (
                <p className="text-yellow-600 text-sm mt-1">
                  该平台已停用，若继续使用此平台，任务可能无法正常运行。请考虑更换为可用平台。
                </p>
              )}
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
            <Button 
              type="submit" 
              disabled={isLoading || Boolean(formData.platformId && allPlatforms.some(p => p.id === formData.platformId && !p.enabled))}
            >
              {isLoading ? "保存中..." : "保存修改"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </DashboardShell>
  )
} 