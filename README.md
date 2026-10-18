# 电商图片助手（Chrome 扩展）

在淘宝 / 天猫、京东、拼多多（含商家后台）的商品详情页一键抓取全部商品图片，在独立画廊页里挑选后统一保存为 PNG。

## 功能

- 商品详情页右下角注入悬浮按钮「获取图片」，样式封装在 Shadow DOM 中，不污染原页面。
- 自动分段滚动页面触发懒加载，抓取主图、轮播图、详情长图，并补充网络请求中出现过的图片。
- 新标签页打开画廊：缩略图网格、逐张勾选、全选、反选、清空、键盘快捷键。
- 下载前统一转换为 PNG（`fetch` → `createImageBitmap` → `OffscreenCanvas` → PNG），按 `电商图片/平台/商品标题/序号.png` 归档。
- 下载队列并发 3 张，显示进度，支持取消与失败重试。
- 采集结果保存在 `chrome.storage.session`，重新打开画廊仍可看到最近一次结果。
- 浅色 / 深色主题自适应。

## 安装

1. 打开 Chrome，地址栏输入 `chrome://extensions`。
2. 打开右上角「开发者模式」。
3. 点击「加载已解压的扩展程序」，选择本项目根目录（包含 `manifest.json` 的目录）。
4. 打开受支持的商品详情页，右下角出现「获取图片」按钮即可使用。

图标由 `tools/make-icons.ps1` 生成；如需重新生成，在 PowerShell 中执行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\make-icons.ps1
```

## 支持的页面

| 平台 | 页面 |
| --- | --- |
| 淘宝 / 天猫 | `item.taobao.com/item.htm`、`detail.tmall.com/item.htm`、`chaoshi.detail.tmall.com`、`detail.tmall.hk`、`world.taobao.com/item/*` |
| 京东 | `item.jd.com/<id>.html`、`item.jd.hk`、`npcitem.jd.hk` |
| 拼多多 | `mobile.yangkeduo.com/goods*.html` |
| 拼多多商家版 | `mms.pinduoduo.com` 下含 `goods` / `detail` / `edit` 的页面 |

## 权限说明

| 权限 | 用途 |
| --- | --- |
| `downloads` | 保存转换后的 PNG 到本地 |
| `storage` | 用 `chrome.storage.session` 在内容脚本与画廊页之间传递采集结果 |
| `host_permissions`（各站点与图片 CDN） | 在扩展页面里 `fetch` 商品图片并转换为 PNG；内容脚本注入到详情页 |

扩展不申请 `tabs`、`scripting` 等额外权限，也不加载任何远程代码。

## 目录结构

```
manifest.json
src/
  background/service-worker.js   消息路由、结果暂存、打开画廊
  content/
    namespace.js                 站点配置、URL 与 DOM 工具、适配器注册
    adapters/generic.js          通用 img / 背景图 / canvas 扫描
    adapters/taobao.js           淘宝 / 天猫选择器与原图还原
    adapters/jd.js               京东选择器与原图还原
    adapters/pdd.js              拼多多 / 商家后台选择器与原图还原
    collector.js                 懒加载预热、合并、去重、过滤、排序
    ui.js                        Shadow DOM 悬浮按钮与 toast
    content.js                   入口、SPA 路由监听、采集流程
  gallery/
    gallery.html / gallery.css / gallery.js
assets/icons/                    16/32/48/128 图标
tools/make-icons.ps1             图标生成脚本
```

## 实现要点

- **通用扫描优先，平台适配器增强**：电商页面改版频繁，硬编码选择器随时会失效，因此通用 DOM 扫描是主力，平台选择器只用来提高主图/详情图的识别率。
- **原图还原**：淘宝 `xxx.jpg_430x430q90.jpg` 去掉尺寸后缀；京东 `/n1/s450x450_jfs/` 改成 `/n0/jfs/`；拼多多去掉 `?imageView2/...` 与 `.a.jpeg` 派生后缀。
- **去重**：以还原后的 URL（去查询串、小写）作为唯一键，同一张图的不同尺寸只保留一张。
- **PNG 转换**：扩展页面带 `host_permissions`，`fetch` 图片不受 CDN 跨域限制，再用 `OffscreenCanvas` 重绘并编码为 PNG；SVG 等 `createImageBitmap` 不支持的格式回退到 `<img>` + DOM canvas。
- **MV3 生命周期**：Service Worker 只做轻量路由，数据放 `storage.session`，不怕被休眠。

## 已知限制

- 需要登录或滑块验证的页面，若内容未加载完整，抓取结果会偏少。
- 个别 CDN 会校验 Referer 或签名，可能导致少数图片获取失败；画廊中会标记失败并提供「打开原图」入口，可手动保存。
- 浏览器会把 `canvas` 导出受跨域图片污染的画布跳过。
- 单次最多采集 500 张，避免页面过大时占用过多内存。

## 新增一个平台

1. 在 `src/content/namespace.js` 的 `SITE_LIST` 中增加站点：`test(url)` 判断详情页，`hosts` 填图片 CDN 域名。
2. 新建 `src/content/adapters/<id>.js`，调用 `E.registerAdapter(id, { collect, normalize, getTitle })`，并在 `manifest.json` 的 `content_scripts.js` 与 `host_permissions` 中补充。
3. 即使不加适配器，通用扫描也能工作，适配器只负责提升准确率。
