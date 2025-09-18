const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { runJobTrendTracker, loadConfig, saveConfig, loadData, generateRankings } = require('./job_trend_tracker.js');

// 禁用GPU加速，避免一些潜在问题
app.disableHardwareAcceleration();

// 主窗口
let mainWindow;

// 创建浏览器窗口
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // 直接加载秋招趋势榜单 HTML 文件
  mainWindow.loadFile('src/weibo_hot_rankings.html');

  // 打开开发者工具
  // mainWindow.webContents.openDevTools();
}

// 当 Electron 完成初始化并准备创建浏览器窗口时调用此方法
app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    // 在 macOS 上，当单击 dock 图标并且没有其他窗口打开时，通常会在应用程序中重新创建一个窗口。
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// 当所有窗口都关闭时退出应用
app.on('window-all-closed', function () {
  // 在 macOS 上，应用程序和它们的菜单栏通常会保持活动状态，直到用户明确退出
  if (process.platform !== 'darwin') app.quit();
});

// 存储进度监听器
let progressListener = null;

// 进度回调函数
function progressCallback(current, total, keyword) {
  if (progressListener) {
    progressListener(current, total, keyword);
  }
}

// 处理来自渲染进程的获取秋招趋势数据请求
ipcMain.handle('get-job-trend-data', async (event, date) => {
  try {
    // 加载指定日期的数据
    const dailyData = await loadData(date);
    
    // 生成排行榜
    const rankings = generateRankings(dailyData);
    
    return { 
      success: true, 
      data: {
        rankings: rankings,
        date: date
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 处理来自渲染进程的刷新秋招趋势数据请求
ipcMain.handle('refresh-job-trend-data', async () => {
  try {
    // 设置进度监听器
    progressListener = (current, total, keyword) => {
      // 发送进度更新到渲染进程
      mainWindow.webContents.send('progress-update', { current, total, keyword });
    };
    
    // 执行一次榜单更新
    const result = await runJobTrendTracker(progressCallback);
    
    // 清除进度监听器
    progressListener = null;
    
    return result;
  } catch (error) {
    // 清除进度监听器
    progressListener = null;
    return { success: false, error: error.message };
  }
});

// 处理来自渲染进程的获取配置请求
ipcMain.handle('get-config', async () => {
  try {
    const config = await loadConfig();
    return { success: true, data: config };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 处理来自渲染进程的保存配置请求
ipcMain.handle('save-config', async (event, config) => {
  try {
    await saveConfig(config);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});