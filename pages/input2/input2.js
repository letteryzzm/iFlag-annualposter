Page({
  data: {
    plans: [],
    templates: [
      {
        id: 1,
        name: '切尔西金',
        workflowId: '7457167011132342335'
      },
      {
        id: 2,
        name: '少女心粉',
        workflowId: '7457170112640237580'
      },
      {
        id: 3,
        name: '蒂芙尼绿',
        workflowId: '7457171368824946697'
      },
      {
        id: 4,
        name: '圣光白·磁光',
        workflowId: '7457170889567649829'
      }
    ],
    currentTemplate: null
  },

  onLoad(options) {
    const plans = JSON.parse(options.plans)
    this.setData({
      plans,
      currentTemplate: this.data.templates[0]
    })
  },

  onTemplateSelect(e) {
    const templateId = e.currentTarget.dataset.id
    const template = this.data.templates.find(t => t.id === templateId)
    this.setData({ currentTemplate: template })
  },

  onGenerate() {
    if (!this.data.currentTemplate) {
      wx.showToast({
        title: '请选择海报样式',
        icon: 'none'
      })
      return
    }

    const plans = this.data.plans.map(plan => plan.toString())
    
    console.log('准备传递的参数:', {
      plans,
      workflowId: this.data.currentTemplate.workflowId
    })

    wx.navigateTo({
      url: `/pages/output/output?plans=${encodeURIComponent(JSON.stringify(plans))}&workflowId=${this.data.currentTemplate.workflowId}`
    })
  }
}) 