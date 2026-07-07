# iFlag 微信小程序

iFlag 是一个制作年度 Flag 海报的微信小程序。用户选择或输入自己的 Flag，选择海报模板后，小程序会在本地 Canvas 中合成海报，并保存到历史记录或相册。

当前版本已经移除 Coze 服务依赖。图片生成不再调用外部工作流，而是使用小程序端 Canvas + CloudBase 云存储模板底图完成第一阶段能力。

## 当前技术栈

- 微信小程序原生开发：WXML、WXSS、JavaScript
- 微信云开发 / CloudBase：云函数、云存储
- 本地数据：`wx.getStorageSync`、`wx.setStorageSync`、`wx.saveFile`
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
5. 生成完成后，海报会通过 `wx.saveFile` 尽量保存为小程序本地文件，并写入本地历史记录。
6. 个人页 [pages/profile](pages/profile/profile.js) 从本地历史记录读取海报，支持预览、保存到相册和删除。

## 1. 数据库怎么存？

第一阶段没有使用 CloudBase 数据库，也没有额外的数据库管理服务。当前只有“本地历史记录”，存在微信小程序本地缓存里：

- 存储 key：`flag_history`
- 写入位置：[pages/output/output.js](pages/output/output.js) 的 `saveHistory`
- 读取位置：[pages/profile/profile.js](pages/profile/profile.js) 的 `loadHistory`
- 最大数量：保留最近 20 条

每条历史记录结构如下：

```js
{
  id: Date.now().toString(),
  imageUrl: 'wxfile://...', // wx.saveFile 后的本地文件路径，失败时为临时路径
  plans: ['每天读书', '坚持运动'],
  templateId: 1,
  templateName: '切尔西金',
  createTime: '2026/7/7 20:35:45'
}
```

这种方案的优点是轻量，不需要登录态绑定、数据库权限设计和后台管理；缺点是历史记录只在当前设备有效，用户清理小程序缓存或换设备后不会同步。

如果后续需要多端同步或后台统计，可以再加 CloudBase 数据库，例如新增 `poster_history` 集合，按 `_openid` 存用户记录：

```js
{
  _openid: '用户 openid',
  imageFileID: 'cloud://...',
  plans: ['...'],
  templateId: 1,
  templateName: '切尔西金',
  createdAt: Date
}
```

## 2. 前端是怎么制作的？

前端完全使用微信小程序原生页面，没有 React/Vue/Taro 等框架。

页面职责如下：

- [pages/index](pages/index/index.js)：入口页，点击开始进入 Flag 选择。
- [pages/input1](pages/input1/input1.js)：Flag 选择与自定义输入。预设内容在页面 JS 中维护，选中结果通过 URL 参数传给下一页。
- [pages/input2](pages/input2/input2.js)：模板选择。页面用本地压缩版 `/images/template1.png` 到 `/images/template4.png` 做预览，避免主包过大。
- [pages/output](pages/output/output.js)：海报生成、保存到相册、写入历史。
- [pages/profile](pages/profile/profile.js)：历史记录列表、图片预览、保存和删除。

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
7. 调用 `wx.saveFile` 保存为本地文件，并写入 `flag_history`。

这套方案的特点是轻量、可控、无外部生成服务成本。当前适合“固定模板底图 + 用户文本合成”的第一阶段能力；如果后续要做 AI 图片生成，可以把云函数扩展成调用 CloudBase AI、第三方模型或自建服务，但前端的 Canvas 合成与历史记录流程可以继续复用。

## 云函数部署

在云环境 `cloud1-d6gsqr214201333f5` 下部署或更新云函数：

```bash
cd cloudfunctions/generatePoster
npm install --omit=dev
cloudbase fn code update generatePoster --env-id cloud1-d6gsqr214201333f5 --deployMode cos
```

验证云函数：

```bash
cloudbase fn invoke generatePoster --env-id cloud1-d6gsqr214201333f5 -d '{"templateId":1}'
```

## 维护注意事项

- 不要把 `cloudfunctions/*/node_modules/` 提交到仓库，依赖通过 `package.json` 和 `package-lock.json` 管理。
- 新增模板时，需要同时处理两份资源：CloudBase 云存储中的高清底图，以及本地 `/images` 里的压缩预览图。
- 如果模板底图路径或云环境变化，需要同步更新 [cloudfunctions/generatePoster/index.js](cloudfunctions/generatePoster/index.js) 中的 `ENV_ID`、`BUCKET_ID` 和 `TEMPLATE_FILE_IDS`。
- 当前历史记录是本地缓存，不适合作为正式的跨设备用户数据来源。
