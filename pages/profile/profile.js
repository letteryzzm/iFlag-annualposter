Page({
  data: {
    history: [],
    isLoading: true
  },

  onShow() {
    this.loadHistory()
  },

  loadHistory() {
    this.setData({ isLoading: true })
    try {
      const history = wx.getStorageSync('flag_history') || []
      this.setData({ 
        history,
        isLoading: false
      })
    } catch (error) {
      console.error('加载历史记录失败:', error)
      this.setData({ isLoading: false })
    }
  },

  // 预览图片
  onPreview(e) {
    const { url } = e.currentTarget.dataset;
    wx.previewImage({
      urls: [url],
      current: url,
      showmenu: true
    });
  },

  // 下载图片
  async onDownload(e) {
    const { imageUrl } = e.currentTarget.dataset;
    
    try {
      wx.showLoading({ title: '下载中...' });
      
      // 下载图片
      const downloadRes = await new Promise((resolve, reject) => {
        wx.downloadFile({
          url: imageUrl,
          success: (res) => {
            if (res.statusCode === 200) {
              resolve(res);
            } else {
              reject(new Error(`下载失败: ${res.statusCode}`));
            }
          },
          fail: reject
        });
      });

      // 保存到相册
      await new Promise((resolve, reject) => {
        wx.saveImageToPhotosAlbum({
          filePath: downloadRes.tempFilePath,
          success: resolve,
          fail: reject
        });
      });

      wx.showToast({
        title: '保存成功',
        icon: 'success'
      });

    } catch (error) {
      console.error('保存图片错误:', error);
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 删除记录
  onDelete(e) {
    const { index } = e.currentTarget.dataset;
    
    wx.showModal({
      title: '提示',
      content: '确定要删除这条记录吗？',
      success: (res) => {
        if (res.confirm) {
          const history = [...this.data.history];
          history.splice(index, 1);
          
          try {
            wx.setStorageSync('flag_history', history);
            this.setData({ history });
            wx.showToast({
              title: '删除成功',
              icon: 'success'
            });
          } catch (error) {
            console.error('删除记录失败:', error);
            wx.showToast({
              title: '删除失败',
              icon: 'none'
            });
          }
        }
      }
    });
  }
}) 