/**
 * 平台工具类，用于处理各平台链接验证等功能
 */

type PlatformUrlPattern = {
  name: string;
  pattern: RegExp;
  exampleUrl: string;
  needVpn?: boolean; // 是否需要科学上网
};

// 定义各平台的URL格式验证
const platformPatterns: PlatformUrlPattern[] = [
  {
    name: "抖音",
    pattern: /^https:\/\/(live\.douyin\.com\/(\d+|[a-zA-Z0-9_]+)|v\.douyin\.com\/[a-zA-Z0-9]+\/?)/,
    exampleUrl: "例如：https://live.douyin.com/123456789、https://live.douyin.com/yall1102、https://v.douyin.com/iQFeBnt/",
  },
  {
    name: "TikTok",
    pattern: /^https:\/\/www\.tiktok\.com\/@[\w\.]+\/live/,
    exampleUrl: "https://www.tiktok.com/@pearlgaga88/live",
    needVpn: true,
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
    pattern: /^https:\/\/www\.douyu\.com\/((\d+)|\w+\/\w+\?rid=\d+)(\?dyshid=|$)/,
    exampleUrl: "https://www.douyu.com/3637778?dyshid=、https://www.douyu.com/topic/wzDBLS6?rid=4921614&dyshid=",
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
    exampleUrl: "https://www.xiaohongshu.com/user/profile/6330049c000000002303c7ed?appuid=5f3f478a00000000010005b3、http://xhslink.com/xpJpfM",
  },
  {
    name: "BIGO直播",
    pattern: /^https:\/\/www\.bigo\.tv\/cn\/\d+/,
    exampleUrl: "https://www.bigo.tv/cn/716418802",
  },
  {
    name: "Blued直播",
    pattern: /^https:\/\/app\.blued\.cn\/live\?id=\w+/,
    exampleUrl: "https://app.blued.cn/live?id=Mp6G2R",
  },
  {
    name: "SOOP",
    pattern: /^https:\/\/play\.sooplive\.co\.kr\/\w+/,
    exampleUrl: "https://play.sooplive.co.kr/sw7love",
    needVpn: true,
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
    name: "千度热播",
    pattern: /^https:\/\/qiandurebo\.com\/web\/video\.php\?roomnumber=\d+/,
    exampleUrl: "https://qiandurebo.com/web/video.php?roomnumber=33333",
  },
  {
    name: "PandaTV",
    pattern: /^https:\/\/www\.pandalive\.co\.kr\/live\/play\/\w+/,
    exampleUrl: "https://www.pandalive.co.kr/live/play/bara0109",
    needVpn: true,
  },
  {
    name: "猫耳FM",
    pattern: /^https:\/\/fm\.missevan\.com\/live\/\d+/,
    exampleUrl: "https://fm.missevan.com/live/868895007",
  },
  {
    name: "Look直播",
    pattern: /^https:\/\/look\.163\.com\/live\?id=\d+/,
    exampleUrl: "https://look.163.com/live?id=65108820&position=3",
  },
  {
    name: "WinkTV",
    pattern: /^https:\/\/www\.winktv\.co\.kr\/live\/play\/\w+/,
    exampleUrl: "https://www.winktv.co.kr/live/play/anjer1004",
    needVpn: true,
  },
  {
    name: "FlexTV",
    pattern: /^https:\/\/www\.flextv\.co\.kr\/channels\/\d+\/live/,
    exampleUrl: "https://www.flextv.co.kr/channels/593127/live",
    needVpn: true,
  },
  {
    name: "PopkonTV",
    pattern: /^https:\/\/www\.popkontv\.com\/(live\/view\?castId=\w+|channel\/notices\?mcid=\w+)/,
    exampleUrl: "https://www.popkontv.com/live/view?castId=wjfal007&partnerCode=P-00117",
    needVpn: true,
  },
  {
    name: "TwitCasting",
    pattern: /^https:\/\/twitcasting\.tv\/\w+/,
    exampleUrl: "https://twitcasting.tv/c:uonq",
    needVpn: true,
  },
  {
    name: "百度直播",
    pattern: /^https:\/\/live\.baidu\.com\/m\/media\/pclive\/pchome\/live\.html\?room_id=\d+/,
    exampleUrl: "https://live.baidu.com/m/media/pclive/pchome/live.html?room_id=9175031377&tab_category",
  },
  {
    name: "酷狗直播",
    pattern: /^https:\/\/fanxing2\.kugou\.com\/\d+\?refer=\d+&sourceFrom=/,
    exampleUrl: "https://fanxing2.kugou.com/50428671?refer=2177&sourceFrom=",
  },
  {
    name: "TwitchTV",
    pattern: /^https:\/\/www\.twitch\.tv\/\w+/,
    exampleUrl: "https://www.twitch.tv/gamerbee",
    needVpn: true,
  },
  {
    name: "LiveMe",
    pattern: /^https:\/\/www\.liveme\.com\/zh\/v\/\d+\/index\.html/,
    exampleUrl: "https://www.liveme.com/zh/v/17141543493018047815/index.html",
  },
  {
    name: "花椒直播",
    pattern: /^https:\/\/www\.huajiao\.com\/l\/\d+/,
    exampleUrl: "https://www.huajiao.com/l/345096174",
  },
  {
    name: "流星直播",
    pattern: /^https:\/\/www\.7u66\.com\/\d+/,
    exampleUrl: "https://www.7u66.com/100960",
  },
  {
    name: "ShowRoom",
    pattern: /^https:\/\/www\.showroom-live\.com\/room\/profile\?room_id=\d+/,
    exampleUrl: "https://www.showroom-live.com/room/profile?room_id=480206",
    needVpn: true,
  },
  {
    name: "Acfun",
    pattern: /^https:\/\/live\.acfun\.cn\/live\/\d+/,
    exampleUrl: "https://live.acfun.cn/live/179922",
  },
  {
    name: "映客直播",
    pattern: /^https:\/\/www\.inke\.cn\/liveroom\/index\.html\?uid=\d+/,
    exampleUrl: "https://www.inke.cn/liveroom/index.html?uid=22954469&id=1720860391070904",
  },
  {
    name: "音播直播",
    pattern: /^https:\/\/live\.ybw1666\.com\/\d+/,
    exampleUrl: "https://live.ybw1666.com/800002949",
  },
  {
    name: "知乎直播",
    pattern: /^https:\/\/www\.zhihu\.com\/people\/\w+/,
    exampleUrl: "https://www.zhihu.com/people/ac3a467005c5d20381a82230101308e9",
  },
  {
    name: "CHZZK",
    pattern: /^https:\/\/chzzk\.naver\.com\/live\/\w+/,
    exampleUrl: "https://chzzk.naver.com/live/458f6ec20b034f49e0fc6d03921646d2",
    needVpn: true,
  },
  {
    name: "嗨秀直播",
    pattern: /^https:\/\/www\.haixiutv\.com\/\d+/,
    exampleUrl: "https://www.haixiutv.com/6095106",
  },
  {
    name: "VV星球直播",
    pattern: /^https:\/\/h5webcdn-pro\.vvxqiu\.com\/\/activity\/videoShare\/videoShare\.html.*roomId=\w+/,
    exampleUrl: "https://h5webcdn-pro.vvxqiu.com//activity/videoShare/videoShare.html?h5Server=https://h5p.vvxqiu.com&roomId=LP115924473&platformId=vvstar",
  },
  {
    name: "17Live",
    pattern: /^https:\/\/17\.live\/\w+\/live\/\d+/,
    exampleUrl: "https://17.live/en/live/6302408",
    needVpn: true,
  },
  {
    name: "浪Live",
    pattern: /^https:\/\/www\.lang\.live\/\w+\/room\/\d+/,
    exampleUrl: "https://www.lang.live/en-US/room/3349463",
    needVpn: true,
  },
  {
    name: "畅聊直播",
    pattern: /^https:\/\/live\.tlclw\.com\/\d+/,
    exampleUrl: "https://live.tlclw.com/106188",
  },
  {
    name: "飘飘直播",
    pattern: /^https:\/\/m\.pp\.weimipopo\.com\/live\/preview\.html\?uid=\d+/,
    exampleUrl: "https://m.pp.weimipopo.com/live/preview.html?uid=91648673&anchorUid=91625862&app=plpl",
  },
  {
    name: "六间房直播",
    pattern: /^https:\/\/v\.6\.cn\/\d+/,
    exampleUrl: "https://v.6.cn/634435",
  },
  {
    name: "乐嗨直播",
    pattern: /^https:\/\/www\.lehaitv\.com\/\d+/,
    exampleUrl: "https://www.lehaitv.com/8059096",
  },
  {
    name: "花猫直播",
    pattern: /^https:\/\/h\.catshow168\.com\/live\/preview\.html\?uid=\d+/,
    exampleUrl: "https://h.catshow168.com/live/preview.html?uid=19066357&anchorUid=18895331",
  },
  {
    name: "Shopee",
    pattern: /^https:\/\/\w+\.shp\.ee\/\w+/,
    exampleUrl: "https://sg.shp.ee/GmpXeuf?uid=1006401066&session=802458",
    needVpn: true,
  },
  {
    name: "Youtube",
    pattern: /^https:\/\/www\.youtube\.com\/watch\?v=[\w-]+/,
    exampleUrl: "https://www.youtube.com/watch?v=cS6zS5hi1w0",
    needVpn: true,
  },
  {
    name: "淘宝直播",
    pattern: /^https:\/\/m\.tb\.cn\/\w+\.\w+/,
    exampleUrl: "https://m.tb.cn/h.TWp0HTd",
  },
  {
    name: "京东直播",
    pattern: /^https:\/\/\d+\.cn\/\w+-\w+/,
    exampleUrl: "https://3.cn/28MLBy-E",
  },
  {
    name: "Faceit",
    pattern: /^https:\/\/www\.faceit\.com\/\w+\/players\/\w+\/stream/,
    exampleUrl: "https://www.faceit.com/zh/players/Compl1/stream",
    needVpn: true,
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
 * 检查平台是否需要科学上网
 * @param platformName 平台名称
 * @returns 是否需要科学上网
 */
export function isPlatformRequireVpn(platformName: string): boolean {
  const platformPattern = platformPatterns.find(p => p.name === platformName);
  return platformPattern?.needVpn || false;
}

/**
 * 获取所有支持的平台名称
 * @returns 平台名称数组
 */
export function getSupportedPlatforms(): string[] {
  return platformPatterns.map(p => p.name);
}

/**
 * 获取所有需要科学上网的平台名称
 * @returns 平台名称数组
 */
export function getVpnRequiredPlatforms(): string[] {
  return platformPatterns.filter(p => p.needVpn).map(p => p.name);
} 