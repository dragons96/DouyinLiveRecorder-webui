import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("开始设置平台默认容量...")
  
  // 获取所有启用的平台
  const platforms = await prisma.platform.findMany({
    where: {
      enabled: true
    }
  });
  
  // 获取所有工作节点
  const workerNodes = await prisma.workerNode.findMany();
  
  console.log(`发现 ${platforms.length} 个平台和 ${workerNodes.length} 个工作节点`);
  
  // 为每个平台和每个工作节点组合创建默认容量配置
  for (const platform of platforms) {
    console.log(`处理平台: ${platform.name}`);
    
    for (const node of workerNodes) {
      // 检查是否已存在容量配置
      const existingCapacity = await prisma.workerNodePlatformCapacity.findFirst({
        where: {
          platformId: platform.id,
          workerNodeId: node.id
        }
      });
      
      if (!existingCapacity) {
        // 创建默认容量配置
        await prisma.workerNodePlatformCapacity.create({
          data: {
            platformId: platform.id,
            workerNodeId: node.id,
            maxRecordings: 3, // 默认最大录制数
            currentRecordings: 0,
          }
        });
        console.log(`  为工作节点 ${node.nodeId} 创建平台 ${platform.name} 的默认容量配置`);
      } else {
        console.log(`  工作节点 ${node.nodeId} 已有平台 ${platform.name} 的容量配置，跳过创建`);
      }
    }
  }
  
  console.log("平台默认容量设置完成");
}

main()
  .catch((e) => {
    console.error("设置平台默认容量时出错:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  }) 