const { runJobTrendTracker } = require('./job_trend_tracker.js');

// 运行测试
async function testTimeFilter() {
  console.log('开始测试时间筛选功能...');
  try {
    // 运行带进度显示的测试
    await runJobTrendTracker((current, total, keyword) => {
      console.log(`进度: 正在搜索 "${keyword}" (${current}/${total})`);
    });
    console.log('时间筛选功能测试完成!');
  } catch (error) {
    console.error('测试过程中出现错误:', error);
  }
}

// 如果直接运行此脚本，则执行测试
if (require.main === module) {
  testTimeFilter();
}