function isRemoteUrl(url) {
  return /^https?:\/\//i.test(url)
}

Page({
  data: {
    history: [],
    isLoading: true
  },

  onShow() {
    this.loadHistory()
  },

  async loadHistory() {
    this.setData({ isLoading: true })

    try {
      const cloudHistory = await this.loadCloudHistory()
      const localHistory = this.loadLocalHistory()

      this.setData({
        history: cloudHistory.length ? cloudHistory : localHistory,
        isLoading: false
      })
    } catch (error) {
      console.error('加载云端历史记录失败，使用本地历史:', error)
      this.setData({
        history: this.loadLocalHistory(),
        isLoading: false
      })
    }
  },

  async loadCloudHistory() {
    const result = await wx.cloud.callFunction({
      name: 'posterHistory',
      data: {
        action: 'list'
      }
    })

    if (!result.result || !result.result.success) {
      throw new Error(result.result?.error?.message || '加载云端历史失败')
    }

    return result.result.data.history || []
  },

  loadLocalHistory() {
    try {
      return wx.getStorageSync('flag_history') || []
    } catch (error) {
      console.error('加载本地历史记录失败:', error)
      return []
    }
  },

  // 预览图片
  onPreview(e) {
    const { url } = e.currentTarget.dataset

    if (!url) {
      wx.showToast({
        title: '图片暂不可用',
        icon: 'none'
      })
      return
    }

    wx.previewImage({
      urls: [url],
      current: url,
      showmenu: true
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

  removeSavedFile(filePath) {
    if (!filePath || isRemoteUrl(filePath)) {
      return
    }

    wx.removeSavedFile({
      filePath,
      fail: () => {}
    })
  },

  // 下载图片
  async onDownload(e) {
    const { imageUrl } = e.currentTarget.dataset

    if (!imageUrl) {
      wx.showToast({
        title: '图片暂不可用',
        icon: 'none'
      })
      return
    }

    try {
      wx.showLoading({ title: '下载中...' })

      const filePath = await this.resolveAlbumFilePath(imageUrl)
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

  async deleteCloudHistory(record) {
    const result = await wx.cloud.callFunction({
      name: 'posterHistory',
      data: {
        action: 'delete',
        id: record.id
      }
    })

    if (!result.result || !result.result.success) {
      throw new Error(result.result?.error?.message || '删除云端历史失败')
    }
  },

  deleteLocalHistory(index) {
    const history = this.loadLocalHistory()
    const removedRecord = history[index]

    history.splice(index, 1)
    wx.setStorageSync('flag_history', history)
    this.removeSavedFile(removedRecord && removedRecord.imageUrl)

    return history
  },

  // 删除记录
  onDelete(e) {
    const { index } = e.currentTarget.dataset

    wx.showModal({
      title: '提示',
      content: '确定要删除这条记录吗？',
      success: async (res) => {
        if (!res.confirm) {
          return
        }

        const history = [...this.data.history]
        const removedRecord = history[index]

        try {
          if (removedRecord && removedRecord.source === 'cloud') {
            await this.deleteCloudHistory(removedRecord)
            history.splice(index, 1)
            this.setData({ history })
          } else {
            this.setData({ history: this.deleteLocalHistory(index) })
          }

          wx.showToast({
            title: '删除成功',
            icon: 'success'
          })
        } catch (error) {
          console.error('删除记录失败:', error)
          wx.showToast({
            title: '删除失败',
            icon: 'none'
          })
        }
      }
    })
  }
})
