const scrapeBilibiliByAPI = require('./scraper/bilibili_api.js');
const fs = require('fs').promises;
const path = require('path');

// 默认关键词列表
const DEFAULT_KEYWORDS = [
  '秋招', '秋招面经', '校招', '校招面经', '面试', '面试经验', '面试题', 
  '简历', '求职', '找工作', '实习转正', '校园招聘', '互联网大厂', 
  '应届生', '毕业生', '招聘', '内推', '笔试', '技术面试', 'hr面',
  '薪资', 'offer', '面试准备', '面试技巧', '面试流程', '面试心得',
  'Java面试', '前端面试', '后端面试', '算法面试', '产品经理面试',
  '运营面试', '设计面试', '测试面试', '运维面试', '数据分析面试',
  '2025秋招', '2026校招', '秋招时间线', '秋招日程', '大厂秋招',
  '字节跳动', '腾讯', '阿里巴巴', '百度', '美团', '京东', '华为',
  '小米', '网易', '拼多多', '滴滴', '快手', 'B站', '小红书'
];

// 存储文件路径
const DATA_DIR = path.join(__dirname, '../data/job_trend_data');
const CONFIG_FILE_PATH = path.join(__dirname, '../data/config.json');

/**
 * 获取当前日期字符串 (YYYY-MM-DD)
 * @returns {string} 日期字符串
 */
function getCurrentDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * 获取指定日期的文件路径
 * @param {string} date - 日期字符串 (YYYY-MM-DD)
 * @returns {string} 文件路径
 */
function getDataFilePath(date) {
  return path.join(DATA_DIR, `${date}.json`);
}

/**
 * 加载配置
 * @returns {Promise<Object>} 配置对象
 */
