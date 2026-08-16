# tm-scripts

Tampermonkey userscripts.

## SeedHub：使用 `title` 替换种子链接文本

脚本位置：[`scripts/replace-a-innertext-with-title.user.js`](./scripts/replace-a-innertext-with-title.user.js)

适用页面：

```text
https://www.seedhub.cc/movies/{id}/
```

处理范围：

```css
.seed-list > ul > li > a[title]
```

脚本会将匹配链接的 `innerText` 替换为其 `title` 属性值，也会处理页面后续动态加载的内容。

## 安装

安装 Tampermonkey 后，打开脚本文件并在 Tampermonkey 编辑器中保存，或从 GitHub Release 下载 `.user.js` 文件安装。

脚本直链：

<https://raw.githubusercontent.com/dasewing/tm-scripts/main/scripts/replace-a-innertext-with-title.user.js>
