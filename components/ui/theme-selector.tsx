"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { Check, Palette } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// 定义主题类型
type ThemeOptionType = {
  name: string;
  id: string;
  className: string;
  color: string;
  bgColor?: string;
}

// 定义自定义主题
const themes: ThemeOptionType[] = [
  {
    name: "默认浅色",
    id: "light",
    className: "light",
    color: "#ffffff"
  },
  {
    name: "默认深色",
    id: "dark",
    className: "dark",
    color: "#09090b"
  },
  {
    name: "翠绿",
    id: "green",
    className: "theme-green",
    color: "#10b981",
    bgColor: "#ecfdf5"
  },
  {
    name: "蓝海",
    id: "blue",
    className: "theme-blue",
    color: "#3b82f6",
    bgColor: "#ebf5ff"
  },
  {
    name: "紫晶",
    id: "purple",
    className: "theme-purple",
    color: "#8b5cf6",
    bgColor: "#f3f0ff"
  },
  {
    name: "玫瑰",
    id: "rose",
    className: "theme-rose",
    color: "#f43f5e",
    bgColor: "#fff0f3"
  },
  {
    name: "琥珀",
    id: "amber",
    className: "theme-amber",
    color: "#f59e0b",
    bgColor: "#fefbea"
  }
]

export function ThemeSelector() {
  const { theme, setTheme } = useTheme()
  
  // 添加控制台输出，便于调试
  React.useEffect(() => {
    console.log("Current theme:", theme)
  }, [theme])
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Palette className="h-[1.2rem] w-[1.2rem]" />
          <span className="sr-only">选择主题</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>切换主题色调</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {themes.map((themeOption) => (
          <DropdownMenuItem
            key={themeOption.id}
            onClick={() => {
              console.log("Setting theme to:", themeOption.id)
              setTheme(themeOption.id)
            }}
            className="flex items-center gap-2"
          >
            <div 
              className="h-5 w-5 rounded-full border overflow-hidden flex items-center justify-center"
              style={{ backgroundColor: themeOption.bgColor || themeOption.color }}
            >
              {themeOption.bgColor && (
                <div 
                  className="h-3 w-3 rounded-full" 
                  style={{ backgroundColor: themeOption.color }}
                />
              )}
            </div>
            <span>{themeOption.name}</span>
            {theme === themeOption.id && (
              <Check className="ml-auto h-4 w-4" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
} 