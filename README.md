# iFlag 微信小程序

iFlag 是一个制作年度 Flag 海报的微信小程序。用户选择或输入自己的 Flag，选择海报模板后，小程序会在本地 Canvas 中合成海报，并保存到历史记录或相册。

当前版本已经移除 Coze 服务依赖。图片生成不再调用外部工作流，而是使用小程序端 Canvas + CloudBase 云存储模板底图完成第一阶段能力。

## 当前技术栈

- 微信小程序原生开发：WXML、WXSS、JavaScript
- 微信云开发 / CloudBase：云函数、云存储、云数据库
- 本地兜底：`wx.getStorageSync`、`wx.setStorageSync`、`wx.saveFile`
- 海报生成：`wx.createCanvasContext`、`wx.canvasToTempFilePath`

云环境在 [app.js](app.js) 中初始化：

```js
wx.cloud.init({
  env: 'cloud1-d6gsqr214201333f5',
  traceUser: true
})
```

## 应用流程

1. 首页 [pages/index](pages/index/index.js) 进入生成流程。
2. Flag 输入页 [pages/input1](pages/input1/input1.js) 支持从预设 Flag 中选择，也支持手动输入自定义 Flag，最多选择 5 条。
3. 模板选择页 [pages/input2](pages/input2/input2.js) 展示 4 个模板预览图，用户选择模板后进入生成页。
4. 生成页 [pages/output](pages/output/output.js) 调用云函数获取模板底图临时链接，再用 Canvas 把模板底图、标题、模板名和 Flag 文案绘制成最终海报。
5. 生成完成后，海报会通过 `wx.saveFile` 保留本地文件，同时调用 `posterHistory` 云函数把海报上传到云存储，并写入云数据库历史记录。
6. 个人页 [pages/profile](pages/profile/profile.js) 优先从云端读取历史记录，云端不可用或为空时回落到本地历史，支持预览、保存到相册和删除。

## 1. 数据库怎么存？

当前版本已经使用 CloudBase 云数据库保存历史记录，不需要公司认证登录，也不需要 `wx.login + code2session + token`。小程序端调用云函数时，微信云开发会把当前用户身份透传给云函数，服务端通过 `cloud.getWXContext().OPENID` 取得用户标识。

云端历史由 [cloudfunctions/posterHistory](cloudfunctions/posterHistory/index.js) 管理：

- 数据库集合：`poster_history`
- 海报文件路径：`poster-history/{openid}/{timestamp}-{random}.png`
- 用户隔离：云函数读取 `OPENID` 后按 `openid` 字段查询、保存和删除
- 最大数量：每个用户保留最近 20 条，超出的旧记录会连同云存储文件一起清理
- 本地兜底：生成页仍写入 `flag_history`，云端保存失败时用户还能在本机看到历史

每条历史记录结构如下：

```js
{
  openid: '用户 openid',
  imageFileID: 'cloud://...',
  cloudPath: 'poster-history/openid/1783430000000-abc123.png',
  plans: ['每天读书', '坚持运动'],
  templateId: 1,
  templateName: '切尔西金',
  createdAt: 1783430000000,
  createTime: '2026/7/7 20:35:45'
}
```

个人页读取历史时，云函数会用 `imageFileID` 换取临时访问链接并返回给前端展示。删除云端记录时，会先删除数据库记录，再清理对应的云存储文件。

## 2. 前端是怎么制作的？

前端完全使用微信小程序原生页面，没有 React/Vue/Taro 等框架。

页面职责如下：

- [pages/index](pages/index/index.js)：入口页，点击开始进入 Flag 选择。
- [pages/input1](pages/input1/input1.js)：Flag 选择与自定义输入。预设内容在页面 JS 中维护，选中结果通过 URL 参数传给下一页。
- [pages/input2](pages/input2/input2.js)：模板选择。页面用本地压缩版 `/images/template1.png` 到 `/images/template4.png` 做预览，避免主包过大。
- [pages/output](pages/output/output.js)：海报生成、保存到相册、写入本地兜底历史，并调用云函数保存云端历史。
- [pages/profile](pages/profile/profile.js)：云端历史记录列表、图片预览、保存和删除；云端不可用时回落到本地历史。

