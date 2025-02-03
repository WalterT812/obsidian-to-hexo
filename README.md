# Obsidian to Hexo Plugin

一个用于将 Obsidian 笔记同步到 Hexo 博客的插件。

> 作者：Walter Tang
> 
> GitHub：[waltert812/obsidian-to-hexo](https://github.com/waltert812/obsidian-to-hexo)

## 功能特点

### 1. 博客编辑模式
- 通过右下角状态栏或命令面板快速切换
- 开启后自动处理图片路径和格式

### 2. 图片处理
- 支持拖拽和粘贴图片
- 自动创建与文章同名的图片文件夹
- 可选转换为 WebP 格式
- 可调整 WebP 转换质量（1-100）
- 粘贴图片时可自定义图片名称
- 支持实时预览博客图片标签
- 类似原生 `![[]]` 的图片预览效果

### 3. 文件同步
- 自动同步 Markdown 文件到 Hexo _posts 目录
- 自动同步图片文件到对应文章目录
- 可选是否保持原始文件夹结构
- 支持一键部署到 Hexo

## 设置选项

1. **Markdown 源文件路径**: 已发布的 Markdown 文件所在路径
2. **图片源文件路径**: 博客图片文件所在路径
3. **Hexo 文章路径**: Hexo _posts 文件夹路径
4. **Hexo 根目录路径**: Hexo 站点根目录路径
5. **保持文件夹结构**: 同步时是否保持原始文件夹结构
6. **博客编辑模式**: 开启后自动处理图片路径
7. **转换为 WebP**: 是否将图片自动转换为 WebP 格式
8. **WebP 质量**: WebP 转换质量设置（1-100）
9. **启用图片预览**: 是否启用博客图片标签的实时预览

## 使用方法

### 安装
1. 下载插件文件
2. 将文件放入 `.obsidian/plugins/obsidian-to-hexo/` 目录
3. 在 Obsidian 设置中启用插件

### 配置
1. 在插件设置中配置相关路径
2. 根据需要调整其他选项

### 日常使用
1. 开启博客编辑模式（点击右下角状态栏或使用命令面板）
2. 直接拖拽或粘贴图片到文章中
3. 使用命令面板中的"同步博客文件并部署"命令进行同步
4. 可以通过右下角的刷新按钮手动刷新图片预览

## 图片标签格式
```
{% fb_img \image\posts\test\image.webp "image" %}
```

## 文件结构 
```
your-post.md -> posts/your-post/your-post.md
Images/your-post/1.png -> posts/your-post/1.png
```

## 注意事项
1. 首次使用请正确配置所有路径
2. 建议在同步前备份重要文件
3. WebP 转换功能需要浏览器支持
4. 图片预览功能需要同时开启博客编辑模式和图片预览选项

## 开发

### 环境要求
- Node.js
- npm

### 开发步骤
```bash
# 克隆仓库
git clone https://github.com/waltert812/obsidian-to-hexo.git

# 安装依赖
cd obsidian-to-hexo
npm install

# 开发构建
npm run dev

# 生产构建
npm run build
```

### 目录结构
```
obsidian-to-hexo/
├── src/
│   └── main.ts          # 主要源代码
├── styles.css           # 样式文件
├── manifest.json        # 插件清单
├── package.json         # 项目配置
└── README.md           # 说明文档
```

## 更新日志

### 0.2.0
- 添加图片预览功能
- 支持实时预览博客图片标签
- 添加图片预览刷新按钮
- 优化编辑模式下的显示效果

### 0.1.0
- 初始版本
- 支持 Markdown 和图片同步
- 支持图片转换为 WebP
- 支持图片路径处理

## 许可证

MIT License