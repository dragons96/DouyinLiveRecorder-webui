# 直播录制管理系统

> 本项目是基于 [DouyinLiveRecorder](https://github.com/ihmily/DouyinLiveRecorder) 实现的一个直播在线管理平台，提供了友好的Web界面和更丰富的管理功能。

> 录制工作节点仓库见：[https://github.com/dragons96/DouyinLiveRecorder](https://github.com/dragons96/DouyinLiveRecorder)

录制任务页面

![1743681852134](image/README/1743681852134.png)

录制任务详情页面![1743681799524](image/README/1743681799524.png)

录制节点管理

![1743682008096](image/README/1743682008096.png)

用户管理

![1743681917149](image/README/1743681917149.png)

平台管理

![1743681933255](image/README/1743681933255.png)

项目管理

![1743681947324](image/README/1743681947324.png)

## 快速开始

### 环境要求

- Node.js 18+ (建议使用最新的 LTS 版本)
- MySQL 8.0+
- 包管理器: pnpm (推荐)

### 安装步骤

1. 克隆仓库

```bash
git clone https://github.com/your-username/live-streaming-management.git
cd live-streaming-management
```

2. 安装依赖

```bash
pnpm install
```

3. 配置环境变量

创建 `.env` 文件，添加以下配置:

```
DATABASE_URL="mysql://用户名:密码@localhost:3306/live_streaming_management?schema=public&connectionTimeZone=Asia/Shanghai"
NEXTAUTH_SECRET="生成一个随机密钥" # 可以使用 openssl rand -base64 32 生成
NEXTAUTH_URL="http://localhost:3000"
```

4. 初始化数据库

```bash
# 执行数据库迁移
npx prisma migrate dev

# 初始化平台数据
pnpm setup:platforms
```

5. 启动开发服务器

```bash
pnpm dev
```

6. 访问应用，打开浏览器访问 [http://localhost:3000](http://localhost:3000)
7. 通过注册创建用户，第一个创建用户为超级管理员，后续用户均为普通用户

## 项目概述

直播录制管理系统是一个专为多用户、多项目、多平台直播录制管理设计的Web应用。系统支持用户注册登录、角色权限管理、项目管理、直播平台管理以及直播录制任务的全生命周期管理。

## 核心功能

### 用户管理与认证

- **用户注册与登录**：所有用户必须注册账号并登录才能使用系统
- **默认项目分配**：新注册用户会自动分配到默认项目中
- **基于角色的权限系统**：
  - 超级管理员：拥有全系统所有权限
  - 项目管理员：拥有特定项目的所有管理权限
  - 项目成员/普通用户：拥有个人级别的有限权限，可创建录制任务

### 项目管理

- **项目创建**：超级管理员可创建新项目
- **项目权限申请**：用户可申请加入特定项目
- **项目成员管理**：项目管理员可审批用户的项目权限申请
- **项目概览**：查看项目状态、成员和任务统计
- **项目专属工作节点**：项目可以有专属的工作节点，也可使用通用工作节点

### 平台管理

- **多平台支持**：支持多种直播平台，可随时扩展添加新平台
- **平台配置管理**：管理不同平台的API密钥和配置参数
- **平台状态控制**：可启用或禁用特定平台

### 平台初始化

本系统内置了多种直播平台支持，首次使用需要初始化平台数据：

```bash
pnpm setup:platforms
```

该命令会自动创建以下平台：

1. 抖音 (支持多种格式的URL):
   - https://live.douyin.com/123456789 (数字ID)
   - https://live.douyin.com/yall1102 (字母数字混合ID)
   - https://v.douyin.com/iQFeBnt/ (短链接格式)
2. TikTok (https://www.tiktok.com/@pearlgaga88/live) (需要科学上网)
3. 快手 (https://live.kuaishou.com/u/yall1102)
4. 虎牙 (https://www.huya.com/52333)
5. 斗鱼 (https://www.douyu.com/3637778?dyshid=、https://www.douyu.com/topic/wzDBLS6?rid=4921614&dyshid=)
6. YY (https://www.yy.com/22490906/22490906)
7. BiliBili (https://live.bilibili.com/320)
8. 小红书 (https://www.xiaohongshu.com/user/profile/6330049c000000002303c7ed?appuid=5f3f478a00000000010005b3、http://xhslink.com/xpJpfM)
9. BIGO直播 (https://www.bigo.tv/cn/716418802)
10. Blued直播 (https://app.blued.cn/live?id=Mp6G2R)
11. SOOP (https://play.sooplive.co.kr/sw7love) (需要科学上网)
12. 网易CC (https://cc.163.com/583946984)
13. 微博直播 (https://weibo.com/l/wblive/p/show/1022:2321325026370190442592)
14. 千度热播 (https://qiandurebo.com/web/video.php?roomnumber=33333)
15. PandaTV (https://www.pandalive.co.kr/live/play/bara0109) (需要科学上网)
16. 猫耳FM (https://fm.missevan.com/live/868895007)
17. Look直播 (https://look.163.com/live?id=65108820&position=3)
18. WinkTV (https://www.winktv.co.kr/live/play/anjer1004) (需要科学上网)
19. FlexTV (https://www.flextv.co.kr/channels/593127/live) (需要科学上网)
20. PopkonTV (https://www.popkontv.com/live/view?castId=wjfal007&partnerCode=P-00117) (需要科学上网)
21. TwitCasting (https://twitcasting.tv/c:uonq) (需要科学上网)
22. 百度直播 (https://live.baidu.com/m/media/pclive/pchome/live.html?room_id=9175031377&tab_category)
23. 酷狗直播 (https://fanxing2.kugou.com/50428671?refer=2177&sourceFrom=)
24. TwitchTV (https://www.twitch.tv/gamerbee) (需要科学上网)
25. LiveMe (https://www.liveme.com/zh/v/17141543493018047815/index.html)
26. 花椒直播 (https://www.huajiao.com/l/345096174)
27. 流星直播 (https://www.7u66.com/100960)
28. ShowRoom (https://www.showroom-live.com/room/profile?room_id=480206) (需要科学上网)
29. Acfun (https://live.acfun.cn/live/179922)
30. 映客直播 (https://www.inke.cn/liveroom/index.html?uid=22954469&id=1720860391070904)
31. 音播直播 (https://live.ybw1666.com/800002949)
32. 知乎直播 (https://www.zhihu.com/people/ac3a467005c5d20381a82230101308e9)
33. CHZZK (https://chzzk.naver.com/live/458f6ec20b034f49e0fc6d03921646d2) (需要科学上网)
34. 嗨秀直播 (https://www.haixiutv.com/6095106)
35. VV星球直播 (https://h5webcdn-pro.vvxqiu.com//activity/videoShare/videoShare.html?h5Server=https://h5p.vvxqiu.com&roomId=LP115924473&platformId=vvstar)
36. 17Live (https://17.live/en/live/6302408) (需要科学上网)
37. 浪Live (https://www.lang.live/en-US/room/3349463) (需要科学上网)
38. 畅聊直播 (https://live.tlclw.com/106188)
39. 飘飘直播 (https://m.pp.weimipopo.com/live/preview.html?uid=91648673&anchorUid=91625862&app=plpl)
40. 六间房直播 (https://v.6.cn/634435)
41. 乐嗨直播 (https://www.lehaitv.com/8059096)
42. 花猫直播 (https://h.catshow168.com/live/preview.html?uid=19066357&anchorUid=18895331)
43. Shopee (https://sg.shp.ee/GmpXeuf?uid=1006401066&session=802458) (需要科学上网)
44. Youtube (https://www.youtube.com/watch?v=cS6zS5hi1w0) (需要科学上网)
45. 淘宝直播 (https://m.tb.cn/h.TWp0HTd) (需要Cookie)
46. 京东直播 (https://3.cn/28MLBy-E)
47. Faceit (https://www.faceit.com/zh/players/Compl1/stream) (需要科学上网)

### 管理员功能

管理员可以在平台管理页面对各平台进行启用或禁用操作，平台名称和链接格式是固定的，不支持修改。

**注意**：标记为"需要科学上网"的平台需要在具有网络代理的环境中使用。

### 平台容量设置

系统会在创建新平台时，自动为所有现有工作节点添加该平台的默认容量配置，初始最大录制数为3。如果您需要为现有平台设置默认容量配置，可以运行以下命令：

```bash
pnpm setup:platform-capacity
```

该命令会检查所有平台和工作节点的组合，如果没有对应的容量配置，则创建默认配置（最大录制数为3）。

### 创建录制任务

创建录制任务时，可以选择平台并按照要求填写直播地址，系统会自动检查链接格式是否符合所选平台的规范。

每个平台的配置相同，需要填写：

1. 直播地址列表（一行一个地址）
2. Cookie（可选，用于需要登录才能访问的直播）**【注意：Cookie字段功能暂未实现】**

### 工作节点管理

- **工作节点状态监控**：实时监控工作节点的运行状态和负载情况
- **平台专属工作节点**：为特定平台配置专属工作节点
- **项目关联**：工作节点可关联到特定项目，也可作为通用工作节点服务于所有项目
- **自动分配**：任务启动时自动分配合适的工作节点进行录制
- **节点可见性**：
  - 超级管理员可以查看所有工作节点
  - 普通用户可以查看自己所在项目的专有节点和所有通用节点
  - 按平台筛选工作节点功能仅对超级管理员可用
- **平台特定录制容量**：超级管理员可以为每个工作节点设置各平台的最大录制容量

### 直播录制任务管理

- **任务创建**：所有用户都可创建新的直播录制任务，支持配置录制参数
- **多直播间支持**：单个任务最多可添加3个直播间地址（针对抖音平台）
- **任务控制**：支持启动、暂停、终止和删除任务
- **任务监控**：实时查看任务运行状态和日志
- **录制历史**：查看和管理历史录制内容
- **任务可见性**：
  - 超级管理员可以查看系统中的所有任务
  - 项目管理员可以查看其管理项目中的所有任务
  - 普通用户只能查看自己创建的任务
- **任务编辑权限**：
  - 超级管理员可以编辑任何任务
  - 项目管理员可以编辑所管理项目中的所有任务
  - 普通用户只能编辑自己创建的任务

### 录制记录与上播状态管理

- **录制时间段记录**：系统自动记录任务的每次启动和停止时间，提供详细的录制历史
- **记录清空功能**：任务停止状态下，管理员和任务创建者可清空历史录制记录
- **记录折叠功能**：当录制记录较多时，可折叠显示以提升界面体验
- **上播状态跟踪**：显示任务中正在上播的直播间数量与总直播间数量
- **录制状态监控**：显示当前活跃录制的直播间数量与总直播间数量
- **节点状态警告**：当工作节点异常时，系统自动显示警告信息

### 多主题支持

系统提供了丰富的主题选择功能，用户可以根据个人偏好定制界面外观：

- **默认主题**：
  - **默认浅色**：清爽明亮的白色主题
  - **默认深色**：护眼友好的深色主题
  
- **自定义彩色主题**：
  - **翠绿主题**：以绿色为基调的清新主题
  - **蓝海主题**：以蓝色为基调的专业主题
  - **紫晶主题**：以紫色为基调的优雅主题
  - **玫瑰主题**：以粉色为基调的温暖主题
  - **琥珀主题**：以金黄色为基调的活力主题

- **主题切换**：用户可以通过界面右上角的主题选择器随时切换主题
- **主题持久化**：系统会记住用户的主题选择，下次访问时自动应用
- **系统主题适配**：支持跟随系统主题自动切换浅色/深色模式

## 技术栈

- **前端框架**：Next.js 15（React 19）
- **UI组件库**：Radix UI + Tailwind CSS
- **认证方案**：NextAuth.js
- **数据库**：MySQL + Prisma ORM
- **状态管理**：React Hook Form + Zod
- **主题系统**：next-themes + CSS变量

## 系统架构

系统采用现代化的前端架构，基于Next.js的App Router实现，主要模块包括：

- `/app`：应用主目录，包含所有页面和路由
  - `/admin`：管理员专属功能（用户管理、平台管理）
  - `/dashboard`：用户仪表盘，展示概览信息
  - `/login` & `/register`：用户认证页面
  - `/projects`：项目管理和详情页
    - `/projects/[id]/tasks`：特定项目的任务管理
  - `/tasks`：录制任务管理

## 菜单结构

系统菜单结构如下：

- **控制面板**：系统概览和用户仪表盘
- **录制任务**：录制任务管理
- **工作节点**：工作节点管理和状态监控（所有用户可见，但展示内容根据权限不同）
- **系统管理**（仅对超级管理员可见）：
  - 用户管理
  - 平台管理
  - 项目管理

## 使用指南

### 环境要求

- Node.js 18+
- MySQL数据库
- PNPM包管理器

### 安装步骤

1. 克隆代码库

   ```bash
   git clone [仓库地址]
   cd live-streaming-management
   ```
2. 安装依赖

   ```bash
   pnpm install
   ```
3. 配置环境变量
   创建 `.env`文件并添加必要的环境变量：

   ```
   DATABASE_URL="mysql://用户名:密码@localhost:3306/live_streaming_management?schema=public&connectionTimeZone=Asia/Shanghai"
   NEXTAUTH_SECRET="您的认证密钥"
   NEXTAUTH_URL="http://localhost:3000"
   ```
4. 运行数据库迁移

   ```bash
   npx prisma migrate dev

   # 初始化平台数据
   pnpm setup:platforms
   ```
5. 启动开发服务器

   ```bash
   pnpm dev
   ```
6. 访问应用
   打开浏览器访问 `http://localhost:3000`

## 权限与角色说明

1. **超级管理员**

   - 创建、编辑和删除项目
   - 管理所有用户权限
   - 管理平台配置
   - 管理工作节点配置
   - 拥有系统内全部功能权限
   - 可对所有任务进行操作，即使不是项目管理员
2. **项目管理员**

   - 管理特定项目的所有方面
   - 审批用户加入项目的申请
   - 创建和管理项目内的录制任务
   - 查看项目统计和日志
3. **项目成员/普通用户**

   - 查看已加入项目的信息
   - 创建和管理个人录制任务
   - 申请加入其他项目

## 录制任务与工作节点关联关系

### 任务资源管理

系统采用了资源复用策略，为提高工作节点的利用率：

1. **直播流共享**：

   - 多个任务录制相同的直播流时，只会占用一个工作节点槽位
   - 基于引用计数机制管理资源释放
2. **工作节点分配策略**：

   - 优先使用项目专属工作节点
   - 当专属节点不足时，使用通用工作节点
   - 当存在已分配的相同直播流时，复用现有节点
3. **资源隔离**：

   - 项目专属工作节点只服务于特定项目的任务
   - 不同项目间的专属工作节点资源不共享
   - 通用工作节点可被所有项目使用

### 数据库模型关系

- **RecordingTask**：录制任务
- **LiveStream**：直播流
- **WorkerNode**：工作节点
- **TaskLivestreamAssignment**：任务与直播流的关联
- **LivestreamWorkerAssignment**：直播流与工作节点的关联，包含引用计数

### 启动与停止流程

1. **任务启动流程**：

   - 检查任务直播URL对应的LiveStream记录
   - 为LiveStream分配合适的工作节点或复用现有分配
   - 创建录制时间段记录，开始时间为当前时间，结束时间为null
   - 初始化上播状态为未知
2. **任务停止流程**：

   - 更新录制时间段记录的结束时间
   - 减少直播流与工作节点分配的引用计数
   - 当引用计数为0时，释放工作节点资源
   - 重置上播状态

## 联系作者

如有任何问题或建议，请通过以下方式联系作者：

- 邮箱：521274311@qq.com

## 许可证

本项目采用 MIT 许可证。详细许可条款请参阅项目根目录中的 LICENSE 文件。

## 平台URL验证

系统支持多种直播平台的URL格式验证：

1. 每个平台都有特定的URL模式，例如抖音平台现在支持三种格式：

   - 数字ID格式: `https://live.douyin.com/123456789`
   - 字母数字混合ID格式: `https://live.douyin.com/yall1102`
   - 短链接格式: `https://v.douyin.com/iQFeBnt/`
2. 部分海外平台（如TikTok, YouTube等）需要科学上网才能访问，系统会在平台名称后显示"(需要科学上网)"提示。
3. 淘宝直播平台需要提供Cookie信息才能正常录制。
