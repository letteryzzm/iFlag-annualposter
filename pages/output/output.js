Page({
  data: {
    imageUrl: '',
    loading: true,
    error: false
  },

  onLoad(options) {
    try {
      const plans = JSON.parse(decodeURIComponent(options.plans));
      const workflowId = options.workflowId;
      
      this.generatePoster(plans, workflowId);
    } catch (error) {
      console.error('参数解析错误:', error);
      this.setData({
        loading: false,
        error: true
      });
      wx.showToast({
        title: '参数错误',
        icon: 'none'
      });
    }
  },

  async generatePoster(plans, workflowId) {
    try {
      this.setData({ loading: true, error: false });

      const result = await wx.cloud.callFunction({
        name: 'generatePoster',
        data: {
          plans,
          workflowId
        }
      });

      console.log('云函数返回结果:', result);

      if (!result.result || !result.result.success) {
        throw new Error(result.result?.error?.message || '生成失败');
      }

      const imageUrl = result.result.data.imageUrl;
      if (!imageUrl) {
        throw new Error('未获取到图片地址');
      }

      console.log('图片URL:', imageUrl);

      this.setData({
        imageUrl: imageUrl,
        loading: false
      });

      // 自动保存到历史记录
      try {
        const history = wx.getStorageSync('flag_history') || [];
        const newRecord = {
          id: Date.now().toString(),
          imageUrl: imageUrl,
          createTime: new Date().toLocaleString()
        };
        
        history.unshift(newRecord);
        wx.setStorageSync('flag_history', history);
      } catch (error) {
        console.error('保存到历史记录失败:', error);
      }

    } catch (error) {
      console.error('生成海报错误:', error);
      this.setData({
        loading: false,
        error: true
      });
      wx.showToast({
        title: error.message || '生成失败，请重试',
        icon: 'none',
        duration: 2000
      });
    }
  },

  // 保存图片
  async onSave() {
    if (!this.data.imageUrl) return;

    try {
      // 获取用户授权
      const auth = await wx.authorize({
        scope: 'scope.writePhotosAlbum'
      }).catch(() => false);

      if (!auth) {
        wx.showModal({
          title: '提示',
          content: '需要您授权保存图片到相册',
          success: (res) => {
            if (res.confirm) {
              wx.openSetting();
            }
          }
        });
        return;
      }

      wx.showLoading({ title: '保存中...' });

      // 下载图片
      const downloadRes = await new Promise((resolve, reject) => {
        wx.downloadFile({
          url: this.data.imageUrl,
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

  // 保存到历史并跳转
  onViewHistory() {
    try {
      // 保存当前图片URL到历史记录
      const history = wx.getStorageSync('flag_history') || [];
      const newRecord = {
        id: Date.now().toString(),
        imageUrl: this.data.imageUrl,
        createTime: new Date().toLocaleString()
      };
      
      history.unshift(newRecord);
      wx.setStorageSync('flag_history', history);

      // 直接跳转，不等待
      wx.navigateTo({
        url: '/pages/profile/profile',
        success: () => {
          // 跳转成功后显示提示
          wx.showToast({
            title: '已保存到历史',
            icon: 'success'
          });
        }
      });

    } catch (error) {
      console.error('保存到历史记录失败:', error);
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      });
    }
  },

  // 回到首页
  onBackHome() {
    wx.switchTab({
      url: '/pages/index/index',
      fail: (error) => {
        console.error('跳转失败:', error);
        // 如果 switchTab 失败，尝试使用 reLaunch
        wx.reLaunch({
          url: '/pages/index/index'
        });
      }
    });
  }
}); 