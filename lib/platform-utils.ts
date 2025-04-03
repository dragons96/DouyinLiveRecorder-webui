/**
 * 平台工具类，用于处理各平台链接验证等功能
 */

type PlatformUrlPattern = {
  name: string;
  pattern: RegExp;
  exampleUrl: string;
};

// 定义各平台的URL格式验证
const platformPatterns: PlatformUrlPattern[] = [
  {
    name: "抖音",
    pattern: /^https:\/\/live\.douyin\.com\/\d+/,
    exampleUrl: "https://live.douyin.com/123456789",
  },
  {
    name: "快手",
    pattern: /^https:\/\/live\.kuaishou\.com\/u\/\w+/,
    exampleUrl: "https://live.kuaishou.com/u/yall1102",
  },
  {
    name: "虎牙",
    pattern: /^https:\/\/www\.huya\.com\/\d+/,
    exampleUrl: "https://www.huya.com/52333",
  },
  {
    name: "斗鱼",
    pattern: /^https:\/\/www\.douyu\.com\/(\d+|\w+\/\w+\?rid=\d+)(\?dyshid=|$)/,
    exampleUrl: "https://www.douyu.com/3637778?dyshid=",
  },
  {
    name: "YY",
    pattern: /^https:\/\/www\.yy\.com\/\d+\/\d+/,
    exampleUrl: "https://www.yy.com/22490906/22490906",
  },
  {
    name: "BiliBili",
    pattern: /^https:\/\/live\.bilibili\.com\/\d+/,
    exampleUrl: "https://live.bilibili.com/320",
  },
  {
    name: "小红书",
    pattern: /^https:\/\/(www\.xiaohongshu\.com\/user\/profile\/\w+\?appuid=\w+|xhslink\.com\/\w+)/,
    exampleUrl: "https://www.xiaohongshu.com/user/profile/6330049c000000002303c7ed?appuid=5f3f478a00000000010005b3",
  },
  {
    name: "网易CC",
    pattern: /^https:\/\/cc\.163\.com\/\d+/,
    exampleUrl: "https://cc.163.com/583946984",
  },
  {
    name: "微博直播",
    pattern: /^https:\/\/weibo\.com\/l\/wblive\/p\/show\/\d+:\d+/,
    exampleUrl: "https://weibo.com/l/wblive/p/show/1022:2321325026370190442592",
  },
  {
    name: "酷狗直播",
    pattern: /^https:\/\/fanxing2\.kugou\.com\/\d+\?refer=\d+&sourceFrom=/,
    exampleUrl: "https://fanxing2.kugou.com/50428671?refer=2177&sourceFrom=",
  },
  {
    name: "知乎直播",
    pattern: /^https:\/\/www\.zhihu\.com\/people\/\w+/,
    exampleUrl: "https://www.zhihu.com/people/ac3a467005c5d20381a82230101308e9",
  },
  {
    name: "京东直播",
    pattern: /^https:\/\/\d+\.cn\/\w+-\w+/,
    exampleUrl: "https://3.cn/28MLBy-E",
  },
  {
    name: "花椒直播",
    pattern: /^https:\/\/www\.huajiao\.com\/l\/\d+/,
    exampleUrl: "https://www.huajiao.com/l/345096174",
  },
  {
    name: "百度直播",
    pattern: /^https:\/\/live\.baidu\.com\/m\/media\/pclive\/pchome\/live\.html\?room_id=\d+/,
    exampleUrl: "https://live.baidu.com/m/media/pclive/pchome/live.html?room_id=9175031377&tab_category",
  },
  {
    name: "千度热播",
    pattern: /^https:\/\/qiandurebo\.com\/web\/video\.php\?roomnumber=\d+/,
    exampleUrl: "https://qiandurebo.com/web/video.php?roomnumber=33333",
  },
];

/**
 * 验证平台URL是否符合格式要求
 * @param platformName 平台名称
 * @param url 要验证的URL
 * @returns 验证结果和错误信息
 */
export function validatePlatformUrl(platformName: string, url: string): { isValid: boolean; message?: string } {
  // 查找对应平台的验证规则
  const platformPattern = platformPatterns.find(p => p.name === platformName);
  
  if (!platformPattern) {
    return { isValid: false, message: `未找到平台 ${platformName} 的验证规则` };
  }
  
  // 验证URL格式
  if (!platformPattern.pattern.test(url)) {
    return { 
      isValid: false, 
      message: `${platformName} 平台链接格式不正确，请使用类似 ${platformPattern.exampleUrl} 的格式`
    };
  }
  
  return { isValid: true };
}

/**
 * 获取平台的URL样例
 * @param platformName 平台名称
 * @returns URL样例
 */
export function getPlatformExampleUrl(platformName: string): string | null {
  const platformPattern = platformPatterns.find(p => p.name === platformName);
  return platformPattern?.exampleUrl || null;
}

/**
 * 获取所有支持的平台名称
 * @returns 平台名称数组
 */
export function getSupportedPlatforms(): string[] {
  return platformPatterns.map(p => p.name);
} 