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
      name: "TikTok",
      description: "TikTok直播平台（需要科学上网）",
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
      name: "BIGO",
      description: "BIGO直播平台",
      enabled: true,
    },
    {
      name: "Blued",
      description: "Blued直播平台",
      enabled: true,
    },
    {
      name: "SOOP",
      description: "SOOP直播平台（需要科学上网）",
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
      name: "千度热播",
      description: "千度热播直播平台",
      enabled: true,
    },
    {
      name: "PandaTV",
      description: "PandaTV直播平台（需要科学上网）",
      enabled: true,
    },
    {
      name: "猫耳FM",
      description: "猫耳FM直播平台",
      enabled: true,
    },
    {
      name: "Look",
      description: "Look直播平台",
      enabled: true,
    },
    {
      name: "WinkTV",
      description: "WinkTV直播平台（需要科学上网）",
      enabled: true,
    },
    {
      name: "FlexTV",
      description: "FlexTV直播平台（需要科学上网）",
      enabled: true,
    },
    {
      name: "PopkonTV",
      description: "PopkonTV直播平台（需要科学上网）",
      enabled: true,
    },
    {
      name: "TwitCasting",
      description: "TwitCasting直播平台（需要科学上网）",
      enabled: true,
    },
    {
      name: "百度",
      description: "百度直播平台",
      enabled: true,
    },
    {
      name: "酷狗",
      description: "酷狗直播平台",
      enabled: true,
    },
    {
      name: "TwitchTV",
      description: "TwitchTV直播平台（需要科学上网）",
      enabled: true,
    },
    {
      name: "LiveMe",
      description: "LiveMe直播平台",
      enabled: true,
    },
    {
      name: "花椒",
      description: "花椒直播平台",
      enabled: true,
    },
    {
      name: "流星",
      description: "流星直播平台",
      enabled: true,
    },
    {
      name: "ShowRoom",
      description: "ShowRoom直播平台（需要科学上网）",
      enabled: true,
    },
    {
      name: "Acfun",
      description: "Acfun直播平台",
      enabled: true,
    },
    {
      name: "映客",
      description: "映客直播平台",
      enabled: true,
    },
    {
      name: "音播",
      description: "音播直播平台",
      enabled: true,
    },
    {
      name: "知乎",
      description: "知乎直播平台",
      enabled: true,
    },
    {
      name: "CHZZK",
      description: "CHZZK直播平台（需要科学上网）",
      enabled: true,
    },
    {
      name: "嗨秀",
      description: "嗨秀直播平台",
      enabled: true,
    },
    {
      name: "VV星球",
      description: "VV星球直播平台",
      enabled: true,
    },
    {
      name: "17Live",
      description: "17Live直播平台（需要科学上网）",
      enabled: true,
    },
    {
      name: "浪Live",
      description: "浪Live直播平台（需要科学上网）",
      enabled: true,
    },
    {
      name: "畅聊",
      description: "畅聊直播平台",
      enabled: true,
    },
    {
      name: "飘飘",
      description: "飘飘直播平台",
      enabled: true,
    },
    {
      name: "六间房",
      description: "六间房直播平台",
      enabled: true,
    },
    {
      name: "乐嗨",
      description: "乐嗨直播平台",
      enabled: true,
    },
    {
      name: "花猫",
      description: "花猫直播平台",
      enabled: true,
    },
    {
      name: "Shopee",
      description: "Shopee直播平台（需要科学上网）",
      enabled: true,
    },
    {
      name: "Youtube",
      description: "Youtube直播平台（需要科学上网）",
      enabled: true,
    },
    {
      name: "淘宝",
      description: "淘宝直播平台（需要Cookie）",
      enabled: true,
    },
    {
      name: "京东",
      description: "京东直播平台",
      enabled: true,
    },
    {
      name: "Faceit",
      description: "Faceit直播平台（需要科学上网）",
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
      // 创建新平台
      const newPlatform = await prisma.platform.create({
        data: platform,
      })
      console.log(`已创建平台: ${platform.name}`)
      
      // 获取所有工作节点
      const workerNodes = await prisma.workerNode.findMany();
      console.log(`为平台 ${platform.name} 创建默认工作节点容量配置...`)
      
      // 为每个工作节点创建该平台的默认容量配置
      for (const node of workerNodes) {
        await prisma.workerNodePlatformCapacity.create({
          data: {
            platformId: newPlatform.id,
            workerNodeId: node.id,
            maxRecordings: 3, // 默认最大录制数
            currentRecordings: 0,
          }
        });
      }
      
      console.log(`已为 ${workerNodes.length} 个工作节点创建平台 ${platform.name} 的默认容量配置`)
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