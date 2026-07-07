const POSTER_TEMPLATES = {
  1: {
    id: 1,
    name: '切尔西金',
    panelColor: 'rgba(255, 251, 220, 0.82)',
    textColor: '#2d2816',
    mutedColor: '#6d6137',
    accentColor: '#a57c00'
  },
  2: {
    id: 2,
    name: '少女心粉',
    panelColor: 'rgba(255, 246, 250, 0.82)',
    textColor: '#4d3340',
    mutedColor: '#8a5a70',
    accentColor: '#d985a3'
  },
  3: {
    id: 3,
    name: '蒂芙尼绿',
    panelColor: 'rgba(11, 20, 36, 0.68)',
    textColor: '#ffffff',
    mutedColor: '#d9f7ff',
    accentColor: '#82f1ff'
  },
  4: {
    id: 4,
    name: '圣光白·磁光',
    panelColor: 'rgba(8, 18, 38, 0.68)',
    textColor: '#ffffff',
    mutedColor: '#deecff',
    accentColor: '#d7ecff'
  }
}

function isRemoteUrl(url) {
  return /^https?:\/\//i.test(url)
}

Page({
  data: {
    imageUrl: '',
    loading: true,
    error: false,
    canvasWidth: 1,
    canvasHeight: 1
  },

  onLoad(options) {
    try {
      const plans = JSON.parse(decodeURIComponent(options.plans || '[]'))
      const templateId = Number(options.templateId || 1)

      this.generatePoster(plans, templateId)
    } catch (error) {
      console.error('参数解析错误:', error)
      this.setData({
        loading: false,
        error: true
      })
      wx.showToast({
        title: '参数错误',
        icon: 'none'
      })
    }
  },

  async generatePoster(plans, templateId) {
    try {
      this.setData({ loading: true, error: false })

      const template = POSTER_TEMPLATES[templateId] || POSTER_TEMPLATES[1]
      const imageInfo = await this.getTemplateImageInfo(template.id)

      await this.setCanvasSize(imageInfo.width, imageInfo.height)

      const tempFilePath = await this.drawPoster({
        template,
        plans,
        imagePath: imageInfo.path,
        width: imageInfo.width,
        height: imageInfo.height
      })
      const imageUrl = await this.savePosterFile(tempFilePath)

      this.setData({
        imageUrl,
        loading: false
      })

      await this.saveHistory({
        imageUrl,
        plans,
        template
      })
    } catch (error) {
      console.error('生成海报错误:', error)
      this.setData({
        loading: false,
        error: true
      })
      wx.showToast({
        title: error.message || '生成失败，请重试',
        icon: 'none',
        duration: 2000
      })
    }
  },

  async getTemplateImageInfo(templateId) {
    const result = await wx.cloud.callFunction({
      name: 'generatePoster',
      data: {
        templateId
      }
    })

    if (!result.result || !result.result.success) {
      throw new Error(result.result?.error?.message || '获取模板失败')
    }

    const tempFileURL = result.result.data && result.result.data.tempFileURL
    if (!tempFileURL) {
      throw new Error('模板链接为空')
    }

    return this.getImageInfo(tempFileURL)
  },

  getImageInfo(src) {
    return new Promise((resolve, reject) => {
      wx.getImageInfo({
        src,
        success: resolve,
        fail: reject
      })
    })
  },

  setCanvasSize(width, height) {
    return new Promise((resolve) => {
      this.setData({
        canvasWidth: width,
        canvasHeight: height
      }, resolve)
    })
  },

  drawPoster({ template, plans, imagePath, width, height }) {
    return new Promise((resolve, reject) => {
      const ctx = wx.createCanvasContext('posterCanvas', this)

      ctx.clearRect(0, 0, width, height)
      ctx.drawImage(imagePath, 0, 0, width, height)
      this.drawPosterText(ctx, {
        template,
        plans,
        width,
        height
      })

      ctx.draw(false, () => {
        wx.canvasToTempFilePath({
          canvasId: 'posterCanvas',
          x: 0,
          y: 0,
          width,
          height,
          destWidth: width,
          destHeight: height,
          fileType: 'png',
          quality: 1,
          success: (res) => resolve(res.tempFilePath),
          fail: reject
        }, this)
      })
    })
  },

  drawPosterText(ctx, { template, plans, width, height }) {
    const safePlans = plans.slice(0, 5).map((plan) => String(plan || '').trim()).filter(Boolean)
    const margin = Math.round(width * 0.08)
    const panelWidth = width - margin * 2
    const panelHeight = Math.round(height * 0.44)
    const panelTop = height - margin - panelHeight
    const radius = Math.round(width * 0.04)
    const padding = Math.round(width * 0.06)
    const base = Math.min(width, height * 0.56)
    const contentX = margin + padding
    const contentWidth = panelWidth - padding * 2
    const titleSize = Math.round(base * 0.07)
    const subtitleSize = Math.round(base * 0.028)
    const bodySize = Math.round(base * 0.043)
    const lineHeight = Math.round(bodySize * 1.45)

    ctx.setFillStyle(template.panelColor)
    this.drawRoundRect(ctx, margin, panelTop, panelWidth, panelHeight, radius)
    ctx.fill()

    ctx.setFillStyle(template.accentColor)
    this.drawRoundRect(ctx, contentX, panelTop + padding, Math.round(base * 0.18), Math.max(5, Math.round(base * 0.01)), 99)
    ctx.fill()

    ctx.setTextAlign('left')
    ctx.setTextBaseline('top')
    ctx.setFillStyle(template.textColor)
    ctx.setFontSize(titleSize)
    ctx.fillText('我的年度 Flag', contentX, panelTop + padding + Math.round(base * 0.035))

    ctx.setFillStyle(template.mutedColor)
    ctx.setFontSize(subtitleSize)
    ctx.fillText(`iFlag · ${template.name}`, contentX, panelTop + padding + Math.round(base * 0.13))

    let y = panelTop + padding + Math.round(base * 0.2)
    const numberWidth = Math.round(base * 0.075)
    const textX = contentX + numberWidth
    const maxTextWidth = contentWidth - numberWidth
    const maxLines = safePlans.length > 3 ? 1 : 2

    ctx.setFontSize(bodySize)
    safePlans.forEach((plan, index) => {
      const lines = this.wrapText(ctx, plan, maxTextWidth, maxLines)

      ctx.setFillStyle(template.accentColor)
      ctx.fillText(String(index + 1).padStart(2, '0'), contentX, y)

      ctx.setFillStyle(template.textColor)
      lines.forEach((line, lineIndex) => {
        ctx.fillText(line, textX, y + lineIndex * lineHeight)
      })

      y += lines.length * lineHeight + Math.round(bodySize * 0.55)
    })
  },

  drawRoundRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2)

    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + width - r, y)
    ctx.quadraticCurveTo(x + width, y, x + width, y + r)
    ctx.lineTo(x + width, y + height - r)
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
    ctx.lineTo(x + r, y + height)
    ctx.quadraticCurveTo(x, y + height, x, y + height - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
  },

  wrapText(ctx, text, maxWidth, maxLines) {
    const lines = []
    let line = ''

    for (let i = 0; i < text.length; i++) {
      const testLine = line + text[i]

      if (ctx.measureText(testLine).width > maxWidth && line) {
        lines.push(line)
        line = text[i]

        if (lines.length === maxLines) {
          lines[maxLines - 1] = this.truncateText(ctx, lines[maxLines - 1] + text.slice(i), maxWidth)
          return lines
        }
      } else {
        line = testLine
      }
    }

    if (line && lines.length < maxLines) {
      lines.push(line)
    }

    return lines
  },

  truncateText(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) {
      return text
    }

    let result = ''
    for (let i = 0; i < text.length; i++) {
      const next = result + text[i]
      if (ctx.measureText(`${next}...`).width > maxWidth) {
        break
      }
      result = next
    }

    return `${result}...`
  },

  savePosterFile(tempFilePath) {
    return new Promise((resolve) => {
      wx.saveFile({
        tempFilePath,
        success: (res) => resolve(res.savedFilePath),
        fail: () => resolve(tempFilePath)
      })
    })
  },

  readFileAsBase64(filePath) {
    return new Promise((resolve, reject) => {
      wx.getFileSystemManager().readFile({
        filePath,
        encoding: 'base64',
        success: (res) => resolve(res.data),
        fail: reject
      })
    })
  },

  async saveHistory({ imageUrl, plans, template }) {
    this.saveLocalHistory({
      imageUrl,
      plans,
      template
    })

    try {
      const imageBase64 = await this.readFileAsBase64(imageUrl)
      const result = await wx.cloud.callFunction({
        name: 'posterHistory',
        data: {
          action: 'save',
          imageBase64,
          plans,
          templateId: template.id,
          templateName: template.name
        }
      })

      if (!result.result || !result.result.success) {
        throw new Error(result.result?.error?.message || '云端历史保存失败')
      }
    } catch (error) {
      console.warn('云端历史保存失败，已保留本地历史:', error)
    }
  },

  saveLocalHistory({ imageUrl, plans, template }) {
    try {
      const history = wx.getStorageSync('flag_history') || []
      const newRecord = {
        id: Date.now().toString(),
        imageUrl,
        plans,
        templateId: template.id,
        templateName: template.name,
        createTime: new Date().toLocaleString(),
        source: 'local'
      }

      const nextHistory = [newRecord, ...history]
      const removedHistory = nextHistory.slice(20)

      removedHistory.forEach((record) => {
        this.removeSavedFile(record.imageUrl)
      })

      wx.setStorageSync('flag_history', nextHistory.slice(0, 20))
    } catch (error) {
      console.error('保存到历史记录失败:', error)
    }
  },

  removeSavedFile(filePath) {
    if (!filePath || isRemoteUrl(filePath)) {
      return
    }

    wx.removeSavedFile({
      filePath,
      fail: () => {}
    })
  },

  async resolveAlbumFilePath(imageUrl) {
    if (!isRemoteUrl(imageUrl)) {
      return imageUrl
    }

    const downloadRes = await new Promise((resolve, reject) => {
      wx.downloadFile({
        url: imageUrl,
        success: (res) => {
          if (res.statusCode === 200) {
            resolve(res)
          } else {
            reject(new Error(`下载失败: ${res.statusCode}`))
          }
        },
        fail: reject
      })
    })

    return downloadRes.tempFilePath
  },

  saveImageToAlbum(filePath) {
    return new Promise((resolve, reject) => {
      wx.saveImageToPhotosAlbum({
        filePath,
        success: resolve,
        fail: reject
      })
    })
  },

  async onSave() {
    if (!this.data.imageUrl) return

    try {
      const auth = await wx.authorize({
        scope: 'scope.writePhotosAlbum'
      }).catch(() => false)

      if (!auth) {
        wx.showModal({
          title: '提示',
          content: '需要您授权保存图片到相册',
          success: (res) => {
            if (res.confirm) {
              wx.openSetting()
            }
          }
        })
        return
      }

      wx.showLoading({ title: '保存中...' })

      const filePath = await this.resolveAlbumFilePath(this.data.imageUrl)
      await this.saveImageToAlbum(filePath)

      wx.showToast({
        title: '保存成功',
        icon: 'success'
      })
    } catch (error) {
      console.error('保存图片错误:', error)
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  },

  onImageError(error) {
    console.error('图片加载失败:', error)
    this.setData({
      error: true
    })
  },

  onBackHome() {
    wx.switchTab({
      url: '/pages/index/index',
      fail: (error) => {
        console.error('跳转失败:', error)
        wx.reLaunch({
          url: '/pages/index/index'
        })
      }
    })
  }
})
