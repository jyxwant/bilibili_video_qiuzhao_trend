const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  getJobTrendData: (date) => ipcRenderer.invoke('get-job-trend-data', date),
  refreshJobTrendData: () => ipcRenderer.invoke('refresh-job-trend-data'),
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  onProgressUpdate: (callback) => ipcRenderer.on('progress-update', callback)
});