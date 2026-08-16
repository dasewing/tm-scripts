# tm-scripts

个人 Tampermonkey 用户脚本集合。请使用 `scripts/` 下的 `.user.js` 文件安装。

## 脚本

### SeedHub：使用 `title` 替换种子链接文本

- 安装：[replace-a-innertext-with-title.user.js](./scripts/replace-a-innertext-with-title.user.js)
- 页面：`https://www.seedhub.cc/movies/{id}/`
- 范围：`.seed-list > ul > li > a[title]`

将匹配链接的 `innerText` 替换为其 `title` 属性值，并处理后续动态加载的内容。

### Bilibili：生成视频下载命令

- 安装：[bilibili-video-dl-url-maker.user.js](./scripts/bilibili-video-dl-url-maker.user.js)
- 页面：Bilibili 页面
- 用法：在控制台执行 `make_bl_download_scripts()`

提取 `.bili-cover-card` 链接，生成 `bbd <URL>` 命令并复制到剪贴板。

### 微信文章链接自动跳转

- 安装：[weixin-article-link-auto-redirector.user.js](./scripts/weixin-article-link-auto-redirector.user.js)
- 页面：虎嗅文章页、36Kr 文章页

自动查找页面中的微信公众号文章链接并跳转。

## 安装

安装 Tampermonkey 后，打开 `.user.js` 文件并在 Tampermonkey 编辑器中保存，或从 GitHub Release 下载对应脚本安装。

## 发布

每个版本通过 Git tag 发布。当前版本：`v1.1.1`。
