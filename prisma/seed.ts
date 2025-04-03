import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  // 定义要创建的平台
  const platforms = [
    {
      name: "抖音",
      description: "抖音直播平台",
      enabled: true,
    },
    {
      name: "快手",
      description: "快手直播平台",
      enabled: true,
    },
    {
      name: "虎牙",
      description: "虎牙直播平台",
      enabled: true,
    },
    {
      name: "斗鱼",
      description: "斗鱼直播平台",
      enabled: true,
    },
    {
      name: "YY",
      description: "YY直播平台",
      enabled: true,
    },
    {
      name: "BiliBili",
      description: "bilibili直播平台",
      enabled: true,
    },
    {
      name: "小红书",
      description: "小红书直播平台",
      enabled: true,
    },
    {
      name: "网易CC",
      description: "网易CC直播平台",
      enabled: true,
    },
    {
      name: "微博",
      description: "微博直播平台",
      enabled: true,
    },
    {
      name: "酷狗",
      description: "酷狗直播平台",
      enabled: true,
    },
    {
      name: "知乎",
      description: "知乎直播平台",
      enabled: true,
    },
    {
      name: "京东",
      description: "京东直播平台",
      enabled: true,
    },
    {
      name: "花椒",
      description: "花椒直播平台",
      enabled: true,
    },
    {
      name: "百度",
      description: "百度直播平台",
      enabled: true,
    },
    {
      name: "千度",
      description: "千度热播直播平台",
      enabled: true,
    },
  ]

  console.log(`开始创建平台数据...`)

  // 对每个平台，先检查是否存在，不存在则创建
  for (const platform of platforms) {
    const existingPlatform = await prisma.platform.findUnique({
      where: {
        name: platform.name,
      },
    })

    if (!existingPlatform) {
      await prisma.platform.create({
        data: platform,
      })
      console.log(`已创建平台: ${platform.name}`)
    } else {
      console.log(`平台已存在: ${platform.name}，跳过创建`)
    }
  }

  console.log(`平台数据创建完成`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  }) 