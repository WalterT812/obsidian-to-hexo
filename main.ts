import { App, Plugin, PluginSettingTab, Setting, Notice } from 'obsidian';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { Editor, MarkdownView } from 'obsidian';
import { Modal } from 'obsidian';
import { normalizePath } from 'obsidian';
import { TFile } from 'obsidian';

interface BlogSyncSettings {
    markdownSourcePath: string;
    imageSourcePath: string;
    hexoPostPath: string;
    hexoRootPath: string;
    keepFolderStructure: boolean;
    blogEditMode: boolean;
    convertToWebP: boolean;
    webpQuality: number;
    enableImagePreview: boolean;
}

const DEFAULT_SETTINGS: BlogSyncSettings = {
    markdownSourcePath: 'E:\\Blog\\blog_obsidian_vault\\1-BlogDrafts\\Published',
    imageSourcePath: 'E:\\Blog\\blog_obsidian_vault\\2-BlogResources\\Images',
    hexoPostPath: 'E:\\Blog\\hexo_site\\source\\_posts',
    hexoRootPath: 'E:\\Blog\\hexo_site',
    keepFolderStructure: true,
    blogEditMode: false,
    convertToWebP: true,
    webpQuality: 80,
    enableImagePreview: true
};

export default class BlogSyncPlugin extends Plugin {
    settings: BlogSyncSettings = DEFAULT_SETTINGS;
    statusBarItem: HTMLElement;
    refreshButton: HTMLElement;
    private readonly CURRENT_VERSION = '0.1.0';
    private readonly DATA_VERSION_KEY = 'version';
    private readonly CHANGE_LOG = {
        '0.1.0': [
            '初始版本',
            '支持 Markdown 和图片同步',
            '支持图片转换为 WebP',
            '支持图片预览功能'
        ]
    };

