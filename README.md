# IPTV Player - Tauri 桌面应用

基于 Tauri v2 开发的 Windows IPTV 播放器。

## 功能特性

- 📁 **文件导入** - 支持导入 M3U / M3U8 / TXT 格式的播放列表文件
- 🔗 **URL 导入** - 支持从网络地址导入播放列表
- 📂 **分组管理** - 自动按分组组织频道，支持快速切换
- 🔍 **关键词搜索** - 实时搜索频道名称和分组
- 📄 **分页浏览** - 每页 24 个频道，支持翻页导航
- 🌙 **深色/浅色模式** - 一键切换主题，自动保存偏好
- 🎬 **HLS 支持** - 内置 hls.js，支持 m3u8 流媒体播放
- 🖼️ **台标显示** - 自动显示频道 logo

## 使用方法

### 导入播放列表

1. 点击右上角「📁 文件导入」按钮，选择本地的 M3U/M3U8 文件
2. 或点击「🔗 URL导入」按钮，输入播放列表的网络地址

### 浏览频道

- 左侧边栏显示所有分组，点击切换分组
- 顶部搜索框可实时搜索频道
- 频道列表支持分页，使用底部分页控件翻页

### 播放频道

- 点击任意频道卡片即可开始播放
- 播放器支持暂停、音量调节、全屏等控制
- 正在播放的频道会高亮显示

### 切换主题

- 点击右上角月亮/太阳图标切换深色/浅色模式
- 主题偏好会自动保存

## 项目结构

```
iptv-player/
├── package.json              # npm 配置
├── src/                      # 前端代码
│   ├── index.html            # 主页面
│   ├── style.css             # 样式表
│   └── main.js               # 核心逻辑
└── src-tauri/                # Rust 后端
    ├── Cargo.toml            # Rust 依赖配置
    ├── tauri.conf.json       # Tauri 配置
    ├── build.rs              # 构建脚本
    ├── icons/                # 应用图标
    └── src/
        └── main.rs           # Rust 主程序
```

## 开发命令

```bash
# 安装依赖
npm install

# 开发模式运行
npm run dev
# 或
npx tauri dev

# 构建发布版本
npm run build
# 或
npx tauri build
```

## 技术栈

- **后端**: Rust + Tauri v2
- **前端**: 原生 HTML/CSS/JavaScript
- **播放器**: hls.js + HTML5 Video
- **插件**:
  - tauri-plugin-dialog (文件选择对话框)
  - tauri-plugin-fs (文件系统访问)
  - tauri-plugin-http (HTTP 请求)

## M3U 格式支持

支持标准 M3U 格式，包含以下属性：
- `#EXTINF:` - 频道信息
- `tvg-logo` - 频道台标 URL
- `group-title` - 分组名称

示例：
```
#EXTM3U
#EXTINF:-1 tvg-logo="https://example.com/logo.png" group-title="新闻",CCTV-1 综合
https://example.com/stream.m3u8
```
