// 微博热搜风格榜单页面的JavaScript代码

// DOM元素
const refreshBtn = document.getElementById('refresh-btn');
const rankingsList = document.getElementById('rankings-list');
const statusMessage = document.getElementById('status-message');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const keywordsListTextarea = document.getElementById('keywords-list');
const addDefaultKeywordsBtn = document.getElementById('add-default-keywords-btn');
const clearKeywordsBtn = document.getElementById('clear-keywords-btn');

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

// 初始化页面
document.addEventListener('DOMContentLoaded', async () => {
  // 加载配置
  await loadConfig();
  
  // 加载并显示排行榜
  await loadAndDisplayRankings();
  
  // 监听进度更新
  window.electronAPI.onProgressUpdate((event, data) => {
    const { current, total, keyword } = data;
    if (current <= total) {
      showStatus(`正在搜索: ${keyword} (${current}/${total})`, 'loading');
    }
  });
});

// 刷新按钮点击事件
refreshBtn.addEventListener('click', async () => {
  showStatus('正在刷新数据...', 'loading');
  
  try {
    const result = await window.electronAPI.refreshJobTrendData();
    if (result.success) {
      showStatus('数据刷新成功!', 'success');
      // 重新加载数据
      await loadAndDisplayRankings();
    } else {
      showStatus(`数据刷新失败: ${result.error}`, 'error');
    }
  } catch (error) {
    showStatus(`数据刷新失败: ${error.message}`, 'error');
  }
});

// 设置按钮点击事件
settingsBtn.addEventListener('click', () => {
  settingsModal.style.display = 'flex';
});

// 关闭模态框按钮点击事件
closeModalBtn.addEventListener('click', () => {
  settingsModal.style.display = 'none';
});

// 点击模态框外部关闭
window.addEventListener('click', (event) => {
  if (event.target === settingsModal) {
    settingsModal.style.display = 'none';
  }
});

// 添加默认关键词按钮点击事件
addDefaultKeywordsBtn.addEventListener('click', () => {
  keywordsListTextarea.value = DEFAULT_KEYWORDS.join('\n');
});

// 清空关键词按钮点击事件
clearKeywordsBtn.addEventListener('click', () => {
  keywordsListTextarea.value = '';
});

// 保存设置按钮点击事件
saveSettingsBtn.addEventListener('click', async () => {
  const keywords = keywordsListTextarea.value.split('\n').filter(keyword => keyword.trim() !== '');
  
  try {
    const result = await window.electronAPI.saveConfig({ keywords });
    if (result.success) {
      showStatus('设置保存成功!', 'success');
      settingsModal.style.display = 'none';
    } else {
      showStatus(`设置保存失败: ${result.error}`, 'error');
    }
  } catch (error) {
    showStatus(`设置保存失败: ${error.message}`, 'error');
  }
});

// 加载并显示排行榜
async function loadAndDisplayRankings() {
  try {
    showStatus('正在加载数据...', 'loading');
    // 获取当前日期
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const currentDate = `${year}-${month}-${day}`;
    
    const result = await window.electronAPI.getJobTrendData(currentDate);
    
    if (result.success) {
      renderRankings(result.data.rankings);
      showStatus('', ''); // 清除状态消息
    } else {
      showStatus(`数据加载失败: ${result.error}`, 'error');
    }
  } catch (error) {
    showStatus(`数据加载失败: ${error.message}`, 'error');
  }
}

// 渲染排行榜
function renderRankings(rankings) {
  if (!rankings || rankings.length === 0) {
    rankingsList.innerHTML = '<div class="no-data">暂无数据</div>';
    return;
  }
  
  rankingsList.innerHTML = rankings.map((video, index) => {
    const rank = index + 1;
    let rankClass = 'normal';
    if (rank <= 3) {
      rankClass = 'top3';
    }
    
    return `
      <a href="${video.url}" target="_blank" class="rank-item">
        <div class="rank-number ${rankClass}">${rank}</div>
        <div class="rank-content">
          <div class="rank-title">${escapeHtml(video.title)}</div>
          <div class="rank-meta">
            <span class="rank-author">作者: ${escapeHtml(video.author)}</span>
            <span class="rank-time">${formatDate(video.posted_at)}</span>
            <span class="rank-hot">热度: <span class="rank-hot-value">${formatNumber(video.hot_score)}</span></span>
          </div>
        </div>
      </a>
    `;
  }).join('');
}

// 加载配置
async function loadConfig() {
  try {
    const result = await window.electronAPI.getConfig();
    if (result.success) {
      const config = result.data;
      // 将关键词数组转换为多行文本
      keywordsListTextarea.value = Array.isArray(config.keywords) ? config.keywords.join('\n') : '';
    }
  } catch (error) {
    console.error('加载配置失败:', error);
  }
}

// 显示状态消息
function showStatus(message, type) {
  statusMessage.className = type;
  statusMessage.textContent = message;
  
  // 3秒后自动清除成功消息
  if (type === 'success') {
    setTimeout(() => {
      statusMessage.textContent = '';
      statusMessage.className = '';
    }, 3000);
  }
}

// 转义HTML特殊字符
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// 格式化数字显示
function formatNumber(num) {
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + '万';
  }
  return num.toLocaleString();
}

// 格式化日期显示
function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  
  if (diffDays > 0) {
    return `${diffDays}天前`;
  } else if (diffHours > 0) {
    return `${diffHours}小时前`;
  } else if (diffMinutes > 0) {
    return `${diffMinutes}分钟前`;
  } else {
    return '刚刚';
  }
}