    // 添加正则表达式来匹配图片标签
    private readonly IMAGE_REGEX = /{% fb_img \\image\\posts\\test\\([^"]+) "([^"]+)" %}/g;

    async onload() {
        await this.loadSettings();

        // 检查版本更新
        const data = await this.loadData();
        const lastVersion = (data && data[this.DATA_VERSION_KEY]) || '0.0.0';
        if (lastVersion !== this.CURRENT_VERSION) {
            this.showUpdateNotice(lastVersion);
            await this.saveData({
                ...data,
                [this.DATA_VERSION_KEY]: this.CURRENT_VERSION
            });
        }

        // 添加状态栏
        this.statusBarItem = this.addStatusBarItem();
        this.statusBarItem.onClickEvent(() => this.toggleBlogEditMode());
        this.updateStatusBar();

        // 添加刷新按钮
        this.refreshButton = this.addStatusBarItem();
        this.refreshButton.addClass('blog-refresh-button');
        this.refreshButton.setText('🔄 刷新图片预览');
        this.refreshButton.onClickEvent(() => this.refreshImagePreviews());
        this.updateRefreshButton();

        // 添加同步命令
        this.addCommand({
            id: 'sync-blog',
            name: '同步博客文件并部署',
            callback: () => this.syncAndDeploy()
        });

        // 添加切换博客编辑模式的命令
        this.addCommand({
            id: 'toggle-blog-edit-mode',
            name: '切换博客编辑模式',
            callback: () => this.toggleBlogEditMode()
        });

        // 添加设置选项卡
        this.addSettingTab(new BlogSyncSettingTab(this.app, this));

        // 添加编辑器事件监听
        this.registerEvent(
            this.app.workspace.on('editor-paste', this.handlePaste.bind(this))
        );

        this.registerEvent(
            this.app.workspace.on('editor-drop', this.handleDrop.bind(this))
        );

        // [测试代码开始] - 发布时删除
        this.addCommand({
            id: 'test-image-preview',
            name: '测试图片预览',
            callback: () => this.testImagePreview()
        });
        // [测试代码结束]

        // 注册 Markdown 后处理器
        this.registerMarkdownPostProcessor((el, ctx) => {
            console.log('=== Markdown 处理器开始 ===');
            console.log('当前元素类型:', el.tagName);
            console.log('当前元素内容:', el.innerHTML);
            console.log('上下文:', {
                sourcePath: ctx.sourcePath,
                frontmatter: ctx.frontmatter
            });

            // 检查是否启用了预览功能
            if (!this.settings.blogEditMode || !this.settings.enableImagePreview) {
                console.log('预览功能未启用:', {
                    blogEditMode: this.settings.blogEditMode,
                    enableImagePreview: this.settings.enableImagePreview
                });
                return;
            }

            // 获取当前文件的 TFile
            const currentFile = ctx.sourcePath ? this.app.vault.getAbstractFileByPath(ctx.sourcePath) : null;
            if (!currentFile) {
                console.log('无法获取当前文件');
                return;
            }

            // 检查是否是 Markdown 文件
            if (!(currentFile instanceof TFile) || currentFile.extension !== 'md') {
                console.log('不是 Markdown 文件:', currentFile);
                return;
            }

            const codeBlocks = el.querySelectorAll('p');
            console.log('找到段落数:', codeBlocks.length);

            codeBlocks.forEach((block, index) => {
                const text = block.textContent;
                console.log(`检查段落 ${index + 1}:`, {
                    text,
                    html: block.innerHTML
                });

                if (!text) {
                    console.log(`段落 ${index + 1} 为空`);
                    return;
                }

                const matches = Array.from(text.matchAll(this.IMAGE_REGEX));
                console.log(`段落 ${index + 1} 的匹配结果:`, {
                    regex: this.IMAGE_REGEX.source,
                    matches: matches.map(m => m[0])
                });

                if (matches.length > 0) {
                    matches.forEach((match, matchIndex) => {
                        const [fullMatch, fileName, caption] = match;
                        console.log(`处理第 ${matchIndex + 1} 个图片:`, {
                            fullMatch,
                            fileName,
                            caption
                        });
                        
                        // 创建容器
                        const container = el.createEl('div', {
                            cls: 'blog-image-preview',
                            attr: {
                                'data-image-name': fileName,
                                'aria-label': caption
                            }
                        });
                        
                        // 使用正确的 vault 路径
                        const imagePath = `2-BlogResources/Images/test/${fileName}`;
                        const imageFile = this.app.vault.getAbstractFileByPath(imagePath);
                        
                        console.log('图片路径:', {
                            imagePath,
                            exists: !!imageFile,
                            vaultPath: this.app.vault.getName()
                        });

                        if (imageFile instanceof TFile) {
                            // 使用 Obsidian 的 createEl 创建图片
                            const img = container.createEl('img', {
                                attr: {
                                    src: this.app.vault.getResourcePath(imageFile),
                                    alt: caption,
                                    'data-path': imagePath
                                }
                            });
                            console.log('图片元素已创建');
                        } else {
                            // 使用 vault 相对路径
                            const img = container.createEl('img', {
                                attr: {
                                    src: this.app.vault.adapter.getResourcePath(imagePath),
                                    alt: caption
                                }
                            });
                            console.log('使用完整路径创建图片元素');
                        }
                        
                        // 替换原始文本
                        if (block.textContent === fullMatch) {
                            // 创建包装容器
                            const wrapper = el.createEl('div', { cls: 'blog-image-wrapper' });
                            
                            // 添加图片预览
                            wrapper.appendChild(container);
                            
                            // 添加标签（会被 CSS 隐藏）
                            wrapper.createEl('span', {
                                cls: 'blog-image-tag',
                                text: `![[${fileName}]]`
                            });
                            
                            // 替换原始文本
                            block.replaceWith(wrapper);
                        }
                    });
                }
            });

            console.log('=== Markdown 处理器结束 ===');
        });

        // 强制刷新当前视图
        this.app.workspace.trigger('file-open');

        // 监听编辑器变化
        this.registerEvent(
            this.app.workspace.on('editor-change', (editor, view) => {
                if (view instanceof MarkdownView && view.getMode() === 'source') {
                    // 强制重新渲染当前视图
                    this.app.workspace.trigger('file-open');
                }
            })
        );

        // 监听文件打开
        this.registerEvent(
            this.app.workspace.on('file-open', () => {
                console.log('文件被打开，重新处理 Markdown');
            })
        );
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async syncAndDeploy() {
        try {
            // 同步 Markdown 文件
            await this.syncMarkdownFiles();
            
            // 同步图片文件
            await this.syncImageFiles();
            
            // 执行 Hexo 命令
            await this.deployHexo();
            
            new Notice('博客同步和部署成功！');
        } catch (error: any) {
            new Notice(`错误：${error.message}`);
            console.error(error);
        }
    }

    private async syncMarkdownFiles() {
        if (!fs.existsSync(this.settings.markdownSourcePath)) {
            throw new Error('Markdown 源文件路径不存在');
        }
        if (!fs.existsSync(this.settings.hexoPostPath)) {
            throw new Error('Hexo _posts 路径不存在');
        }

        // 递归获取所有 Markdown 文件
        const getAllFiles = (dirPath: string, arrayOfFiles: string[] = []): string[] => {
            const files = fs.readdirSync(dirPath);

            files.forEach((file) => {
                const fullPath = path.join(dirPath, file);
                if (fs.statSync(fullPath).isDirectory()) {
                    arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
                } else if (file.endsWith('.md')) {
                    arrayOfFiles.push(fullPath);
                }
            });

            return arrayOfFiles;
        };

        const markdownFiles = getAllFiles(this.settings.markdownSourcePath);
        
        for (const sourcePath of markdownFiles) {
            const fileName = path.basename(sourcePath);
            const fileNameWithoutExt = path.parse(fileName).name;
            
            // 直接放在 _posts 目录下
            const targetPath = path.join(this.settings.hexoPostPath, fileName);
            
            fs.copyFileSync(sourcePath, targetPath);
            console.log(`已复制文件：${fileName} 到 ${targetPath}`);
        }
    }

    private async syncImageFiles() {
        if (!fs.existsSync(this.settings.imageSourcePath)) {
            throw new Error('图片源文件路径不存在');
        }

        // 确保 Hexo 的图片目录存在
        const hexoImagePath = path.join(this.settings.hexoRootPath, 'source', 'image', 'posts');
        fs.mkdirSync(hexoImagePath, { recursive: true });

        // 递归获取所有图片文件
        const getAllImages = (dirPath: string, arrayOfFiles: string[] = []): string[] => {
            const files = fs.readdirSync(dirPath);

            files.forEach((file) => {
                const fullPath = path.join(dirPath, file);
                if (fs.statSync(fullPath).isDirectory()) {
                    arrayOfFiles = getAllImages(fullPath, arrayOfFiles);
                } else if (file.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i)) {
                    arrayOfFiles.push(fullPath);
                }
            });

            return arrayOfFiles;
        };

        const imageFiles = getAllImages(this.settings.imageSourcePath);

        for (const sourcePath of imageFiles) {
            const relativePath = path.relative(this.settings.imageSourcePath, sourcePath);
            const fileName = path.basename(sourcePath);
            const postName = path.basename(path.dirname(sourcePath));
            const targetFolder = path.join(hexoImagePath, postName);
            fs.mkdirSync(targetFolder, { recursive: true });
            const targetPath = path.join(targetFolder, fileName);

            fs.copyFileSync(sourcePath, targetPath);
            console.log(`已复制图片：${relativePath} 到 ${targetPath}`);
        }
    }

    private async deployHexo() {
        if (!fs.existsSync(this.settings.hexoRootPath)) {
            throw new Error('Hexo 根目录路径不存在');
        }

        return new Promise<string>((resolve, reject) => {
            exec(
                'hexo clean && hexo generate && hexo deploy',
                {
                    cwd: this.settings.hexoRootPath,
                    windowsHide: true
                },
                (error, stdout, stderr) => {
                    if (error) {
                        console.error(`执行错误: ${error}`);
                        reject(error);
                        return;
                    }
                    if (stderr) {
                        console.error(`标准错误: ${stderr}`);
                    }
                    console.log(`输出: ${stdout}`);
                    resolve(stdout);
                }
            );
        });
    }

    // 更新状态栏显示
    public updateStatusBar() {
        const status = this.settings.blogEditMode ? '博客编辑模式：开启' : '博客编辑模式：关闭';
        this.statusBarItem.setText(status);
        
        // 更新状态栏样式
        this.statusBarItem.classList.toggle('blog-edit-mode-active', this.settings.blogEditMode);
    }

    // 更新刷新按钮状态
    private updateRefreshButton() {
        console.log('更新刷新按钮状态:', {
            blogEditMode: this.settings.blogEditMode,
            enableImagePreview: this.settings.enableImagePreview
        });
        this.refreshButton.style.display = 
            (this.settings.blogEditMode && this.settings.enableImagePreview) 
                ? 'block' 
                : 'none';
    }

    // 刷新图片预览
    private refreshImagePreviews() {
        console.log('手动刷新图片预览');
        if (!this.settings.blogEditMode || !this.settings.enableImagePreview) {
            new Notice('请先开启博客编辑模式和图片预览功能');
            return;
        }

        // 获取当前活动的编辑器视图
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) {
            console.log('没有活动的 Markdown 视图');
            return;
        }
        console.log('当前活动文件:', activeView.file?.path);

        this.app.workspace.trigger('file-open');
        
        // 强制重新渲染
        setTimeout(() => {
            activeView.previewMode.rerender(true);
            console.log('已触发重新渲染');
        }, 100);

        new Notice('已刷新图片预览');
    }

    // 切换博客编辑模式
    async toggleBlogEditMode() {
        this.settings.blogEditMode = !this.settings.blogEditMode;
        await this.saveSettings();
        this.updateStatusBar();
        this.updateRefreshButton();
        new Notice(`博客编辑模式已${this.settings.blogEditMode ? '开启' : '关闭'}`);
    }

    // 添加一个新的方法来获取用户输入
    private async promptForImageName(defaultName: string): Promise<string> {
        return new Promise((resolve) => {
            const modal = new ImageNameModal(this.app, defaultName, (result) => {
                resolve(result || defaultName);
            });
            modal.open();
        });
    }

    // 修改处理文件的方法
    private async handleFiles(files: FileList, editor: Editor, view: MarkdownView, isPaste = false) {
        if (!view.file) {
            new Notice('无法获取当前文件信息');
            return;
        }

        const currentFileName = path.parse(view.file.path).name;
        const imageFolder = path.join(this.settings.imageSourcePath, currentFileName);

        // 确保图片目标文件夹存在
        if (!fs.existsSync(imageFolder)) {
            fs.mkdirSync(imageFolder, { recursive: true });
        }

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.type.startsWith('image/')) {
                const originalFileName = this.sanitizeFileName(file.name);
                const defaultName = path.basename(originalFileName, path.extname(originalFileName));
                
                const imageName = isPaste 
                    ? await this.promptForImageName(defaultName)
                    : defaultName;
                
                let finalBuffer = await file.arrayBuffer();
                let finalExtension = path.extname(originalFileName);
                
                if (this.settings.convertToWebP) {
                    finalBuffer = await this.convertToWebP(finalBuffer);
                    finalExtension = '.webp';
                }
                
                const finalFileName = `${imageName}${finalExtension}`;
                const filePath = path.join(imageFolder, finalFileName);

                try {
                    fs.writeFileSync(filePath, Buffer.from(finalBuffer));

                    // 插入图片引用
                    const imageLink = `{% fb_img \\image\\posts\\${currentFileName}\\${finalFileName} "${imageName}" %}`;
                    editor.replaceSelection(imageLink);

                    new Notice(`图片已转换为WebP并保存到: ${filePath}`);
                    // 添加图片后刷新预览
                    this.refreshImagePreviews();
                } catch (error) {
                    new Notice(`图片处理失败: ${error.message}`);
                    console.error('图片处理错误:', error);
                }
            }
        }
    }

    // 修改粘贴事件处理方法
    private async handlePaste(evt: ClipboardEvent, editor: Editor, view: MarkdownView) {
        if (!this.settings.blogEditMode) return;

        const files = evt.clipboardData?.files;
        if (files?.length) {
            evt.preventDefault();
            await this.handleFiles(files, editor, view, true);  // 添加 isPaste 参数
        }
    }

    // 拖放事件处理方法不变，但需要传入 isPaste 参数
    private async handleDrop(evt: DragEvent, editor: Editor, view: MarkdownView) {
        if (!this.settings.blogEditMode) return;

        const files = evt.dataTransfer?.files;
        if (files?.length) {
            evt.preventDefault();
            await this.handleFiles(files, editor, view, false);  // 添加 isPaste 参数
        }
    }

    // 清理文件名
    private sanitizeFileName(fileName: string): string {
        // 移除非法字符，替换空格为下划线
        return fileName.replace(/[^a-zA-Z0-9.-]/g, '_').toLowerCase();
    }

    // 添加一个新的方法来转换图片为 WebP
    private async convertToWebP(buffer: ArrayBuffer): Promise<ArrayBuffer> {
        return new Promise((resolve, reject) => {
            // 创建 Blob URL
            const blob = new Blob([buffer]);
            const url = URL.createObjectURL(blob);
            
            // 创建图片元素
            const img = new Image();
            img.onload = () => {
                // 创建 Canvas
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                
                // 绘制图片
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    URL.revokeObjectURL(url);
                    reject(new Error('无法创建 Canvas 上下文'));
                    return;
                }
                ctx.drawImage(img, 0, 0);
                
                // 转换为 WebP
                canvas.toBlob(
                    async (blob) => {
                        URL.revokeObjectURL(url);
                        if (!blob) {
                            reject(new Error('转换失败'));
                            return;
                        }
                        // 转换为 ArrayBuffer
                        resolve(await blob.arrayBuffer());
                    },
                    'image/webp',
                    this.settings.webpQuality / 100  // 使用设置中的质量参数
                );
            };
            
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('图片加载失败'));
            };
            
            img.src = url;
        });
    }

    private showUpdateNotice(lastVersion: string) {
        const changes = this.CHANGE_LOG[this.CURRENT_VERSION];
        if (!changes) return;

        const notice = new Notice(
            `Obsidian to Hexo 已更新到 ${this.CURRENT_VERSION}\n\n更新内容：\n${changes.join('\n')}`,
            10000
        );
    }

    // [测试代码开始] - 发布时删除
    private testImagePreview() {
        console.log('开始测试图片预览');
        
        // 使用 Obsidian 的 TFile API
        const testPath = '2-BlogResources/Images/test/test2.webp';
        console.log('测试图片路径:', testPath);
        
        // 获取资源路径
        const resourcePath = this.app.vault.adapter.getResourcePath(testPath);
        console.log('资源路径:', resourcePath);
        
        // 创建测试容器
        const testContainer = document.createElement('div');
        testContainer.style.position = 'fixed';
        testContainer.style.top = '50%';
        testContainer.style.left = '50%';
        testContainer.style.transform = 'translate(-50%, -50%)';
        testContainer.style.background = 'var(--background-primary)';
        testContainer.style.padding = '20px';
        testContainer.style.borderRadius = '10px';
        testContainer.style.boxShadow = '0 0 10px rgba(0,0,0,0.3)';
        testContainer.style.zIndex = '1000';
        
        // 添加关闭按钮
        const closeButton = document.createElement('button');
        closeButton.textContent = '关闭测试';
        closeButton.onclick = () => testContainer.remove();
        testContainer.appendChild(closeButton);
        
        // 添加图片
        const img = document.createElement('img');
        img.src = resourcePath;
        img.alt = '测试图片';
        img.style.maxWidth = '500px';
        img.style.marginTop = '10px';
        img.onerror = () => {
            console.error('图片加载失败:', resourcePath);
            img.style.border = '2px solid red';
            img.style.padding = '10px';
            img.style.display = 'block';
            const errorText = document.createElement('div');
            errorText.style.color = 'red';
            errorText.textContent = '图片加载失败';
            img.parentElement?.insertBefore(errorText, img);
        };
        testContainer.appendChild(img);
        
        // 添加路径信息
        const pathInfo = document.createElement('pre');
        pathInfo.textContent = JSON.stringify({
            testPath,
            resourcePath,
            vaultPath: this.app.vault.getName()
        }, null, 2);
        testContainer.appendChild(pathInfo);
        
        // 添加到文档
        document.body.appendChild(testContainer);
    }
    // [测试代码结束]
}

