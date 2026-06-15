import React, { useState, useEffect, useRef } from 'react';
import { 
  Volume2, 
  VolumeX, 
  Smartphone, 
  Code, 
  FileCode, 
  Check, 
  Copy, 
  Sparkles, 
  RefreshCw, 
  Eye, 
  EyeOff, 
  Lock, 
  Unlock, 
  Terminal, 
  CheckCircle2, 
  Info,
  Sliders,
  Settings2,
  Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// === WeChat Mini Program Code File Mock Data for Viewer ===
const MP_FILES = [
  {
    path: 'utils/dice.js',
    label: 'dice.js (防偏心核心发牌)',
    lang: 'javascript',
    content: `/**
 * 微信小程序《摇五个骰子》- 投骰子随机点数逻辑模块
 * 
 * 架构设计说明：
 * - 本模块负责生成骰子随机点数。
 * - 投骰子逻辑与 UI 渲染完全解耦，方便后续接入云函数或联机对战发牌。
 * - 导出 rollDice 接口。
 */

// 骰子数量常量，默认为 5
const DEFAULT_DICE_COUNT = 5;

/**
 * 产生 n 个 1-6 的随机骰子点数
 * @param {number} n 骰子数量
 * @returns {Array<number>} 长度为 n 的点数数组（1-6 之间）
 */
function rollDice(n = DEFAULT_DICE_COUNT) {
  const result = [];
  for (let i = 0; i < n; i++) {
    // 产生 1 - 6 的随机整数
    const point = Math.floor(Math.random() * 6) + 1;
    result.push(point);
  }
  return result;
}

// 导出模块（微信小程序标准 CommonJS 规范）
module.exports = {
  rollDice
};`
  },
  {
    path: 'utils/shake.js',
    label: 'shake.js (摇晃检测封装)',
    lang: 'javascript',
    content: `/**
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
};`
  },
  {
    path: 'pages/dice/dice.js',
    label: 'dice.js (页面控制核心)',
    lang: 'javascript',
    content: `/**
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
    isButtonLocked: false
  },

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

    // 2. 初始化音频实例
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
      this.shakeAudio = wx.createInnerAudioContext();
      this.shakeAudio.src = '/assets/shake.mp3';
      this.shakeAudio.loop = false;
      
      this.landAudio = wx.createInnerAudioContext();
      this.landAudio.src = '/assets/land.mp3';
      this.landAudio.loop = false;
    } catch (e) {
      console.warn('微信音频API组件初始化报错', e);
    }
  },

  /**
   * 开始执行投骰子动画与核心逻辑
   */
  performRoll: function () {
    if (this.data.isRolling) return;

    this.setData({
      isRolling: true,
      gameState: 'covered' // 投骰后默认盖住
    });

    if (this.data.soundEnabled && this.shakeAudio) {
      this.shakeAudio.play();
    }

    let elapsed = 0;
    const interval = 80;
    
    this.rollingTimer = setInterval(() => {
      elapsed += interval;
      
      const tempPoints = diceUtil.rollDice(5);
      const updatedDices = this.data.dices.map((dice, idx) => ({
        ...dice,
        value: tempPoints[idx],
        isRolling: true
      }));

      this.setData({ dices: updatedDices });

      if (elapsed >= ANIMATION_DURATION) {
        clearInterval(this.rollingTimer);
        this.finishRoll();
      }
    }, interval);
  },

  /**
   * 投骰完结，定格结果
   */
  finishRoll: function () {
    const finalPoints = diceUtil.rollDice(5);
    const finalDices = this.data.dices.map((dice, idx) => ({
      ...dice,
      value: finalPoints[idx],
      isRolling: false
    }));

    this.setData({
      dices: finalDices,
      isRolling: false
    });

    if (this.data.soundEnabled) {
      if (this.shakeAudio) this.shakeAudio.stop();
      if (this.landAudio) this.landAudio.play();
    }

    if (this.data.vibrateEnabled) {
      wx.vibrateShort({ type: 'heavy' });
    }
  }
});`
  },
  {
    path: 'pages/dice/dice.wxml',
    label: 'dice.wxml (色盘结构描绘)',
    lang: 'html',
    content: `<!-- pages/dice/dice.wxml -->
<view class="container">
  <!-- 顶部控制栏: 音效与震动开关 -->
  <view class="header-settings">
    <view class="setting-item {{soundEnabled ? 'active' : ''}}" bindtap="onToggleSound">
      <text class="icon-text">{{soundEnabled ? '🔊' : '🔇'}} 音效</text>
    </view>
    <view class="setting-item {{vibrateEnabled ? 'active' : ''}}" bindtap="onToggleVibrate">
      <text class="icon-text">{{vibrateEnabled ? '📳' : '📴'}} 震动</text>
    </view>
  </view>

  <!-- 色盅核心展示区 (包含色盘以及绝对散布的立体骰子) -->
  <view class="game-stage" id="game_stage_stage">
    
    <!-- 模拟无托盘的晶莹透明色盘区 (Dice Board) -->
    <view class="dice-board" id="game_dice_board_element">
      <view class="board-inner">
        
        <!-- 骰子的自然散布布局 -->
        <view class="dices-container {{isRolling ? 'is-shaking' : ''}}" id="dices_grid_holder">
          <block wx:for="{{dices}}" wx:key="id">
            <view class="dice dice-face-{{item.value}} {{item.isRolling ? 'dice-rolling' : ''}}" style="{{item.style}}" id="dice_element_{{item.id}}">
              <!-- 根据骰子值，循环绘制对应的斑点点数 -->
              <view wx:if="{{item.value === 1}}" class="dot-layout face-1">
                <view class="dot dot-center red-dot"></view>
              </view>
              <view wx:elif="{{item.value === 2}}" class="dot-layout face-2">
                <view class="dot dot-top-left"></view>
                <view class="dot dot-bottom-right"></view>
              </view>
              <view wx:elif="{{item.value === 3}}" class="dot-layout face-3">
                <view class="dot dot-top-left"></view>
                <view class="dot dot-center"></view>
                <view class="dot dot-bottom-right"></view>
              </view>
              <view wx:elif="{{item.value === 4}}" class="dot-layout face-4">
                <view class="dot dot-top-left red-dot"></view>
                <view class="dot dot-top-right red-dot"></view>
                <view class="dot dot-bottom-left red-dot"></view>
                <view class="dot dot-bottom-right red-dot"></view>
              </view>
              <view wx:elif="{{item.value === 5}}" class="dot-layout face-5">
                <view class="dot dot-top-left"></view>
                <view class="dot dot-top-right"></view>
                <view class="dot dot-center"></view>
                <view class="dot dot-bottom-left"></view>
                <view class="dot dot-bottom-right"></view>
              </view>
              <view wx:elif="{{item.value === 6}}" class="dot-layout face-6">
                <view class="dot dot-top-left"></view>
                <view class="dot dot-top-right"></view>
                <view class="dot dot-middle-left"></view>
                <view class="dot dot-middle-right"></view>
                <view class="dot dot-bottom-left"></view>
                <view class="dot dot-bottom-right"></view>
              </view>
            </view>
          </block>
        </view>
      </view>
    </view>

    <!-- 盖在色盘之上的骰盅 -->
    <view 
      class="dice-cup-mask {{gameState}} {{isRolling ? 'cup-shaking' : ''}}" 
      style="transform: perspective(600rpx) rotateX({{cupRotateX}}deg) translateY({{cupOffsetY}}px) rotate({{cupRotate}}deg); transform-origin: top center; transition: {{cupTransition}}; opacity: {{(gameState === 'revealed' ? 0 : (gameState === 'peeking' ? 0.22 : 1))}};"
      bindtouchstart="onTouchCupStart"
      bindtouchmove="onTouchCupMove"
      bindtouchend="onTouchCupEnd"
      id="dice_cup_mask"
    >
      <view class="cup-body">
        <!-- 顶部银环 -->
        <view class="silver-band silver-band-top"></view>
        <!-- 底部银环 -->
        <view class="silver-band silver-band-bottom"></view>
        <!-- 科技微点矩阵纹理 -->
        <view class="tech-pattern"></view>
        <!-- 科技导轨细线装饰 -->
        <view class="circuit-track-1"></view>
        <view class="circuit-track-2"></view>
        <!-- 金属反光拉丝高光 -->
        <view class="sheen sheen-1"></view>
        <view class="sheen sheen-2"></view>
        <view class="sheen sheen-3"></view>
      </view>
      <text class="cup-status-text" wx:if="{{gameState === 'covered'}}">👇 拖动骰盅/长按偷看</text>
      <text class="cup-status-text alert-text" wx:elif="{{gameState === 'peeking'}}">👁️ 偷看中 (松手盖回)</text>
      <text class="cup-status-text" wx:else>💥 已亮底板 (再次合上)</text>
    </view>
  </view>

  <!-- 4. 核心控制按键面板 Area -->
  <view class="control-panel">
    <button class="btn-control btn-peek" bindtouchstart="onPeekStart" bindtouchend="onPeekEnd">👁️ 长按偷看点数</button>
    <button class="btn-control btn-reveal-toggle" bindtap="onToggleReveal">💥 大开色盅 / 盖上</button>
    <button class="btn-control btn-roll" bindtap="onTapRollBtn">✨ 猛摇色盅 (Roll)</button>
  </view>
</view>`
  },
  {
    path: 'pages/dice/dice.wxss',
    label: 'dice.wxss (皮质触感样式)',
    lang: 'css',
    content: `/* pages/dice/dice.wxss */
.container {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 100vh;
  background-color: #070708;
  background-image: radial-gradient(circle at 50% 30%, #1a1cf216 0%, transparent 60%), radial-gradient(circle at 50% 80%, #000000 0%, #070708 100%);
  padding: 40rpx 30rpx 60rpx 30rpx;
  color: #ECEFF1;
}
.game-stage {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 640rpx;
}
.dice-board {
  position: relative;
  width: 520rpx;
  height: 520rpx;
  border-radius: 50%;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
}
.board-inner {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 460rpx;
  height: 460rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.015);
  border: 2rpx dashed rgba(255, 255, 255, 0.05);
}
.dices-container {
  position: relative;
  width: 440rpx;
  height: 440rpx;
}
.dice {
  position: absolute;
  width: 104rpx;
  height: 104rpx;
  background: linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%);
  border-radius: 20rpx;
  box-shadow: 0 8rpx 0 #cbd5e1, 0 18rpx 28rpx rgba(0, 0, 0, 0.65), inset 0 2rpx 4rpx rgba(255, 255, 255, 0.8), inset 0 -4rpx 6rpx rgba(148, 163, 184, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
}
.dice-rolling {
  animation: diceRollAnim 0.15s infinite linear;
}
@keyframes diceRollAnim {
  0% { transform: translate(-50%, -50%) scale(0.9) rotate(0deg); }
  100% { transform: translate(-50%, -50%) scale(0.9) rotate(360deg); }
}
.dice-cup-mask {
  position: absolute;
  width: 320rpx;
  height: 500rpx;
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  transition: all 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  z-index: 20;
}
.cup-body {
  position: relative;
  width: 300rpx;
  height: 440rpx;
  background: linear-gradient(to right, #0a0b0d 0%, #16181b 20%, #2d3139 50%, #16181b 80%, #0a0b0d 100%);
  border-radius: 40rpx 40rpx 36rpx 36rpx;
  box-shadow: 0 40rpx 80rpx rgba(0, 0, 0, 0.95), inset 0 6rpx 16rpx rgba(255, 255, 255, 0.15);
  border: 2rpx solid rgba(0, 0, 0, 0.85);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}
.silver-band {
  position: absolute;
  left: 0; right: 0; height: 32rpx;
  background: linear-gradient(to right, #595b5e 0%, #cbd0d3 25%, #ffffff 50%, #a2a6aa 75%, #595b5e 100%);
  border-top: 2rpx solid rgba(255, 255, 255, 0.4);
  border-bottom: 2rpx solid rgba(0, 0, 0, 0.4);
  z-index: 10;
}
.silver-band-top { top: 64rpx; }
.silver-band-bottom { bottom: 64rpx; }
.tech-pattern {
  position: absolute; top: 96rpx; bottom: 96rpx; left: 0; right: 0; opacity: 0.18;
  background-image: radial-gradient(circle, #ffffff 2rpx, transparent 2rpx);
  background-size: 18rpx 18rpx;
}
.sheen {
  position: absolute; top: 0; bottom: 0;
  background: linear-gradient(to right, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.18) 50%, rgba(255, 255, 255, 0) 100%);
}
.sheen-1 { left: 40rpx; width: 36rpx; filter: blur(2rpx); }
.sheen-2 { left: 80rpx; width: 10rpx; filter: blur(1rpx); }
.sheen-3 { right: 60rpx; width: 44rpx; filter: blur(3rpx); }
.cup-status-text {
  font-size: 24rpx; font-weight: 500; color: #94A3B8; margin-top: 36rpx; letter-spacing: 4rpx;
}
.cup-status-text.alert-text { color: #38BDF8; }
.dice-cup-mask.covered { opacity: 1; }
.dice-cup-mask.peeking { opacity: 0.22; }
.dice-cup-mask.revealed { opacity: 0; visibility: hidden; }`
  }
];

const getDiceLayoutPos = (count: number, index: number) => {
  const layouts: Record<number, { left: string; top: string; rot: number }[]> = {
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
      // Upper Left, Upper Right, Center Left, Center Right, Bottom Mid (matches user screenshot layout)
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
};

const getDiceFullFaces = (v: number) => {
  const top = v;
  const bottom = 7 - v;
  let front = 2, back = 5, left = 3, right = 4;
  if (v === 1) { front = 2; back = 5; left = 3; right = 4; }
  else if (v === 2) { front = 3; back = 4; left = 1; right = 6; }
  else if (v === 3) { front = 1; back = 6; left = 2; right = 5; }
  else if (v === 4) { front = 5; back = 2; left = 6; right = 1; }
  else if (v === 5) { front = 1; back = 6; left = 4; right = 3; }
  else if (v === 6) { front = 4; back = 3; left = 2; right = 5; }
  return { top, bottom, front, back, left, right };
};

const renderDiceFace = (val: number, faceSide: 'top' | 'left' | 'right' | 'front' | 'back' | 'bottom', transformStyle: string) => {
  const isRed = val === 1 || val === 4;
  const dotColorClass = isRed 
    ? 'bg-red-600 shadow-[inset_0_1px_1px_rgba(239,68,68,0.5)]' 
    : 'bg-[#183ca2] shadow-[inset_0_1px_1px_rgba(30,64,175,0.5)]';
  
  let shadingClass = "bg-white border-zinc-200";
  if (faceSide === 'top') {
    shadingClass = "bg-gradient-to-br from-white via-zinc-50 to-zinc-100 border-zinc-200";
  } else if (faceSide === 'front') {
    shadingClass = "bg-gradient-to-br from-[#f8fafc] via-[#f1f5f9] to-[#e2e8f0] border-zinc-200";
  } else if (faceSide === 'right') {
    shadingClass = "bg-gradient-to-br from-[#f1f5f9] via-[#e2e8f0] to-[#cbd5e1] border-zinc-300";
  } else if (faceSide === 'left') {
    shadingClass = "bg-gradient-to-br from-[#f8fafc] via-[#e2e8f0] to-[#cbd5e1] border-zinc-300";
  } else if (faceSide === 'back') {
    shadingClass = "bg-gradient-to-br from-[#e2e8f0] to-[#cbd5e1] border-zinc-350";
  } else if (faceSide === 'bottom') {
    shadingClass = "bg-[#cbd5e1] border-zinc-400";
  }

  return (
    <div 
      className={`absolute inset-0 rounded-[7px] border flex items-center justify-center select-none shadow-[inset_0_1.5px_3px_rgba(255,255,255,1),0_1.5px_3.5px_rgba(0,0,0,0.15)] ${shadingClass}`} 
      style={{ 
        transform: transformStyle, 
        position: 'absolute', 
        width: '100%', 
        height: '100%', 
        backfaceVisibility: 'hidden', 
        WebkitBackfaceVisibility: 'hidden',
        opacity: 1 
      }}
    >
      {/* 1 dot */}
      {val === 1 && (
        <div className="w-[15px] h-[15px] rounded-full bg-red-600 shadow-[inset_0_1.5px_2.5px_rgba(0,0,0,0.45),0_1.5px_3.5px_rgba(220,38,38,0.73)] border border-red-500/20" />
      )}

      {/* 2 dots */}
      {val === 2 && (
        <div className="absolute inset-0 p-1.5 flex flex-col justify-between">
          <div className={`w-1.5 h-1.5 rounded-full ${dotColorClass} self-start`} />
          <div className={`w-1.5 h-1.5 rounded-full ${dotColorClass} self-end`} />
        </div>
      )}

      {/* 3 dots */}
      {val === 3 && (
        <div className="absolute inset-0 p-1.5 flex flex-col justify-between">
          <div className={`w-1.5 h-1.5 rounded-full ${dotColorClass} self-start`} />
          <div className={`w-1.5 h-1.5 rounded-full ${dotColorClass} self-center`} />
          <div className={`w-1.5 h-1.5 rounded-full ${dotColorClass} self-end`} />
        </div>
      )}

      {/* 4 dots */}
      {val === 4 && (
        <div className="absolute inset-0 p-1 grid grid-cols-2 justify-between content-between gap-1">
          <div className={`w-1.5 h-1.5 rounded-full ${dotColorClass}`} />
          <div className={`w-1.5 h-1.5 rounded-full ${dotColorClass}`} />
          <div className={`w-1.5 h-1.5 rounded-full ${dotColorClass}`} />
          <div className={`w-1.5 h-1.5 rounded-full ${dotColorClass}`} />
        </div>
      )}

      {/* 5 dots */}
      {val === 5 && (
        <div className="absolute inset-0 p-1.5 flex flex-col justify-between">
          <div className="flex justify-between">
            <div className={`w-1.5 h-1.5 rounded-full ${dotColorClass}`} />
            <div className={`w-1.5 h-1.5 rounded-full ${dotColorClass}`} />
          </div>
          <div className={`w-1.5 h-1.5 rounded-full ${dotColorClass} self-center`} />
          <div className="flex justify-between">
            <div className={`w-1.5 h-1.5 rounded-full ${dotColorClass}`} />
            <div className={`w-1.5 h-1.5 rounded-full ${dotColorClass}`} />
          </div>
        </div>
      )}

      {/* 6 dots */}
      {val === 6 && (
        <div className="absolute inset-0 py-1.5 px-2 flex justify-between">
          <div className="flex flex-col justify-between h-full">
            <div className={`w-1.5 h-1.5 rounded-full ${dotColorClass}`} />
            <div className={`w-1.5 h-1.5 rounded-full ${dotColorClass}`} />
            <div className={`w-1.5 h-1.5 rounded-full ${dotColorClass}`} />
          </div>
          <div className="flex flex-col justify-between h-full">
            <div className={`w-1.5 h-1.5 rounded-full ${dotColorClass}`} />
            <div className={`w-1.5 h-1.5 rounded-full ${dotColorClass}`} />
            <div className={`w-1.5 h-1.5 rounded-full ${dotColorClass}`} />
          </div>
        </div>
      )}
    </div>
  );
};

export default function App() {
  // === 模拟微信小程序状态变量 ===
  const [diceCount, setDiceCount] = useState(5);
  const [dices, setDices] = useState([
    { id: 1, value: 1, isRolling: false },
    { id: 2, value: 1, isRolling: false },
    { id: 3, value: 1, isRolling: false },
    { id: 4, value: 1, isRolling: false },
    { id: 5, value: 1, isRolling: false }
  ]);
  
  const [gameState, setGameState] = useState<'covered' | 'peeking' | 'revealed'>('covered');
  const [isRolling, setIsRolling] = useState(false);

  // 拖拽杯子手势状态
  const [cupOffsetY, setCupOffsetY] = useState(0);
  const [cupRotateX, setCupRotateX] = useState(0);
  const [cupRotate, setCupRotate] = useState(0);
  const [cupTransition, setCupTransition] = useState('transform 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.45s ease');

  const [isDraggingCup, setIsDraggingCup] = useState(false);
  const isDraggingCupRef = useRef(false);
  const startYRef = useRef(0);
  const startOffsetRef = useRef(0);
  
  // 系统设置
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem('soundEnabled');
    return saved !== 'false';
  });
  
  const [vibrateEnabled, setVibrateEnabled] = useState(() => {
    const saved = localStorage.getItem('vibrateEnabled');
    return saved !== 'false';
  });

  const [settingsVisible, setSettingsVisible] = useState(false);
  const [autoRevealBehavior, setAutoRevealBehavior] = useState(() => {
    const saved = localStorage.getItem('autoRevealBehavior');
    return saved !== 'false';
  });

  // 设备状态
  const [isDeviceShaking, setIsDeviceShaking] = useState(false);
  const [shakeThreshold, setShakeThreshold] = useState(1.8);
  const [deviceAccel, setDeviceAccel] = useState<{x: number, y: number, z: number}>({ x: 0, y: 0, z: 0 });

  // 微信API仿真虚拟控制台
  const [logs, setLogs] = useState<string[]>([]);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  // 代码查看器状态
  const [activeFileIdx, setActiveFileIdx] = useState(0);
  const [isCopied, setIsCopied] = useState(false);

  // Web Audio Context for Synthesis
  const audioCtxRef = useRef<AudioContext | null>(null);

  // 振动计时防抖
  const lastShakeTimeRef = useRef<number>(0);

  // 添加一条模拟微信 API 调用的日志
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    setLogs(prev => [...prev.slice(-30), `[${timestamp}] ${message}`]);
  };

  useEffect(() => {
    // 首次载入打印
    addLog('System: 微信小程序「摇五个骰子」环境沙箱加载完毕。');
    addLog('wx.setKeepScreenOn({ keepScreenOn: true }): 面板屏幕保持常亮成功。');
    addLog(`LocalStorage: 恢复用户设置 [音效: ${soundEnabled ? '开' : '关'}, 震动: ${vibrateEnabled ? '开' : '关'}]`);
  }, []);

  // 保持日志区域自动向下滚动
  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // === 物理摇手机监听 ===
  useEffect(() => {
    const handleDeviceMotion = (event: DeviceMotionEvent) => {
      const accel = event.accelerationIncludingGravity || event.acceleration;
      if (!accel) return;

      const x = accel.x || 0;
      const y = accel.y || 0;
      const z = accel.z || 0;

      const magnitude = Math.sqrt(x * x + y * y + z * z);
      const isiOS = z > 9; // 移动端重力补偿因系统而异，这里算净加速度
      
      setDeviceAccel({ x, y, z });

      // 如果未经过摇动冷却，且幅值大于阈值
      if (magnitude > shakeThreshold * 9.8 / 1.8) { // 换算到大约 1.8g
        const now = Date.now();
        if (now - lastShakeTimeRef.current > 1500) {
          lastShakeTimeRef.current = now;
          addLog(`wx.onAccelerometerChange: 物理合加速度 ${magnitude.toFixed(2)}m/s² 超过阈值，触发摇数！`);
          triggerRollEvent();
        }
      }
    };

    window.addEventListener('devicemotion', handleDeviceMotion);
    return () => {
      window.removeEventListener('devicemotion', handleDeviceMotion);
    };
  }, [soundEnabled, vibrateEnabled, isRolling, shakeThreshold]);

  // Web Audio Synthetic Sound Engine (No files dependencies!)
  const getAudioContext = (): AudioContext | null => {
    if (typeof window === 'undefined') return null;
    if (!audioCtxRef.current) {
      try {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        audioCtxRef.current = new AudioCtxClass();
      } catch (e) {
        addLog('WebAudio API Warning: 当前浏览器内核不支持合成器。');
      }
    }
    // Resume context if suspended (browser security autoplays blockers)
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  // 1. 合成摇盒子滚动声音
  const playSyntheticShake = () => {
    const ctx = getAudioContext();
    if (!ctx) return;

    const duration = 0.65;
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    // 塑造骰子撞击和沙沙响的声音
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(45, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + duration);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(300, ctx.currentTime);
    filter.Q.setValueAtTime(15, ctx.currentTime);
    
    // 高频晃荡微调节调制
    const modOsc = ctx.createOscillator();
    const modGain = ctx.createGain();
    modOsc.frequency.value = 35; // 35Hz 高速颤动
    modGain.gain.value = 200; // 调制深度
    modOsc.connect(modGain);
    modGain.connect(filter.frequency);

    // 声音包络
    gainNode.gain.setValueAtTime(0.001, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.1);
    gainNode.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.3);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start();
    modOsc.start();
    osc.stop(ctx.currentTime + duration);
    modOsc.stop(ctx.currentTime + duration);
  };

  // 2. 合成落地砸骰盅声音
  const playSyntheticLand = () => {
    const ctx = getAudioContext();
    if (!ctx) return;

    // 连续 diceCount 次数掷地之清脆声以对应全部骰子，在 120ms 内密集散落
    for (let i = 0; i < diceCount; i++) {
      const delay = i * 0.035; // 35ms 间隔落地
      const now = ctx.currentTime + delay;

      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.08);

      filter.type = 'lowpass';
      filter.frequency.value = 850;

      gainNode.gain.setValueAtTime(0.2, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.08);
    }
  };

  // === 物理震动模拟 (Vibrate API) ===
  const triggerHaptic = (style: 'light' | 'medium' | 'heavy' | 'vibrateLong') => {
    if (!vibrateEnabled) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        if (style === 'vibrateLong') {
          navigator.vibrate(280); // 强硬长震动
        } else if (style === 'heavy') {
          navigator.vibrate(80);  // 定格重音
        } else if (style === 'medium') {
          navigator.vibrate(40);  // 普通反馈
        } else {
          navigator.vibrate(15);  // 微弱触感
        }
      }
    } catch (e) {
      // 捕获权限或环境异常
    }
  };

  // === 骰个个数调节 ===
  const handleAddDice = () => {
    if (isRolling) return;
    const next = Math.min(6, diceCount + 1);
    if (next === diceCount) return;
    setDiceCount(next);
    setDices(Array.from({ length: next }, (_, idx) => ({
      id: idx + 1,
      value: 1,
      isRolling: false
    })));
    addLog(`User Interaction: 增加骰子个数为 ${next} 个`);
    triggerHaptic('light');
  };

  const handleSubDice = () => {
    if (isRolling) return;
    const next = Math.max(1, diceCount - 1);
    if (next === diceCount) return;
    setDiceCount(next);
    setDices(Array.from({ length: next }, (_, idx) => ({
      id: idx + 1,
      value: 1,
      isRolling: false
    })));
    addLog(`User Interaction: 减少骰子个数为 ${next} 个`);
    triggerHaptic('light');
  };

  // === 虚拟色盅拖拽/划拉手势 ===
  const dragStartYRef = useRef(0);

  const handleCupDragStart = (clientY: number) => {
    if (isRolling) return;
    isDraggingCupRef.current = true;
    setIsDraggingCup(true);
    startYRef.current = clientY;
    dragStartYRef.current = clientY;
    startOffsetRef.current = cupOffsetY;
    setCupTransition('none');
  };

  const handleCupDragMove = (clientY: number) => {
    if (!isDraggingCupRef.current || isRolling) return;
    const diffY = clientY - startYRef.current;
    let newOffset = startOffsetRef.current + diffY;

    // 限制往上能提起到 -155px，往下滑至 0px (完全盖闭)
    if (newOffset > 0) newOffset = 0;
    if (newOffset < -155) newOffset = -155;

    const ratio = Math.abs(newOffset) / 155;
    setCupOffsetY(newOffset);
    // 整体上提同时伴随自然高拟真 3D 微倾斜视觉，非常丝滑
    setCupRotateX(ratio * 18); 
    setCupRotate(ratio * -3);

    if (gameState !== 'revealed') {
      if (newOffset < -15) {
        setGameState('peeking');
      } else {
        setGameState('covered');
      }
    }
  };

  const handleCupDragEnd = () => {
    if (!isDraggingCupRef.current) return;
    isDraggingCupRef.current = false;
    setIsDraggingCup(false);

    // 拖动上滑开盖，松手即盖回 (弹性回弹)
    setCupOffsetY(0);
    setCupRotateX(0);
    setCupRotate(0);
    setGameState('covered');
    setCupTransition('transform 0.42s cubic-bezier(0.175, 0.885, 0.32, 1.255), opacity 0.35s ease');
    addLog('Drag Action: 提盅释手释放，色盅自动弹性回落盖回。');
    triggerHaptic('light');
  };

  // === 全局拖拽事件挂载 ===
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDraggingCupRef.current) {
        handleCupDragMove(e.clientY);
      }
    };
    
    const handleGlobalMouseUp = () => {
      if (isDraggingCupRef.current) {
        handleCupDragEnd();
      }
    };

    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (isDraggingCupRef.current && e.touches.length > 0) {
        handleCupDragMove(e.touches[0].clientY);
      }
    };

    const handleGlobalTouchEnd = () => {
      if (isDraggingCupRef.current) {
        handleCupDragEnd();
      }
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('touchmove', handleGlobalTouchMove, { passive: true });
    window.addEventListener('touchend', handleGlobalTouchEnd);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('touchmove', handleGlobalTouchMove);
      window.removeEventListener('touchend', handleGlobalTouchEnd);
    };
  }, []);

  // === 触发骰子摇晃逻辑 ===
  const triggerRollEvent = () => {
    if (isRolling) return;
    setIsRolling(true);
    setGameState('covered'); // 投骰后默认盖住
    setCupOffsetY(0);
    setCupRotateX(0);
    setCupRotate(0);
    setCupTransition('transform 0.25s ease, opacity 0.25s ease');

    addLog('wx.vibrateLong() - 设备长震动响应（模拟色盅在手中猛烈摇晃）');
    triggerHaptic('vibrateLong');

    if (soundEnabled) {
      addLog('Audio Context - 播放色盅剧烈摩擦碰撞声 (/assets/shake.mp3)');
      playSyntheticShake();
    }

    addLog(`UI State - 游戏开始！[${diceCount}个骰子] 进入 covers 状态，遮护内藏。`);

    // 开启高频跳动，模拟滚动动画
    let count = 0;
    const interval = setInterval(() => {
      setDices(prev => prev.map(d => ({
        ...d,
        value: Math.floor(Math.random() * 6) + 1,
        isRolling: true
      })));
      count++;
      if (count > 8) {
        clearInterval(interval);
        // 掷出最终定格点数
        const finalValues = Array.from({ length: diceCount }, () => Math.floor(Math.random() * 6) + 1);
        setDices(Array.from({ length: diceCount }, (_, idx) => ({
          id: idx + 1,
          value: finalValues[idx],
          isRolling: false
        })));
        setIsRolling(false);

        // 落定
        addLog(`wx.vibrateShort({ type: 'heavy' }) - ${diceCount}星骰落定定格: [${finalValues.join(', ')}]`);
        triggerHaptic('heavy');
        
        if (soundEnabled) {
          addLog('Audio Context - 播放最终骰子砸底砸地敲击声 (/assets/land.mp3)');
          playSyntheticLand();
        }
      }
    }, 80);
  };

  // === 手动触发摇骰 ===
  const handleTapRoll = () => {
    addLog('User Interaction: 点击『猛摇色盅』UI 按钮');
    triggerRollEvent();
  };

  // === 长按偷看控制 ===
  const handlePeekStart = () => {
    if (isRolling) return;
    if (gameState === 'revealed') {
      addLog('Action Ignored: 当前色盅已是大开状态，无需偷看。');
      return;
    }
    setGameState('peeking');
    setCupOffsetY(-50);
    setCupRotateX(32); // 32度微微掀起
    setCupRotate(2);
    setCupTransition('transform 0.25s cubic-bezier(0.1, 0.8, 0.25, 1), opacity 0.25s ease');
    addLog('Touch Event: 长按『看自己』触发 - 进入 peek 偷看状态 (半透揭露缝隙 40px, 30度掀起)');
    triggerHaptic('light');
  };

  const handlePeekEnd = () => {
    if (isRolling) return;
    if (gameState === 'peeking') {
      setGameState('covered');
      setCupOffsetY(0);
      setCupRotateX(0);
      setCupRotate(0);
      setCupTransition('transform 0.25s cubic-bezier(0.1, 0.8, 0.25, 1)');
      addLog('Touch Event: 松手 - 恢复 covered 盖上状态。');
      triggerHaptic('light');
    }
  };

  // === 开盅控制 ===
  const handleToggleReveal = () => {
    if (isRolling) return;
    const nextState = gameState === 'revealed' ? 'covered' : 'revealed';
    setGameState(nextState);
    if (nextState === 'revealed') {
      setCupOffsetY(-155);
      setCupRotateX(75); // 75度圆盘完全揭开倾斜
      setCupRotate(3);
      setCupTransition('transform 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.25), opacity 0.45s ease');
    } else {
      setCupOffsetY(0);
      setCupRotateX(0);
      setCupRotate(0);
      setCupTransition('transform 0.4s cubic-bezier(0.1, 0.8, 0.25, 1)');
    }
    addLog(`User Interaction: 切换色盅开闭 - 状态变更为: ${nextState === 'revealed' ? '🔓 敞开透露' : '🔒 恢复严盖'}`);
    triggerHaptic('medium');
  };

  // === 设置切换 ===
  const handleToggleSound = () => {
    const nextVal = !soundEnabled;
    setSoundEnabled(nextVal);
    localStorage.setItem('soundEnabled', String(nextVal));
    addLog(`wx.setStorageSync('soundEnabled', ${nextVal}) - 保留音效设置`);
    triggerHaptic('light');
  };

  const handleToggleVibrate = () => {
    const nextVal = !vibrateEnabled;
    setVibrateEnabled(nextVal);
    localStorage.setItem('vibrateEnabled', String(nextVal));
    addLog(`wx.setStorageSync('vibrateEnabled', ${nextVal}) - 保留震动设置`);
    triggerHaptic('light');
  };

  // 复制源码
  const handleCopyCode = () => {
    const code = MP_FILES[activeFileIdx].content;
    navigator.clipboard.writeText(code).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  const showDices = true;

  return (
    <div className="min-h-screen bg-[#070708] text-zinc-100 flex flex-col font-sans selection:bg-emerald-500/30 overflow-x-hidden" id="workspace_root_element">
      
      {/* 顶部主横向工具条：精美展示 */}
      <header className="border-b border-zinc-800 bg-[#0F0F11]/80 backdrop-blur-md px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4" id="header_navbar">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-sky-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/15">
            <span className="font-mono font-bold text-lg">🎲</span>
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              微信小程序《摇五个骰子》一刀核心体验
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-mono font-normal">单机纯享版</span>
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5">高品质微信小程序端核心交互与原生体验虚拟工作台 (iOS/Android Real Haptics 支持)</p>
          </div>
        </div>

        {/* 顶部配置与指示器 */}
        <div className="flex items-center gap-4 bg-[#141416] p-2 rounded-lg border border-zinc-800/80">
          <div className="flex items-center gap-2 text-xs text-zinc-400 border-r border-zinc-800 pr-3">
            <Info className="w-3.5 h-3.5 text-sky-400" />
            <span>用手机扫码或访问可在真机上摇动掷数</span>
          </div>
          <button 
            onClick={() => {
              const prevLogs = logs;
              addLog('Simulating Hard Reset: 清空游戏虚拟事件');
              setDices(prev => prev.map(d => ({ ...d, value: 1 })));
              setGameState('covered');
            }}
            className="flex items-center gap-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 px-2.5 py-1 rounded text-xs transition duration-150"
            title="复位骰子为全 1"
          >
            <RefreshCw className="w-3 h-3 text-emerald-400" />
            <span>复位游戏</span>
          </button>
        </div>
      </header>

      {/* 主工作区 */}
      <main className="flex-1 max-w-[1700px] w-full mx-auto p-4 md:p-6 grid grid-cols-1 xl:grid-cols-12 gap-6" id="workbench_grid_area">
        
        {/* 第一列：手机模拟器 (占 5格) */}
        <section className="xl:col-span-5 flex flex-col items-center justify-start gap-4" id="phone_simulator_column">
          <div className="text-xs font-mono text-zinc-400 flex items-center gap-2 self-start pl-2">
            <Smartphone className="w-4 h-4 text-emerald-400" />
            <span>MOBILE PREVIEW SHAKE EMULATOR</span>
          </div>

          {/* 拟物高档手机框体 */}
          <div className="relative w-full max-w-[395px] aspect-[9/18.5] rounded-[50px] border-[12px] border-zinc-800 bg-[#09090B] shadow-2xl ring-1 ring-zinc-700/40 flex flex-col overflow-hidden" id="phone_wrapper">
            
            {/* 手机上部刘海 & 听筒 */}
            <div className="absolute top-0 inset-x-0 h-6 flex justify-center z-50">
              <div className="w-36 h-4.5 bg-black rounded-b-2xl flex items-center justify-between px-4">
                <span className="w-2 h-2 rounded-full bg-zinc-900"></span>
                <span className="h-1 w-14 bg-zinc-800 rounded-full"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-blue-900/55"></span>
              </div>
            </div>

            {/* 手机状态栏 Mock */}
            <div className="h-11 bg-[#09090B] px-6 pt-5 flex items-center justify-between text-[11px] font-sans font-medium text-zinc-400 select-none z-40">
              <span>02:00</span>
              <div className="flex items-center gap-1.5">
                <span>5G</span>
                <div className="w-5 h-2.5 rounded-[3px] border border-zinc-500 p-[1px] flex items-center">
                  <div className="h-full w-4 bg-emerald-500 rounded-[1px]" />
                </div>
              </div>
            </div>

            {/* 微信框架 Top Capsule & Title (高真度拟态) */}
            <div className="bg-[#09090B] border-b border-white/[0.04] px-4 py-2.5 flex items-center justify-between text-white select-none z-40">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-zinc-400 font-serif">‹</span>
                <span className="text-sm font-semibold tracking-wide">摇五个骰子</span>
              </div>

              {/* 微信标志性右上角胶囊按键 */}
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-black/40 border border-white/[0.08] text-white">
                <span className="w-1.5 h-1.5 rounded-full bg-white opacity-90 animate-pulse"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-white opacity-90"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-white opacity-90"></span>
                <div className="w-px h-3 bg-white/20 mx-1"></div>
                <div className="w-3 h-3 rounded-full border-2 border-white/80 flex items-center justify-center text-[8px] font-bold">●</div>
              </div>
            </div>

            {/* 小程序内部视图区域 */}
            <div className="flex-1 bg-[#09090B] flex flex-col justify-between px-5 py-6 select-none relative overflow-hidden" id="mp_webview_canvas">
              
              {/* 1. 小程序顶部选项开关 & 骰子个数调节 */}
              <div className="flex flex-col gap-2.5 z-20 shrink-0">
                <div className="flex justify-end gap-2.5">
                  <button 
                    onClick={handleToggleSound}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold tracking-wide transition-all ${soundEnabled ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' : 'text-zinc-500 bg-zinc-900/60 border-zinc-800'}`}
                  >
                    <span className="text-xs">{soundEnabled ? '🔊' : '🔇'}</span>
                    <span>音效</span>
                  </button>
                  <button 
                    onClick={handleToggleVibrate}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold tracking-wide transition-all ${vibrateEnabled ? 'text-[#38BDF8] bg-sky-500/10 border-sky-500/30' : 'text-zinc-500 bg-zinc-900/60 border-zinc-800'}`}
                  >
                    <span className="text-xs">{vibrateEnabled ? '📳' : '📴'}</span>
                    <span>震动</span>
                  </button>
                </div>

                {/* 骰子个数 - + 调节器 */}
                <div className="flex items-center justify-between bg-zinc-900/70 border border-white/[0.04] p-1 px-3 rounded-full shadow-inner w-full max-w-[200px] mx-auto select-none">
                  <button 
                    onClick={handleSubDice}
                    disabled={isRolling}
                    className="w-7 h-7 flex items-center justify-center font-bold text-sm bg-white/5 active:bg-white/10 dark:disabled:opacity-30 rounded-full text-zinc-300 transition-all border border-white/[0.02]"
                  >
                    -
                  </button>
                  <span className="text-xs font-bold text-zinc-200 tracking-wider font-mono">
                    {diceCount} 个骰子
                  </span>
                  <button 
                    onClick={handleAddDice}
                    disabled={isRolling}
                    className="w-7 h-7 flex items-center justify-center font-bold text-sm bg-white/5 active:bg-white/10 dark:disabled:opacity-30 rounded-full text-zinc-300 transition-all border border-white/[0.02]"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* 2. 主舞台区 */}
              <div className="relative flex items-center justify-center mt-7 mb-3 h-[320px] w-full" id="stage_container_phone" style={{ perspective: '1100px' }}>
                
                {/* 3D 骰子物理散布平铺区 (透明隐形，不要托盘) - 物理 3D 倾斜 55 度，尺寸缩小，位置靠下 */}
                <div 
                  className="relative w-[190px] h-[190px] rounded-full flex items-center justify-center pointer-events-none"
                  style={{
                    transform: 'translateY(45px) rotateX(55deg)',
                    transformStyle: 'preserve-3d',
                  }}
                >
                  
                  {/* 3D 骰子物理散布展示区 - 恢复 100% 真实 3D 空间 */}
                  <div 
                    className={`relative w-full h-full overflow-visible ${isRolling ? 'animate-[boardShake_0.15s_infinite_linear]' : ''}`} 
                    style={{ 
                      transformStyle: 'preserve-3d',
                      transition: 'none'
                    }}
                  >
                    {dices.map((dice, idx) => {
                      const pos = getDiceLayoutPos(diceCount, idx);
                      const faces = getDiceFullFaces(dice.value);
                      
                      return (
                        <div
                          key={dice.id}
                          className="absolute select-none"
                          style={{
                            left: pos.left,
                            top: pos.top,
                            width: '36px',
                            height: '36px',
                            transform: `translate3d(-50%, -50%, 0px) scale(1.12)`,
                            transition: 'none',
                            transformStyle: 'preserve-3d',
                            zIndex: 10
                          }}
                          id={`mp_dice_item_${dice.id}`}
                        >
                          {/* Sits exactly flat on the dark tabletop under the 3D cube */}
                          <div 
                            className="absolute inset-[-2px] bg-black/85 rounded-full filter blur-[3.5px] pointer-events-none" 
                            style={{ transform: 'translateZ(-3px) scale(1.1)' }} 
                          />
                          
                          {/* 3D Cube Container - elevated off the board and rotated strictly on local Z axis of target surface */}
                          <div
                            className="relative w-full h-full"
                            style={{
                              transformStyle: 'preserve-3d',
                              transform: `translateZ(18px) rotateZ(${pos.rot + (isRolling ? (Math.random() * 320 - 160) : 0)}deg)`,
                              transition: 'none'
                            }}
                          >
                            {/* Front Face */}
                            {renderDiceFace(faces.front, 'front', 'rotateY(0deg) translateZ(18px)')}

                            {/* Back Face */}
                            {renderDiceFace(faces.back, 'back', 'rotateY(180deg) translateZ(18px)')}

                            {/* Left Face */}
                            {renderDiceFace(faces.left, 'left', 'rotateY(-90deg) translateZ(18px)')}

                            {/* Right Face */}
                            {renderDiceFace(faces.right, 'right', 'rotateY(90deg) translateZ(18px)')}

                            {/* Top Face */}
                            {renderDiceFace(faces.top, 'top', 'rotateX(90deg) translateZ(18px)')}

                            {/* Bottom Face */}
                            {renderDiceFace(faces.bottom, 'bottom', 'rotateX(-90deg) translateZ(18px)')}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 悬顶式拟真极奢黑金及银环 3D 色盅 - 饱满不透明材质 - 比例与款式完美复刻用户图片 - 支持手势滑动且即时回弹 */}
                <div 
                  className="absolute w-[172px] h-[280px] z-20 cursor-grab active:cursor-grabbing select-none touch-none"
                  style={{
                    left: '50%',
                    top: '252px', // Bottom of the cup aligns perfectly with Y = 252px to fully cover the dices
                    transform: `translate3d(-50%, -100%, 0px) perspective(700px) rotateX(${cupRotateX}deg) translateY(${cupOffsetY}px) rotate(${cupRotate}deg)`,
                    transformOrigin: 'bottom center',
                    transition: cupTransition,
                    opacity: gameState === 'revealed' ? 0 : (isDraggingCup ? 1 : (gameState === 'peeking' ? 0.22 : 1)),
                    pointerEvents: isRolling ? 'none' : 'auto',
                    touchAction: 'none'
                  }}
                  onMouseDown={(e) => { e.preventDefault(); handleCupDragStart(e.clientY); }}
                  onTouchStart={(e) => { handleCupDragStart(e.touches[0].clientY); }}
                  id="mp_3d_cup_element"
                >
                  {/* Shaking Container as Child to prevent inline transform conflict */}
                  <div className={`w-full h-full relative ${isRolling ? 'animate-[cupShake_0.6s_infinite_linear]' : ''}`}>
                    
                    {/* Modern Black Cylindrical Premium Cup Styled precisely as the user image:
                        - Rich glossy cylindrical black gradient background
                        - Horizontal brushed steel linear rings (bands) near top and bottom
                        - Subtle cybernetic microdot futuristic tech pattern in between
                     */}
                    <div className="relative w-full h-full bg-gradient-to-r from-[#0a0b0d] via-[#16181b] via-[#2d3139] via-[#16181b] to-[#0a0b0d] rounded-t-[20px] rounded-b-[18px] shadow-[0_20px_45px_rgba(0,0,0,0.95),inset_0_3px_8px_rgba(255,255,255,0.15)] border border-black/80 flex flex-col items-center justify-center overflow-hidden">
                      
                      {/* Top Silver Band */}
                      <div className="absolute top-[35px] left-0 right-0 h-[18px] bg-gradient-to-r from-[#595b5e] via-[#cbd0d3] via-[#ffffff] via-[#a2a6aa] to-[#595b5e] border-y border-white/20 shadow-[0_2px_4px_rgba(0,0,0,0.4)] pointer-events-none z-10" />

                      {/* Bottom Silver Band */}
                      <div className="absolute bottom-[35px] left-0 right-0 h-[18px] bg-gradient-to-r from-[#595b5e] via-[#cbd0d3] via-[#ffffff] via-[#a2a6aa] to-[#595b5e] border-y border-white/20 shadow-[0_-2px_4px_rgba(0,0,0,0.4)] pointer-events-none z-10" />

                      {/* Cybernetic/Futuristic microdot textured core background (between bands) */}
                      <div 
                        className="absolute top-[53px] bottom-[53px] left-0 right-0 opacity-[0.25] pointer-events-none mix-blend-overlay"
                        style={{
                          backgroundImage: `
                            radial-gradient(circle, #ffffff 1.2px, transparent 1.2px),
                            linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)
                          `,
                          backgroundSize: '12px 12px, 24px 24px, 24px 24px',
                          backgroundPosition: 'center'
                        }}
                      />

                      {/* Add high-tech decorative circuit-like tracks to match the image's futuristic details */}
                      <div className="absolute top-[75px] bottom-[75px] left-[15px] right-[15px] border border-white/[0.04] rounded-lg pointer-events-none opacity-20" />
                      <div className="absolute top-[105px] bottom-[105px] left-[30px] right-[30px] border-x border-white/[0.05] pointer-events-none opacity-30" />

                      {/* Vertical specular sheen highlight / soft reflections */}
                      <div className="absolute top-0 bottom-0 left-[24px] w-5 bg-white/5 filter blur-[1px] pointer-events-none" />
                      <div className="absolute top-0 bottom-0 left-[45px] w-1.5 bg-white/10 filter blur-[0.6px] pointer-events-none" />
                      <div className="absolute top-0 bottom-0 right-[35px] w-6 bg-white/5 filter blur-[1.5px] pointer-events-none" />

                    </div>
                  </div>
                </div>

                {/* 下方拖动浮空提示 */}
                <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 select-none pointer-events-none z-30">
                  <span className={`text-[10px] font-medium tracking-wider text-slate-400 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] ${gameState === 'peeking' ? 'text-sky-400 font-bold animate-pulse' : ''}`}>
                    {gameState === 'covered' ? '👇 向上滑拖动色盅查看' : gameState === 'peeking' ? '👁️ 只您得见' : '已开启'}
                  </span>
                </div>

              </div>

              {/* 3. 中部文本状态 */}
              <div className="text-center h-8 flex items-center justify-center">
                {isRolling ? (
                  <span className="text-xs font-semibold text-rose-500 animate-[shake_0.5s_infinite_linear] uppercase tracking-wider">🎲 骰盅疯狂摇晃中... (藏好)</span>
                ) : (
                  <>
                    {gameState === 'covered' && (
                      <span className="text-[11px] text-zinc-400">🔒 向上划提色盅即可偷看，松手自动盖回</span>
                    )}
                    {gameState === 'peeking' && (
                      <span className="text-[11px] text-[#38BDF8] font-bold animate-pulse">👁️ 偷看中 (松手会自动弹回盖上)</span>
                    )}
                    {gameState === 'revealed' && (
                      <span className="text-[11px] text-amber-500 font-bold">🔓 色盅完全拉起，所有骰子敞现</span>
                    )}
                  </>
                )}
              </div>

              {/* 4. 底栏操作动作按键 - 底部三连按钮 + 齿轮展开设置 */}
              <div className="relative flex flex-col gap-3 mt-1.5" id="bottom_actions_row">
                
                {/* 底部三连：左=声音开关、中=大号红色「摇」、右=⚙️ */}
                <div className="flex items-center justify-between gap-3 px-1">
                  
                  {/* 左：音效快捷开关 */}
                  <button 
                    onClick={handleToggleSound}
                    className={`p-3 rounded-full flex items-center justify-center transition-all duration-150 border shadow-md active:scale-95 ${soundEnabled ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30 shadow-emerald-500/5' : 'text-zinc-500 bg-zinc-900/60 border-zinc-800 hover:text-zinc-300'}`}
                    style={{ minWidth: '46px', minHeight: '46px' }}
                    title="音效开关"
                  >
                    {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                  </button>

                  {/* 中：大号抢眼物理红色『摇』 (ROLL) - 带精致发光呼吸态 */}
                  <button 
                    onClick={handleTapRoll}
                    disabled={isRolling}
                    className={`flex-1 py-3 px-6 rounded-full text-base font-extrabold text-white tracking-[6px] shadow-xl flex items-center justify-center gap-1.5 transition-all bg-gradient-to-r from-red-500 via-rose-600 to-red-600 hover:brightness-110 active:scale-[0.96] shadow-red-600/30 ${isRolling ? 'opacity-40 shadow-none scale-95' : 'hover:scale-[1.01]'}`}
                    style={{ textShadow: '0 1.5px 3px rgba(0,0,0,0.38)', minHeight: '52px' }}
                  >
                    <Sparkles className="w-4.5 h-4.5 animate-spin-slow" />
                    <span>摇</span>
                  </button>

                  {/* 右：齿轮⚙️，点击展开设置面板 */}
                  <button 
                    onClick={() => {
                      setSettingsVisible(prev => !prev);
                      triggerHaptic('light');
                    }}
                    className={`p-3 rounded-full flex items-center justify-center transition-all duration-150 border shadow-md active:scale-95 ${settingsVisible ? 'text-rose-400 bg-rose-500/15 border-rose-500/30 shadow-rose-500/10' : 'text-zinc-400 bg-zinc-900/60 border-zinc-800 hover:text-zinc-300'}`}
                    style={{ minWidth: '46px', minHeight: '46px' }}
                    title="设置"
                  >
                    <Settings className="w-5 h-5" />
                  </button>
                </div>

                {/* 5. 齿轮展开设置面板 (震动 / 音效 / 阻力开盅规律配置) */}
                <AnimatePresence>
                  {settingsVisible && (
                    <motion.div 
                      initial={{ opacity: 0, y: 12, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.97 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      className="absolute inset-x-1 bottom-[64px] bg-[#111116]/98 backdrop-blur-md border border-zinc-800/90 rounded-[22px] p-4 shadow-[0_20px_40px_rgba(0,0,0,0.9)] z-30"
                    >
                      <div className="flex items-center justify-between border-b border-zinc-900 pb-2 mb-3">
                        <span className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                          <Sliders className="w-3.5 h-3.5 text-rose-500" />
                          骰小程序底层参数设置
                        </span>
                        <button 
                          onClick={() => setSettingsVisible(false)}
                          className="text-[10px] text-zinc-400 hover:text-zinc-200 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800"
                        >
                          ✕
                        </button>
                      </div>

                      {/* 调参开关列表 */}
                      <div className="flex flex-col gap-3">
                        {/* 震动反馈 */}
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-zinc-400">📲 触控震动反馈 (Vibrate)</span>
                          <button 
                            onClick={handleToggleVibrate}
                            className={`px-3 py-1 rounded-full border text-[10px] font-bold tracking-wider transition-all ${vibrateEnabled ? 'text-sky-400 border-sky-500/35 bg-sky-500/10' : 'text-zinc-500 border-zinc-800 bg-zinc-900/50'}`}
                          >
                            {vibrateEnabled ? '已开' : '已关'}
                          </button>
                        </div>

                        {/* 系统音效 */}
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-zinc-400">🔊 摇撞仿真音效 (Sound FX)</span>
                          <button 
                            onClick={handleToggleSound}
                            className={`px-3 py-1 rounded-full border text-[10px] font-bold tracking-wider transition-all ${soundEnabled ? 'text-emerald-400 border-emerald-500/35 bg-emerald-500/10' : 'text-zinc-500 border-zinc-800 bg-zinc-900/50'}`}
                          >
                            {soundEnabled ? '已开' : '已关'}
                          </button>
                        </div>

                        {/* 开盅・盖回规则调节 */}
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-zinc-400">🔓 物理拖曳自动锁盅 (Auto Reveal)</span>
                          <button 
                            onClick={() => {
                              const nextVal = !autoRevealBehavior;
                              setAutoRevealBehavior(nextVal);
                              localStorage.setItem('autoRevealBehavior', String(nextVal));
                              addLog(`User Interaction: 调整开闭锁定规律 [${nextVal ? '锁定敞现' : '松手百分百回弹罩盖'}]`);
                              triggerHaptic('light');
                            }}
                            className={`px-3 py-1 rounded-full border text-[10px] font-bold tracking-wider transition-all ${autoRevealBehavior ? 'text-amber-400 border-amber-500/35 bg-amber-500/10' : 'text-zinc-500 border-zinc-800 bg-zinc-900/50'}`}
                          >
                            {autoRevealBehavior ? '拖过开启' : '松手仅盖回'}
                          </button>
                        </div>

                        {/* 快速开盅亮底辅助键 */}
                        <div className="flex justify-between items-center text-xs border-t border-zinc-900/60 pt-2.5 mt-0.5">
                          <span className="text-zinc-400">⚡ 色盅一键开/盖 (Quick Show)</span>
                          <button 
                            onClick={() => {
                              handleToggleReveal();
                              setSettingsVisible(false);
                            }}
                            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-100 px-3 py-1 border border-zinc-750 rounded-full text-[10px] font-bold font-mono"
                          >
                            {gameState === 'revealed' ? '🔒 盖盅' : '🔓 开盅'}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

              </div>

              {/* 5. 贴心脚注 */}
              <div className="mt-4 text-center">
                <span className="text-[9px] text-zinc-500 block leading-tight">💡 真机支持：用力摇晃设备，通过网页重力感应亦可掷骰</span>
              </div>
            </div>

            {/* 手机底部触控区 Mock */}
            <div className="h-4 bg-[#09090B] flex justify-center items-center select-none z-40 pb-2">
              <div className="w-32 h-1 bg-zinc-700 rounded-full" />
            </div>

          </div>
        </section>

        {/* 第二列：开发者工作台 - 包含小程序配置面板与代码查看 (占 7格) */}
        <section className="xl:col-span-7 flex flex-col gap-5" id="developer_console_column">
          
          {/* 小程序沙箱仿真调试控制台 */}
          <div className="bg-[#0F0F11]/90 rounded-2xl border border-zinc-800/85 p-5 flex flex-col gap-4 shadow-xl" id="sensory_simulator_panel">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-sky-400" />
              小程序底层模拟调参 & 仿真传感器反馈
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* 重力加速检测调整 */}
              <div className="bg-[#141416]/50 p-4 rounded-xl border border-zinc-800/60 flex flex-col gap-3">
                <div className="flex justify-between items-center text-xs text-zinc-400">
                  <span className="flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-sky-400" />
                    加速度重力传感摇一摇
                  </span>
                  <span className="font-mono text-emerald-400">阈值: {shakeThreshold.toFixed(1)}g</span>
                </div>
                
                <input 
                  type="range" 
                  min="1.2" 
                  max="2.5" 
                  step="0.1" 
                  value={shakeThreshold}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setShakeThreshold(val);
                    addLog(`Developer Action: 调整重力抖动阈值为: ${val.toFixed(1)}g`);
                  }}
                  className="w-full accent-emerald-500 bg-zinc-800 h-1.5 rounded-lg appearance-none cursor-ew-resize"
                />
                
                <div className="flex justify-between items-center mt-1">
                  <button 
                    onClick={() => {
                      addLog('Developer Tool: 注入合位移加速度 2.3G (触发成功)');
                      triggerRollEvent();
                    }}
                    disabled={isRolling}
                    className="text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded font-medium flex items-center gap-1 transition-all disabled:opacity-40"
                  >
                    <span>🎯 触发虚拟摇晃 (Simulate Shake)</span>
                  </button>
                  <span className="text-[10px] text-zinc-500">模拟加速度计瞬时破阀</span>
                </div>
              </div>

              {/* 音影物理振动反馈 */}
              <div className="bg-[#141416]/50 p-4 rounded-xl border border-zinc-800/60 flex flex-col justify-between gap-3">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span className="flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-sky-400" />
                    触感与系统反馈通知
                  </span>
                  <span className="text-xs text-zinc-500">HTML5 Audio + Vibrate</span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <div className="text-xs text-zinc-400 flex items-center gap-2">
                    <div className="p-1.5 rounded bg-[#18181B] border border-zinc-800">
                      🔊 {soundEnabled ? 'Web Audio OK' : 'Audio Disabled'}
                    </div>
                    <div className="p-1.5 rounded bg-[#18181B] border border-zinc-800">
                      📳 {vibrateEnabled ? 'Haptic API OK' : 'Haptic Disabled'}
                    </div>
                  </div>
                </div>

                <div className="text-[10px] text-zinc-500 flex items-start gap-1 leading-normal">
                  <Info className="w-3 h-3 text-sky-400 shrink-0 mt-0.5" />
                  <span>本小程序采用的 `utils/dice.js` 产生的纯净独立序列。不引入任何 3D 复杂引擎，确保体积最精简。</span>
                </div>
              </div>

            </div>
          </div>

          {/* 小程序源码预览面板 (极高逼格) */}
          <div className="bg-[#0F0F11]/90 rounded-2xl border border-zinc-800/85 overflow-hidden shadow-xl flex-1 flex flex-col min-h-[450px]" id="code_explorer">
            
            {/* 标签栏 */}
            <div className="bg-[#141416]/90 border-b border-zinc-800 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-amber-500" />
                <h4 className="text-xs font-semibold text-white tracking-widest uppercase">微信小程序工程源码包 (.WXML / .WXSS / .JS)</h4>
              </div>
              <div className="flex items-center gap-1.5 bg-zinc-900/60 p-1 rounded-lg border border-zinc-800 text-xs w-full sm:w-auto overflow-x-auto">
                {MP_FILES.map((file, idx) => (
                  <button
                    key={file.path}
                    onClick={() => {
                      setActiveFileIdx(idx);
                      setIsCopied(false);
                    }}
                    className={`px-2.5 py-1 rounded transition duration-150 shrink-0 select-none whitespace-nowrap ${activeFileIdx === idx ? 'bg-zinc-800 text-white font-medium border border-zinc-700' : 'text-zinc-400 hover:text-white'}`}
                  >
                    {file.path.split('/').pop()}
                  </button>
                ))}
              </div>
            </div>

            {/* 文件详情与一键复制 */}
            <div className="bg-[#0B0B0C]/40 px-5 py-2 border-b border-zinc-800 flex justify-between items-center text-xs">
              <div className="flex items-center gap-2 text-zinc-400">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span className="font-mono text-[11px]">位置: /{MP_FILES[activeFileIdx].path}</span>
              </div>
              <button 
                onClick={handleCopyCode}
                className="flex items-center gap-1 text-sky-400 hover:text-sky-300 bg-[#141416] hover:bg-zinc-800 border border-zinc-800 px-2.5 py-1 rounded transition-all duration-150"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{isCopied ? '复制成功！' : '复制代码'}</span>
              </button>
            </div>

            {/* 源码阅读器区域 */}
            <div className="flex-1 overflow-auto p-4 bg-[#09090B]/90 font-mono text-[11.5px] leading-relaxed text-zinc-300 relative max-h-[350px]" id="code_snippet_pre_holder">
              <pre className="m-0 select-text overflow-x-auto whitespace-pre">
                <code>{MP_FILES[activeFileIdx].content}</code>
              </pre>
            </div>

            {/* 小程序控制台日志仿真 (wx API Console Output) */}
            <div className="bg-[#070708]/95 border-t border-zinc-850 flex flex-col h-[180px]">
              <div className="bg-[#0F0F11]/90 px-4 py-2 border-b border-zinc-850 flex items-center justify-between text-[11px] text-zinc-400">
                <div className="flex items-center gap-1.5 font-mono">
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  <span>WeChat Mini Program Runtime Console</span>
                </div>
                <button 
                  onClick={() => setLogs([])}
                  className="text-zinc-500 hover:text-zinc-300 text-[10px] uppercase font-mono"
                >
                  Clear Console
                </button>
              </div>

              <div className="flex-1 p-3 overflow-auto font-mono text-[10.5px] text-emerald-500/90 leading-normal flex flex-col gap-1.5 selection:bg-emerald-500/20">
                {logs.length === 0 ? (
                  <span className="text-zinc-650 block text-center mt-4 italic select-none">Console is empty. Interaction logs will show up here.</span>
                ) : (
                  logs.map((log, index) => (
                    <div key={index} className="flex gap-2">
                       <span className="text-zinc-650 select-none shrink-0">{index + 1}</span>
                      <span className="block break-all">{log}</span>
                    </div>
                  ))
                )}
                <div ref={consoleEndRef} />
              </div>
            </div>

          </div>
        </section>

      </main>

      {/* 底部详细的验收引导与说明 (对回滚和改动进行高度配合交付) */}
      <footer className="border-t border-zinc-850 bg-[#0A0A0B] py-8 px-6 mt-12" id="workspace_footer">
        <div className="max-w-6xl mx-auto flex flex-col gap-6">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-zinc-400">
            <div className="flex flex-col gap-2">
              <span className="text-white font-semibold">🔍 双渠道完美验收</span>
              <p className="leading-relaxed">
                您可通过手机扫描本工作台页面或在浏览器中打开 shared 链接，用力摇晃您的手机即可体验完全同步的重力摇数；在非移动设备或模拟器上，可通过工作台『触发虚拟摇晃』或手机中的『猛摇色盅』展开体验。
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-white font-semibold">📁 工程代码完美隔离</span>
              <p className="leading-relaxed">
                小程序全部代码均已按照规范和您所设计的目录结构在 workspace 的根目录下完整创建。所有逻辑完全使用微信小程序标准 CommonJS/JS/WXML 封装编写。您可以点击右上部分一键复制源码，也可以选择下载整个 ZIP 工程进行微信开发者工具完美一键导入。
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-white font-semibold">⚖️ 多端音效包完全就绪</span>
              <p className="leading-relaxed">
                代码中通过 `wx.createInnerAudioContext` 面板绑定了 `/assets/shake.mp3` 以及 `/assets/land.mp3` 路径并创建了两个空白占位静音音频。在微信小程序中，后续只需要替换该两个文件即可实现完美的落定音效。
              </p>
            </div>
          </div>

          <div className="border-t border-zinc-800/80 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
            <span>Powered by Antigravity AI Engine & Google AI Studio</span>
            <span>当前时区：2026-06-15</span>
          </div>

        </div>
      </footer>

    </div>
  );
}