async function loadConfig() {
  try {
    const data = await fs.readFile(CONFIG_FILE_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // 如果文件不存在，返回默认配置
    return {
      keywords: DEFAULT_KEYWORDS
    };
  }
}

/**
 * 保存配置
 * @param {Object} config - 配置对象
 */
async function saveConfig(config) {
  try {
    // 确保data目录存在
    await fs.mkdir(path.dirname(CONFIG_FILE_PATH), { recursive: true });
    await fs.writeFile(CONFIG_FILE_PATH, JSON.stringify(config, null, 2));
    console.log('[Job Trend Tracker] 配置已保存到文件');
  } catch (error) {
    console.error('[Job Trend Tracker] 保存配置失败:', error.message);
  }
}

/**
 * 加载指定日期的数据
 * @param {string} date - 日期字符串 (YYYY-MM-DD)
 * @returns {Promise<Object>} 数据对象
 */
async function loadData(date) {
  try {
    const filePath = getDataFilePath(date);
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // 如果文件不存在，返回空对象
    return {};
  }
}

/**
 * 保存数据到指定日期的文件
 * @param {Object} data - 要保存的数据
 * @param {string} date - 日期字符串 (YYYY-MM-DD)
 */
async function saveData(data, date) {
  try {
    const filePath = getDataFilePath(date);
    // 确保data目录存在
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    console.log(`[Job Trend Tracker] ${date} 的数据已保存到文件`);
  } catch (error) {
    console.error('[Job Trend Tracker] 保存数据失败:', error.message);
  }
}

/**
 * 计算视频热度分数（基于播放量、点赞数、收藏数、弹幕数和时间因素）
 * @param {Object} video - 视频对象
 * @returns {number} 热度分数
 */
function calculateHotScore(video) {
  const { views, likes, favorites, danmaku } = video.metrics;
  
  // 基础热度计算
  let score = views + likes * 2 + favorites * 3 + danmaku * 1.5;
  
  // 添加时间因素：越近的视频热度越高
  const now = new Date();
  const videoTime = new Date(video.posted_at);
  const diffHours = (now - videoTime) / (1000 * 60 * 60);
  
  // 如果视频在24小时内，给予额外的热度加成
  if (diffHours <= 24) {
    // 越近的视频加成越高，1小时内加成50%，24小时内递减到0%
    const timeBoost = Math.max(0, (24 - diffHours) / 24 * 0.5);
    score = score * (1 + timeBoost);
  }
  
  return score;
}

/**
 * 更新榜单数据
 * @param {Array<Object>} videos - 新获取的视频列表
 * @param {Object} dailyData - 当天的数据
 */
function updateRankings(videos, dailyData) {
  // 处理每个视频
  for (const video of videos) {
    const videoId = video.uid;
    
    // 如果视频已存在，更新数据；否则添加新视频
    if (dailyData[videoId]) {
      // 更新现有视频数据
      dailyData[videoId] = {
        ...dailyData[videoId],
        ...video,
        hot_score: calculateHotScore(video),
        last_seen: new Date().toISOString()
      };
    } else {
      // 添加新视频
      dailyData[videoId] = {
        ...video,
        hot_score: calculateHotScore(video),
        first_seen: new Date().toISOString(),
        last_seen: new Date().toISOString()
      };
    }
  }
  
  return dailyData;
}

/**
 * 检查视频是否在24小时内
 * @param {Object} video - 视频对象
 * @returns {boolean} 是否在24小时内
 */
function isWithin24Hours(video) {
  const now = new Date();
  const videoTime = new Date(video.posted_at || video.first_seen);
  const diffHours = (now - videoTime) / (1000 * 60 * 60);
  return diffHours <= 24;
}

/**
 * 生成榜单
 * @param {Object} dailyData - 当天的数据
 * @returns {Array<Object>} 排名前50的视频列表
 */
function generateRankings(dailyData) {
  // 只保留24小时内的视频
  const recentVideos = Object.values(dailyData).filter(isWithin24Hours);
  
  // 按热度分数排序
  recentVideos.sort((a, b) => b.hot_score - a.hot_score);
  
  // 返回前50名
  return recentVideos.slice(0, 50);
}

/**
 * 主函数：执行一次榜单更新
 */
async function runJobTrendTracker(progressCallback) {
  console.log('[Job Trend Tracker] 开始执行秋招趋势榜单更新...');
  
  // 获取当前日期
  const currentDate = getCurrentDate();
  
  // 加载当天的数据
  const dailyData = await loadData(currentDate);
  
  // 加载配置获取关键词列表
  const config = await loadConfig();
  const keywords = Array.isArray(config.keywords) && config.keywords.length > 0 ? config.keywords : DEFAULT_KEYWORDS;
  
  // 遍历所有关键词进行搜索
  for (let i = 0; i < keywords.length; i++) {
    const keyword = keywords[i];
    try {
      // 调用进度回调函数（如果提供）
      if (progressCallback) {
        progressCallback(i + 1, keywords.length, keyword);
      }
      
      console.log(`[Job Trend Tracker] 正在搜索关键词: ${keyword} (${i + 1}/${keywords.length})`);
      
      // 获取视频数据
      const videos = await scrapeBilibiliByAPI(keyword, { 
        order: 'pubdate', // 按最新发布排序
        pagesize: 20      // 每个关键词获取20个最新视频
      });
      
      console.log(`[Job Trend Tracker] 关键词 "${keyword}" 获取到 ${videos.length} 个视频`);
      
      // 更新榜单数据
      updateRankings(videos, dailyData);
      
      // 添加延迟，避免请求过于频繁
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`[Job Trend Tracker] 处理关键词 "${keyword}" 时出错:`, error.message);
    }
  }
  
  // 保存更新后的数据
  await saveData(dailyData, currentDate);
  
  // 生成并显示当前榜单
  const rankings = generateRankings(dailyData);
  console.log(`\n=== ${currentDate} 秋招趋势榜单 (前10名) ===`);
  rankings.slice(0, 10).forEach((video, index) => {
    console.log(`${index + 1}. ${video.title} - ${video.author} (热度: ${Math.round(video.hot_score)})`);
    console.log(`   播放: ${video.metrics.views} | 点赞: ${video.metrics.likes} | 收藏: ${video.metrics.favorites}`);
    console.log(`   URL: ${video.url}`);
    console.log('');
  });
  
  console.log('[Job Trend Tracker] 本轮榜单更新完成!');
  
  // 完成回调
  if (progressCallback) {
    progressCallback(keywords.length, keywords.length, '完成');
  }
  
  return { success: true, data: { rankings, date: currentDate } };
}

// 如果直接运行此脚本，则执行一次榜单更新
if (require.main === module) {
  runJobTrendTracker();
}

module.exports = {
  runJobTrendTracker,
  loadConfig,
  saveConfig,
  loadData,
  generateRankings
};