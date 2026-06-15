/**
 * 微信小程序《摇五个骰子》- 摇一摇（加速度计）检测模块
 * 
 * 架构设计说明：
 * - 集中配置常量，便于调试（阈值、冷却时间、采样间隔）
 * - 对外暴露 start(onShake) / stop()
 * - 为防止电量消耗与内存泄漏，可在页面隐藏时停止监听
 */

// 摇一摇配置常量
const SHAKE_THRESHOLD = 1.8;      // 合加速度阈值 (正常静止为 1g，超过该阈值判定为摇动)
const COOLDOWN_TIME = 1500;       // 摇动触发冷却时间 (ms)，防止单次摇动触发多次
const ACCEL_INTERVAL = 'game';    // 采样间隔；'game' 约为 20ms 一次，响应极快高灵敏度

let lastShakeTime = 0;            // 上次判定成功的时间戳
let isListening = false;          // 监听状态

/**
 * 启动摇一摇监听
 * @param {Function} onShake 摇一摇触发时的回调函数
 */
function start(onShake) {
  if (isListening) return;
  isListening = true;

  // 1. 初始化加速度计，设置间隔
  wx.startAccelerometer({
    interval: ACCEL_INTERVAL,
    success: () => {
      console.log('加速度计启动成功, 采样间隔:', ACCEL_INTERVAL);
    },
    fail: (err) => {
      console.error('设备不支持加速度计或启动失败:', err);
    }
  });

  // 2. 绑定事件监听
  wx.onAccelerometerChange((res) => {
    const { x, y, z } = res;
    
    // 计算合加速度 magnitude
    const magnitude = Math.sqrt(x * x + y * y + z * z);
    
    // 超过阈值，且处于非冷却期
    if (magnitude > SHAKE_THRESHOLD) {
      const now = Date.now();
      if (now - lastShakeTime > COOLDOWN_TIME) {
        lastShakeTime = now;
        
        // 触发振动，微信标准长振动
        wx.vibrateLong({
          success: () => {
            console.log('摇一摇反馈硬振动触发');
          }
        });
        
        // 执行传入的回调
        if (typeof onShake === 'function') {
          onShake(res);
        }
      }
    }
  });
}

/**
 * 关闭摇一摇监听并解绑，防耗电与内存泄漏
 */
function stop() {
  if (!isListening) return;
  isListening = false;
  
  // 停止监听加速度数据
  wx.stopAccelerometer({
    success: () => {
      console.log('加速度计已安全关闭');
    },
    fail: (err) => {
      console.error('关闭加速度计失败:', err);
    }
  });
}

module.exports = {
  start,
  stop
};
