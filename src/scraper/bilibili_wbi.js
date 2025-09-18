const axios = require('axios');
const crypto = require('crypto');

// WBI签名算法的固定映射表
const MIXIN_KEY_ENCODE_TABLE = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
  33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
  61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
  36, 20, 34, 44, 52
];

/**
 * 从URL中提取密钥
 * @param {string} url - 包含密钥的URL
 * @returns {string} 提取的密钥
 */
function extractKeyFromUrl(url) {
  const match = url.match(/\/([^\/]+)\.png$/);
  return match ? match[1] : '';
}

/**
 * 获取WBI密钥(img_key和sub_key)
 * @returns {Promise<{img_key: string, sub_key: string}>} WBI密钥对象
 */
async function getWbiKeys() {
  try {
    // 通过nav接口获取密钥URL
    const response = await axios.get('https://api.bilibili.com/x/web-interface/nav', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
        'Referer': 'https://www.bilibili.com/'
      }
    });
    
    const { img_url, sub_url } = response.data.data.wbi_img;
    return {
      img_key: extractKeyFromUrl(img_url),
      sub_key: extractKeyFromUrl(sub_url)
    };
  } catch (error) {
    console.error('获取WBI密钥失败:', error.message);
    throw error;
  }
}

/**
 * 通过映射表对字符串进行重排获取mixin_key
 * @param {string} originalKey - 原始密钥(img_key和sub_key拼接)
 * @returns {string} 重排后的mixin_key
 */
function getMixinKey(originalKey) {
  return MIXIN_KEY_ENCODE_TABLE.reduce((acc, curr) => acc + originalKey[curr], '').substring(0, 32);
}

/**
 * 对参数进行WBI签名
 * @param {Object} params - 需要签名的参数对象
 * @param {string} mixin_key - mixin_key
 * @returns {Object} 添加了签名参数的对象
 */
function encWbi(params, mixin_key) {
  // 添加时间戳参数
  const wts = Math.floor(Date.now() / 1000);
  const paramsWithWts = { ...params, wts };
  
  // 按键名排序
  const sortedKeys = Object.keys(paramsWithWts).sort();
  
  // 拼接成查询字符串
  const queryString = sortedKeys
    .map(key => {
      // 对value进行一些特殊字符的过滤，这是B站JS代码中的逻辑
      const value = paramsWithWts[key].toString().replace(/[!'()*]/g, '');
      return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
    })
    .join('&');
  
  // 计算MD5签名
  const w_rid = crypto.createHash('md5').update(queryString + mixin_key).digest('hex');
  
  return {
    ...params,
    w_rid,
    wts
  };
}

/**
 * 获取buvid3值
 * @returns {Promise<string>} buvid3值
 */
async function getBuvid3() {
  // 使用一个固定的buvid3值，避免每次都请求
  // 实际项目中应该从浏览器中获取真实的buvid3
  return 'XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX';
}

module.exports = {
  getWbiKeys,
  getMixinKey,
  encWbi,
  getBuvid3
};