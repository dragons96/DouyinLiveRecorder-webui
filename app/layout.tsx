import { Inter } from "next/font/google"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { ThemeProvider } from "@/components/theme-provider"
import { SessionProvider } from "@/components/providers/session-provider"
import { Toaster } from "@/components/ui/toaster"
import { AppShell } from "@/components/layout/app-shell"
import { Toaster as SonnerToaster } from "sonner"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata = {
  title: "直播录制管理系统",
  description: "管理直播录制任务",
}

interface RootLayoutProps {
  children: React.ReactNode
}

// 定义主题映射
const themeMap = {
  light: "light",
  dark: "dark",
  green: "theme-green",
  blue: "theme-blue",
  purple: "theme-purple",
  rose: "theme-rose",
  amber: "theme-amber"
}

export default async function RootLayout({ children }: RootLayoutProps) {
  const session = await getServerSession(authOptions)

  // 控制台输出当前主题映射以便调试
  console.log("Theme map configured:", themeMap)

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head />
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
          themes={["light", "dark", "green", "blue", "purple", "rose", "amber"]}
          value={themeMap}
        >
          <SessionProvider session={session}>
            {session ? (
              <AppShell user={session.user}>
                {children}
              </AppShell>
            ) : (
              children
            )}
            <Toaster />
            <SonnerToaster richColors position="top-right" />
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

import './globals.css'