class BlogSyncSettingTab extends PluginSettingTab {
    plugin: BlogSyncPlugin;

    constructor(app: App, plugin: BlogSyncPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName('Markdown 源文件路径')
            .setDesc('已发布的 Markdown 文件所在路径')
            .addText(text => text
                .setValue(this.plugin.settings.markdownSourcePath)
                .onChange(async (value) => {
                    this.plugin.settings.markdownSourcePath = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('图片源文件路径')
            .setDesc('博客图片文件所在路径')
            .addText(text => text
                .setValue(this.plugin.settings.imageSourcePath)
                .onChange(async (value) => {
                    this.plugin.settings.imageSourcePath = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Hexo 文章路径')
            .setDesc('Hexo _posts 文件夹路径')
            .addText(text => text
                .setValue(this.plugin.settings.hexoPostPath)
                .onChange(async (value) => {
                    this.plugin.settings.hexoPostPath = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Hexo 根目录路径')
            .setDesc('Hexo 站点根目录路径')
            .addText(text => text
                .setValue(this.plugin.settings.hexoRootPath)
                .onChange(async (value) => {
                    this.plugin.settings.hexoRootPath = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('保持文件夹结构')
            .setDesc('同步时保持原始文件夹结构')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.keepFolderStructure)
                .onChange(async (value) => {
                    this.plugin.settings.keepFolderStructure = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('博客编辑模式')
            .setDesc('开启后将自动处理图片路径')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.blogEditMode)
                .onChange(async (value) => {
                    this.plugin.settings.blogEditMode = value;
                    await this.plugin.saveSettings();
                    this.plugin.updateStatusBar();
                }));

        new Setting(containerEl)
            .setName('转换为WebP')
            .setDesc('是否将图片自动转换为WebP格式')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.convertToWebP)
                .onChange(async (value) => {
                    this.plugin.settings.convertToWebP = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('WebP质量')
            .setDesc('WebP转换质量 (1-100)')
            .addSlider(slider => slider
                .setLimits(1, 100, 1)
                .setValue(this.plugin.settings.webpQuality)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.webpQuality = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('启用图片预览')
            .setDesc('在编辑模式下预览博客图片标签')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableImagePreview)
                .onChange(async (value) => {
                    this.plugin.settings.enableImagePreview = value;
                    await this.plugin.saveSettings();
                    // 刷新当前视图以更新预览
                    this.app.workspace.trigger('file-open');
                }));
    }
}

class ImageNameModal extends Modal {
    private result: string;
    private onSubmit: (result: string) => void;

    constructor(app: App, defaultValue: string, onSubmit: (result: string) => void) {
        super(app);
        this.result = defaultValue;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;

        contentEl.createEl("h2", { text: "输入图片名称" });

        new Setting(contentEl)
            .setName("图片名称")
            .addText((text) =>
                text
                    .setValue(this.result)
                    .onChange((value) => {
                        this.result = value;
                    }));

        new Setting(contentEl)
            .addButton((btn) =>
                btn
                    .setButtonText("确定")
                    .setCta()
                    .onClick(() => {
                        this.close();
                        this.onSubmit(this.result);
                    }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
} 