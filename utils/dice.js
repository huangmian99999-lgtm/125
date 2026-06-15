/**
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
};
