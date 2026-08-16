# tm-scripts

个人 Tampermonkey 用户脚本集合。请使用 `scripts/` 下的 `.user.js` 文件安装。

## 脚本

### SeedHub：使用 `title` 替换种子链接文本

- 安装：[seedhub-a-innertext-title-replacer.user.js](https://raw.githubusercontent.com/dasewing/tm-scripts/main/scripts/seedhub-a-innertext-title-replacer.user.js)
- 页面：`https://www.seedhub.cc/movies/{id}/`
- 范围：`.seed-list > ul > li > a[title]`

将匹配链接的 `innerText` 替换为其 `title` 属性值，并处理后续动态加载的内容。

### Bilibili：生成视频下载命令

- 安装：[bilibili-video-dl-url-maker.user.js](https://raw.githubusercontent.com/dasewing/tm-scripts/main/scripts/bilibili-video-dl-url-maker.user.js)
- 页面：Bilibili 页面
- 用法：点击“复制视频链接”可复制全部 URL；点击“选择视频”可在弹层中多选视频后复制，也可以在控制台执行 `make_bl_download_scripts()`

提取 `.bili-cover-card` 链接，仅生成换行分隔的 URL 并复制到剪贴板，完成后显示记录数 Toast。选择弹层默认全选，并提供“全选/取消全选”按钮。

通用 UI 类源码位于 [`scripts/common/user-script-ui.js`](./scripts/common/user-script-ui.js)，发布版会将其内联到 `.user.js`，无需额外加载依赖。

### 微信文章链接自动跳转

- 安装：[weixin-article-link-auto-redirector.user.js](https://raw.githubusercontent.com/dasewing/tm-scripts/main/scripts/weixin-article-link-auto-redirector.user.js)
- 页面：虎嗅文章页、36Kr 文章页

自动查找页面中的微信公众号文章链接并跳转。

## 安装

安装 Tampermonkey 后，打开 `.user.js` 文件并在 Tampermonkey 编辑器中保存，或从 GitHub Release 下载对应脚本安装。

## 发布

每个版本通过 Git tag 发布。当前版本：`v1.2.0`。
