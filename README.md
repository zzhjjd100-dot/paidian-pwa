# 拍点 · Tempo Practice

一款为乐器练习设计的 PWA 节拍器，支持离线使用和安装到桌面或手机主屏幕。

## 功能

- 20–300 BPM、拍号、细分、重音、Swing 与 Tap Tempo
- 木鱼、电子、鼓点和牛铃音色
- 复节奏双声部与十六格节奏型编辑器
- 静音小节、速度阶梯、练习计时与数据统计
- 调音器、录音回放、预设收藏与分享
- iOS 安全区与 Safari 音频适配

## 本地运行

```bash
python3 -m http.server 4173
```

打开 `http://localhost:4173`。Service Worker 和麦克风功能需要 HTTPS 或 localhost 环境。
