const axios = require('axios');
const { getWbiKeys, getMixinKey, encWbi, getBuvid3 } = require('./bilibili_wbi.js');
const path = require('path');

// 缓存WBI密钥和buvid3
let cachedWbiKeys = null;
let cachedBuvid3 = null;
let lastWbiKeyUpdate = 0;

/**
 * 更新WBI密钥缓存
 */
async function updateWbiKeysCache() {
  try {
    // 每小时更新一次密钥
    if (!cachedWbiKeys || Date.now() - lastWbiKeyUpdate > 3600000) {
      console.log('[Bilibili API] 正在更新WBI密钥...');
      cachedWbiKeys = await getWbiKeys();
      lastWbiKeyUpdate = Date.now();
      console.log('[Bilibili API] WBI密钥更新完成');
    }
  } catch (error) {
    console.error('[Bilibili API] 更新WBI密钥失败:', error.message);
    // 如果获取失败且没有缓存，则抛出错误
    if (!cachedWbiKeys) {
      throw error;
    }
  }
}

/**
 * 更新buvid3缓存
 */
async function updateBuvid3Cache() {
  try {
    // 每小时更新一次buvid3
    if (!cachedBuvid3 || Date.now() - lastWbiKeyUpdate > 3600000) {
      console.log('[Bilibili API] 正在更新buvid3...');
      cachedBuvid3 = await getBuvid3();
      console.log('[Bilibili API] buvid3更新完成');
    }
  } catch (error) {
    console.error('[Bilibili API] 更新buvid3失败:', error.message);
    // 如果获取失败且没有缓存，则使用默认值
    if (!cachedBuvid3) {
      cachedBuvid3 = 'UNKNOWN';
    }
  }
}

/**
 * 通过B站API搜索秋招相关视频
 * @param {string} keyword - 搜索关键词
 * @param {Object} options - 搜索选项
 * @returns {Promise<Array<object>>} - 格式化后的帖子对象数组
 */
async function scrapeBilibiliByAPI(keyword, options = {}) {
  const formattedPosts = [];
  
  try {
    // 更新WBI密钥和buvid3缓存
    await updateWbiKeysCache();
    await updateBuvid3Cache();
    
    // 获取mixin_key
    const mixinKey = getMixinKey(cachedWbiKeys.img_key + cachedWbiKeys.sub_key);
    
    // 计算24小时前的时间戳
    const twentyFourHoursAgo = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000);
    
    // 准备搜索参数，默认按最新发布排序
    const searchParams = {
      search_type: 'video',
      keyword: keyword,
      order: options.order || 'pubdate', // 默认按发布时间排序
      page: options.page || 1,
      pagesize: options.pagesize || 20,
      duration: options.duration || 0,
      tids: options.tids || 0,
      // 添加时间范围限制，只搜索24小时内的视频
      pubdate_from: twentyFourHoursAgo
    };
    
    // 对参数进行WBI签名
    const signedParams = encWbi(searchParams, mixinKey);
    
    // 使用旧版搜索接口（根据命令运行结果.txt中的curl命令）
    const searchURL = 'https://api.bilibili.com/x/web-interface/search/type';
    
    // 添加重试机制
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount <= maxRetries) {
      try {
        const response = await axios.get(searchURL, {
          params: signedParams,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
            'Referer': 'https://search.bilibili.com/',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Cookie': `buvid3=${cachedBuvid3}; SESSDATA=xxx` // 添加SESSDATA
          }
        });

        // 检查响应状态
        if (response.data.code !== 0) {
          console.error(`[Bilibili API] API返回错误: ${response.data.message}`);
          // 如果是WBI签名错误(-412)，强制更新密钥后重试
          if (response.data.code === -412 && retryCount < maxRetries) {
            console.log(`[Bilibili API] 遇到WBI签名错误，正在强制更新密钥并重试(${retryCount + 1}/${maxRetries})...`);
            lastWbiKeyUpdate = 0; // 强制更新
            await updateWbiKeysCache();
            retryCount++;
            continue;
          }
          // 其他错误直接返回
          return formattedPosts;
        }

        // 处理搜索结果
        const results = response.data.data?.result || [];
        console.log(`[Bilibili API] 成功获取到 ${results.length} 条视频信息`);
        
        for (const video of results) {
          // 去除标题中的HTML标签
          const cleanTitle = video.title.replace(/<em class="keyword">(.*?)<\/em>/g, '$1');
          const post = {
            uid: `bilibili_${video.bvid}`,
            platform: 'B站',
            url: video.arcurl.startsWith('http') ? video.arcurl : `https:${video.arcurl}`,
            title: cleanTitle,
            author: video.author,
            posted_at: new Date(video.pubdate * 1000).toISOString(),
            content_snippet: video.description,
            tags: video.tag ? video.tag.split(',') : [],
            metrics: {
              views: video.play || 0, // 注意：视频播放量字段名为play
              likes: video.like || 0,
              favorites: video.favourite || 0, // 注意：收藏字段名为favourite
              coins: video.coin || 0,
              danmaku: video.danmaku || 0,
            },
            keyword_matched: keyword,
            // scraped_at, scan_id 等字段应在主流程中添加
          };
          formattedPosts.push(post);
        }
        
        console.log(`[Bilibili API] 总共解析到 ${formattedPosts.length} 个视频`);
        break; // 成功获取数据，跳出重试循环
      } catch (error) {
        retryCount++;
        if (retryCount <= maxRetries) {
          console.log(`[Bilibili API] 请求失败，正在重试(${retryCount}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // 递增延迟重试
        } else {
          throw error; // 达到最大重试次数，抛出错误
        }
      }
    }
    
    // 如果成功获取到数据，返回结果
    if (formattedPosts.length > 0) {
      return formattedPosts;
    }
    // 如果没有获取到数据，返回空数组
    return formattedPosts;
  } catch (error) {
    console.error(`[Bilibili API] 搜索关键词 "${keyword}" 失败:`, error.message);
    // 返回空数组而不是尝试降级
    return formattedPosts;
  }
}

module.exports = scrapeBilibiliByAPI;