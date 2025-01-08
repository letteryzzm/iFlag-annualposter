Page({
  data: {
    title: 'iFlag',
    subtitle: '立下独属于你的flag'
  },

  onStart() {
    wx.navigateTo({
      url: '/pages/input1/input1'
    })
  }
}) 