/**
 * 跨平台轻量触觉反馈
 * - Android Chrome / 国内浏览器：navigator.vibrate（直接生效）
 * - iOS Safari / iOS PWA：vibrate API 被禁用，无副作用
 *   未来若用户允许通知 / 使用原生壳，可在此处接 Taptic Engine
 */

const canVibrate = typeof navigator !== 'undefined' && 'vibrate' in navigator;

export const haptics = {
  /** 一次轻微点击反馈（打勾、按钮） */
  light(): void {
    if (canVibrate) navigator.vibrate(8);
  },
  /** 中等强度（完成一组、提交） */
  medium(): void {
    if (canVibrate) navigator.vibrate(16);
  },
  /** 成功（PR、训练完成） */
  success(): void {
    if (canVibrate) navigator.vibrate([20, 60, 30]);
  },
  /** 警告（删除确认） */
  warning(): void {
    if (canVibrate) navigator.vibrate([40, 40, 40]);
  },
  /** 倒计时结束 */
  done(): void {
    if (canVibrate) navigator.vibrate([200, 100, 200]);
  },
};
