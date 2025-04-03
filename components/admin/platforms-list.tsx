"use client"

import { useState } from "react"
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

interface PlatformsListProps {
  platforms: Platform[]
}

export function PlatformsList({ platforms }: PlatformsListProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleToggleEnabled = async (id: string, currentlyEnabled: boolean) => {
    try {
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
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>直播平台</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {platforms.length === 0 ? (
              <p className="text-muted-foreground">暂无平台配置</p>
            ) : (
              platforms.map((platform) => (
                <div key={platform.id} className="flex items-center justify-between border-b pb-2 last:border-b-0 last:pb-0">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{platform.name}</p>
                      {!platform.enabled && (
                        <span className="rounded-md bg-red-100 px-2 py-1 text-xs text-red-800">
                          已停用
                        </span>
                      )}
                    </div>
                    {/* <p className="text-sm text-muted-foreground">{platform.apiEndpoint || "无 API 端点"}</p> */}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={platform.enabled}
                      onCheckedChange={() => handleToggleEnabled(platform.id, platform.enabled)}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