前端路由通过 `wx.navigateTo` 串起生成流程，通过 `wx.switchTab` 回到首页。底部 Tab 在 [app.json](app.json) 中配置，包含“生成”和“我的”两个入口。

## 3. 图片是怎么生成的？

图片生成分两层：云端只负责提供模板底图，小程序端负责真正合成海报。

### 模板底图

模板底图的原图已经上传到 CloudBase 云存储：

```text
poster-templates/template1.png
poster-templates/template2.png
poster-templates/template3.png
poster-templates/template4.png
```

本地 `/images/template1.png` 到 `/images/template4.png` 只用于模板选择页预览，已经压缩过，目的是解决微信开发者工具预览时主包超过 2MB 的限制。

### 云函数

云函数 [cloudfunctions/generatePoster](cloudfunctions/generatePoster/index.js) 不再调用 Coze。它只接收 `templateId`，根据模板 ID 找到 CloudBase 云存储 fileID，并通过 `cloud.getTempFileURL` 返回临时访问链接。

返回结构示例：

```js
{
  success: true,
  data: {
    templateId: 1,
    fileID: 'cloud://...',
    tempFileURL: 'https://...'
  }
}
```

### 小程序端合成

[pages/output/output.js](pages/output/output.js) 中的生成流程：

1. 调用 `wx.cloud.callFunction({ name: 'generatePoster', data: { templateId } })` 获取模板临时链接。
2. 使用 `wx.getImageInfo` 下载并取得模板图片尺寸。
3. 设置隐藏 Canvas 尺寸。
4. 使用 `ctx.drawImage` 绘制模板底图。
5. 使用 Canvas API 绘制半透明文字面板、标题、模板名、编号和最多 5 条 Flag。
6. 调用 `wx.canvasToTempFilePath` 导出 PNG。
7. 调用 `wx.saveFile` 保存为本地文件，并写入本地兜底历史。
8. 读取本地 PNG 为 base64，调用 `posterHistory.save`，由云函数上传到云存储并写入 `poster_history`。

这套方案的特点是轻量、可控、无外部生成服务成本。当前适合“固定模板底图 + 用户文本合成”的第一阶段能力；如果后续要做 AI 图片生成，可以把云函数扩展成调用 CloudBase AI、第三方模型或自建服务，但前端的 Canvas 合成与云端历史流程可以继续复用。

## 云函数部署

在云环境 `cloud1-d6gsqr214201333f5` 下部署或更新云函数：

```bash
cd cloudfunctions/generatePoster
npm install --omit=dev
cloudbase fn code update generatePoster --env-id cloud1-d6gsqr214201333f5 --deployMode cos
```

`posterHistory` 需要把本地 `node_modules` 一起打包上传，避免 CloudBase 在线安装依赖时的构建差异。项目根目录的 [cloudbaserc.json](cloudbaserc.json) 已关闭该函数的云端在线安装依赖：

```bash
cd cloudfunctions/posterHistory
npm install --omit=dev
cd ../..
cloudbase fn deploy posterHistory --env-id cloud1-d6gsqr214201333f5 --deployMode cos
```

验证云函数：

```bash
cloudbase fn invoke generatePoster --env-id cloud1-d6gsqr214201333f5 -d '{"templateId":1}'
```

`posterHistory` 依赖小程序调用时自动注入的 `OPENID`。用 CLI 直接 invoke 时没有小程序用户上下文，返回“无法获取用户身份”是预期行为。

## 维护注意事项

- 不要把 `cloudfunctions/*/node_modules/` 提交到仓库，依赖通过 `package.json` 和 `package-lock.json` 管理。
- 新增模板时，需要同时处理两份资源：CloudBase 云存储中的高清底图，以及本地 `/images` 里的压缩预览图。
- 如果模板底图路径或云环境变化，需要同步更新 [cloudfunctions/generatePoster/index.js](cloudfunctions/generatePoster/index.js) 中的 `ENV_ID`、`BUCKET_ID` 和 `TEMPLATE_FILE_IDS`。
- 如果历史记录结构变化，需要同步更新 [cloudfunctions/posterHistory/index.js](cloudfunctions/posterHistory/index.js)、[pages/output/output.js](pages/output/output.js) 和 [pages/profile/profile.js](pages/profile/profile.js)。
