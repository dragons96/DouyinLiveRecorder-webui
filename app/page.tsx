import Link from "next/link"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export default async function Home() {
  const session = await getServerSession(authOptions)

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 space-y-8 text-center">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">直播录制管理系统</h1>
          <p className="max-w-[600px] text-muted-foreground">高效管理直播录制任务，支持多平台、多项目协作</p>
        </div>
        <div className="flex gap-4">
          <Button asChild size="lg">
            <Link href="/login">登录</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/register">注册</Link>
          </Button>
        </div>
      </div>
    )
  }

  redirect("/dashboard")
}

