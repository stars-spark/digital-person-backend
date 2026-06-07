/**
 * 全局配置 —— 演示前只改这一处。
 *
 * LAN_HOST：跑后端/桥接/SRS 的那台 4080 机器的局域网 IP。
 *   - 本机 DevTools 模拟器调试：用 'localhost'
 *   - 手机真机（同一 WiFi）：用 `hostname -I` 查到的 IP，例如 '192.168.1.23'
 *
 * 端口与现有全栈一致（见 CLAUDE.md「本地全栈启动顺序」）：
 *   8000 = RAG 后端   9000 = 桥接层   8080 = SRS 的 HTTP-FLV/HLS
 */
const LAN_HOST = 'localhost';

module.exports = {
  LAN_HOST,
  BACKEND: `http://${LAN_HOST}:8000`,   // /trip/* /asr /chat/image /digital-human/config
  BRIDGE: `http://${LAN_HOST}:9000`,    // /live/ask /live/say /live/health
  // SRS 的 HLS 直播地址（数字人连续画面）。需 deploy/srs.conf 开启 HLS。
  HLS: `http://${LAN_HOST}:8080/live/livestream.m3u8`,
  // LiveTalking RTMP 单路固定会话 ID（与 app.html 一致）
  SESSION_ID: '0',
};
