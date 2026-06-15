/**
 * 微信小程序《摇五个骰子》- 页面逻辑控制 (pages/dice/dice.js)
 * 
 * 核心设计亮点：
 * - 结合 accelerometer 实现快速摇动判定；
 * - 动画定格点数（600-800ms）；
 * - 对外解耦的 dice 产生模块与 shake 监听模块；
 * - 完备的生命周期防耗电设计；
 * - sound / haptic 状态本地缓存维护；
 */

const diceUtil = require('../../utils/dice');
const shakeUtil = require('../../utils/shake');

// 页面动画与定时常量
const ANIMATION_DURATION = 700;   // 投骰动画持续时间 700ms
const SHAKE_SOUND_INTERVAL = 300; // 摇骰循环音效间隔

Page({
  /**
   * 页面的初始数据
   */
  data: {
    // 骰子个数：1-6个
    diceCount: 5,
    
    // 骰子数据列表，点数初始均为 1
    dices: [
      { id: 1, value: 1, isRolling: false },
      { id: 2, value: 1, isRolling: false },
      { id: 3, value: 1, isRolling: false },
      { id: 4, value: 1, isRolling: false },
      { id: 5, value: 1, isRolling: false }
    ],
    
    // 骰盅状态：'covered' (盖住) | 'peeking' (正在偷看) | 'revealed' (开盅)
    gameState: 'covered',
    
    // 投骰中锁定标识
    isRolling: false,
    
    // 系统设置（带缓存）
    soundEnabled: true,
    vibrateEnabled: true,
    
    // 模拟摇骰按钮防抖
    isButtonLocked: false,

    // 拖动杯子手势状态
    cupOffsetY: 0,
    cupRotateX: 0,
    cupRotate: 0,
    cupTransition: 'transform 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.45s ease'
  },

  // 内部保存的手势定位变量
  startY: 0,
  startOffsetY: 0,
  isDraggingCup: false,

  // 内部保存的音频实例
  shakeAudio: null,
  landAudio: null,
  rollingTimer: null,

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    // 1. 初始化设置状态 (读本地缓存，如无则默认 true)
    const storedSound = wx.getStorageSync('soundEnabled');
    const storedVibrate = wx.getStorageSync('vibrateEnabled');
    
    this.setData({
      soundEnabled: storedSound !== false,
      vibrateEnabled: storedVibrate !== false
    });

    // 2. 使用自然错落排布初始化骰子
    this.rebuildDices(this.data.diceCount);

    // 3. 初始化音频实例
    this.initAudio();
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    // 1. 开启屏幕常亮 (省去用户游戏期间手动点亮)
    wx.setKeepScreenOn({
      keepScreenOn: true,
      success: () => console.log('屏幕常亮启用成功'),
      fail: (err) => console.warn('启用屏幕常亮失败:', err)
    });

    // 2. 启动加速度计监听摇一摇
    this.startShakeDetection();
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide: function () {
    // 隐藏时务必关闭加速度监听（防后台耗电）
    this.stopShakeDetection();
    this.stopAudio();
  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function () {
    this.stopShakeDetection();
    this.destoryAudio();
  },

  /**
   * 初始化微信音频播放器
   */
  initAudio: function () {
    try {
      // 1. 摇晃色盅音效
      this.shakeAudio = wx.createInnerAudioContext();
      this.shakeAudio.src = '/assets/shake.mp3';
      this.shakeAudio.loop = false; // 手动触发，避免死循环
      
      // 2. 骰子落定砸色盅音效
      this.landAudio = wx.createInnerAudioContext();
      this.landAudio.src = '/assets/land.mp3';
      this.landAudio.loop = false;
    } catch (e) {
      console.warn('微信 WebAudio API 报错/当前环境未完全支持音频组件', e);
    }
  },

  /**
   * 关闭所有声音
   */
  stopAudio: function () {
    if (this.shakeAudio) this.shakeAudio.stop();
    if (this.landAudio) this.landAudio.stop();
  },

  /**
   * 销毁音频上下文，释放内存
   */
  destoryAudio: function () {
    if (this.shakeAudio) {
      this.shakeAudio.destroy();
      this.shakeAudio = null;
    }
    if (this.landAudio) {
      this.landAudio.destroy();
      this.landAudio = null;
    }
  },

  /**
   * 启动监听摇一摇
   */
  startShakeDetection: function () {
    shakeUtil.start(() => {
      // 触发投骰子
      this.performRoll();
    });
  },

  /**
   * 关闭监听摇一摇
   */
  stopShakeDetection: function () {
    shakeUtil.stop();
  },

  /**
   * 计算最优雅、逼真的自然错落散布坐标 (百分比坐标, z轴倾斜)
   */
  getDiceLayoutPos: function (count, index) {
    const layouts = {
      1: [
        { left: '50%', top: '50%', rot: 12 }
      ],
      2: [
        { left: '33%', top: '50%', rot: -15 },
        { left: '67%', top: '50%', rot: 25 }
      ],
      3: [
        { left: '50%', top: '34%', rot: 5 },
        { left: '32%', top: '66%', rot: -30 },
        { left: '68%', top: '66%', rot: 42 }
      ],
      4: [
        { left: '32%', top: '32%', rot: -20 },
        { left: '68%', top: '32%', rot: 15 },
        { left: '32%', top: '68%', rot: 45 },
        { left: '68%', top: '68%', rot: -10 }
      ],
      5: [
        { left: '33%', top: '28%', rot: -16 },
        { left: '64%', top: '26%', rot: 22 },
        { left: '42%', top: '51%', rot: -12 },
        { left: '71%', top: '46%', rot: 34 },
        { left: '55%', top: '69%', rot: -18 }
      ],
      6: [
        { left: '30%', top: '25%', rot: -18 },
        { left: '52%', top: '25%', rot: 10 },
        { left: '72%', top: '27%', rot: 25 },
        { left: '28%', top: '65%', rot: 35 },
        { left: '50%', top: '68%', rot: -15 },
        { left: '72%', top: '65%', rot: -5 }
      ]
    };

    const list = layouts[count] || layouts[1];
    return list[index] || { left: '50%', top: '50%', rot: 0 };
  },

  /**
   * 动态重构骰子数目数组，并赋予定位坐标样式
   */
  rebuildDices: function (count) {
    const arr = [];
    for (let i = 0; i < count; i++) {
      const pos = this.getDiceLayoutPos(count, i);
      arr.push({ 
        id: i + 1, 
        value: 1, 
        isRolling: false,
        style: `position: absolute; left: ${pos.left}; top: ${pos.top}; transform: translate(-50%, -50%) rotate(${pos.rot}deg);`
      });
    }
    this.setData({ dices: arr });
  },

  /**
   * 增加骰子个数调节
   */
  onAddDice: function () {
    if (this.data.isRolling) return;
    let nextCount = this.data.diceCount + 1;
    if (nextCount > 6) return;
    this.setData({ diceCount: nextCount });
    this.rebuildDices(nextCount);
    if (this.data.vibrateEnabled) {
      wx.vibrateShort({ type: 'light' });
    }
  },

  /**
   * 减少骰子个数调节
   */
  onSubDice: function () {
    if (this.data.isRolling) return;
    let nextCount = this.data.diceCount - 1;
    if (nextCount < 1) return;
    this.setData({ diceCount: nextCount });
    this.rebuildDices(nextCount);
    if (this.data.vibrateEnabled) {
      wx.vibrateShort({ type: 'light' });
    }
  },

  /**
   * 骰盅触摸拖动 - 触控开始
   */
  onTouchCupStart: function (e) {
    if (this.data.isRolling) return;
    this.startY = e.touches[0].clientY;
    this.startOffsetY = this.data.cupOffsetY || 0;
    this.isDraggingCup = true;
    this.setData({
      cupTransition: 'none'
    });
  },

  /**
   * 骰盅触摸拖动 - 触控移动
   */
  onTouchCupMove: function (e) {
    if (!this.isDraggingCup || this.data.isRolling) return;
    let clientY = e.touches[0].clientY;
    let diffY = clientY - this.startY;
    let newOffsetY = this.startOffsetY + diffY;

    // 限制拖动范围在 -180 到 0 像素之间 (向上限位)
    if (newOffsetY > 0) newOffsetY = 0;
    if (newOffsetY < -180) newOffsetY = -180;

    let ratio = Math.abs(newOffsetY) / 180;
    let rotateX = ratio * 85; // 3D掀盖旋转角度
    let rotate = ratio * 8;   // Z轴微偏，增加手持触控真实感

    // 动态调整显示状态为 peeking
    let nextState = this.data.gameState;
    if (this.data.gameState !== 'revealed') {
      nextState = newOffsetY < -15 ? 'peeking' : 'covered';
    }

    this.setData({
      cupOffsetY: newOffsetY,
      cupRotateX: rotateX,
      cupRotate: rotate,
      gameState: nextState
    });
  },

  /**
   * 骰盅触摸拖动 - 触控结束
   */
  onTouchCupEnd: function () {
    if (!this.isDraggingCup) return;
    this.isDraggingCup = false;

    // 无论拉多高，“松手均会自动盖回来”，完美拟真真实色盅的回扣阻尼
    this.setData({
      cupOffsetY: 0,
      cupRotateX: 0,
      cupRotate: 0,
      gameState: 'covered',
      cupTransition: 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.15), opacity 0.35s ease'
    });
    if (this.data.vibrateEnabled) {
      wx.vibrateShort({ type: 'light' });
    }
  },

  /**
   * 开始执行投骰子动画与核心逻辑
   */
  performRoll: function () {
    if (this.data.isRolling) return;

    // 1. 进入投骰中，声音响起，重置骰盅位置至紧紧复位盖好 (covered)
    this.setData({
      isRolling: true,
      gameState: 'covered',
      cupOffsetY: 0,
      cupRotateX: 0,
      cupRotate: 0,
      cupTransition: 'transform 0.25s ease'
    });

    // 2. 播放摇晃音效
    if (this.data.soundEnabled && this.shakeAudio) {
      this.shakeAudio.stop();
      this.shakeAudio.play();
    }

    // 3. 高频改变骰子滚动时的虚假点数，模拟疯狂翻转状态
    let elapsed = 0;
    const interval = 80; // 每80ms重绘一次
    
    this.rollingTimer = setInterval(() => {
      elapsed += interval;
      
      // 生成一组临时显示用随机数
      const tempPoints = diceUtil.rollDice(this.data.diceCount);
      const updatedDices = this.data.dices.map((dice, idx) => ({
        ...dice,
        value: tempPoints[idx] || 1,
        isRolling: true
      }));

      this.setData({ dices: updatedDices });

      // 当达到动画持续时间时，停止翻转
      if (elapsed >= ANIMATION_DURATION) {
        clearInterval(this.rollingTimer);
        this.finishRoll();
      }
    }, interval);
  },

  /**
   * 投骰落定，设置最终点数并提供反馈
   */
  finishRoll: function () {
    // 1. 获取最终随机结果 (调用独立的随机生成模块)
    const finalPoints = diceUtil.rollDice(this.data.diceCount);
    
    // 2. 组装最终骰子显示数据
    const finalDices = this.data.dices.map((dice, idx) => ({
      ...dice,
      value: finalPoints[idx] || 1,
      isRolling: false
    }));

    this.setData({
      dices: finalDices,
      isRolling: false
    });

    // 3. 播放落定砸色盅之坚实音效
    if (this.data.soundEnabled) {
      if (this.shakeAudio) this.shakeAudio.stop();
      if (this.landAudio) this.landAudio.play();
    }

    // 4. 定格时触发短振动
    if (this.data.vibrateEnabled) {
      wx.vibrateShort({
        type: 'heavy',
        success: () => console.log('落定震动成功')
      });
    }
  },

  /**
   * 手动按钮/兜底点击事件
   */
  onTapRollBtn: function () {
    // 震动，提升手动点击质感
    if (this.data.vibrateEnabled) {
      wx.vibrateShort({ type: 'medium' });
    }
    this.performRoll();
  },

  /**
   * “偷看”机制 - 长按开始
   */
  onPeekStart: function () {
    if (this.data.isRolling) return;
    if (this.data.gameState === 'revealed') return; // 已全部开启就不需要偷看
    
    this.setData({
      gameState: 'peeking',
      cupOffsetY: -60,
      cupRotateX: 34,
      cupRotate: 2,
      cupTransition: 'transform 0.25s cubic-bezier(0.1, 0.8, 0.25, 1), opacity 0.25s ease'
    });

    if (this.data.vibrateEnabled) {
      wx.vibrateShort({ type: 'light' });
    }
  },

  /**
   * “偷看”机制 - 长按结束
   */
  onPeekEnd: function () {
    if (this.data.gameState === 'peeking') {
      this.setData({
        gameState: 'covered',
        cupOffsetY: 0,
        cupRotateX: 0,
        cupRotate: 0,
        cupTransition: 'transform 0.2s cubic-bezier(0.1, 0.8, 0.25, 1)'
      });
    }
  },

  /**
   * “查看自己” 按钮的触摸取消（例如拉出屏幕外等边缘情况处理）
   */
  onPeekCancel: function () {
    if (this.data.gameState === 'peeking') {
      this.setData({
        gameState: 'covered',
        cupOffsetY: 0,
        cupRotateX: 0,
        cupRotate: 0,
        cupTransition: 'transform 0.2s cubic-bezier(0.1, 0.8, 0.25, 1)'
      });
    }
  },

  /**
   * “开盅/亮底” 按钮 - 一次性暴露
   */
  onToggleReveal: function () {
    if (this.data.isRolling) return;

    if (this.data.vibrateEnabled) {
      wx.vibrateShort({ type: 'medium' });
    }

    const nextState = this.data.gameState === 'revealed' ? 'covered' : 'revealed';
    const nextOffsetY = nextState === 'revealed' ? -180 : 0;
    const nextRotateX = nextState === 'revealed' ? 90 : 0;
    const nextRotate = nextState === 'revealed' ? 5 : 0;
    
    this.setData({
      gameState: nextState,
      cupOffsetY: nextOffsetY,
      cupRotateX: nextRotateX,
      cupRotate: nextRotate,
      cupTransition: 'transform 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.2), opacity 0.45s ease'
    });
  },

  /**
   * 摇骰设置 - 音效开关切换
   */
  onToggleSound: function () {
    const nextVal = !this.data.soundEnabled;
    this.setData({
      soundEnabled: nextVal
    });
    wx.setStorageSync('soundEnabled', nextVal);
  },

  /**
   * 摇骰设置 - 震动开关切换
   */
  onToggleVibrate: function () {
    const nextVal = !this.data.vibrateEnabled;
    this.setData({
      vibrateEnabled: nextVal
    });
    wx.setStorageSync('vibrateEnabled', nextVal);
  }
});
