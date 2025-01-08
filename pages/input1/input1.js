Page({
  data: {
    // 将plans分成6组
    planGroups: [
      // 第一组
      [
        {id: 101, title: '学会投资理财', selected: false},
        {id: 102, title: '减少焦虑，活在当下', selected: false},
        {id: 103, title: '每顿少吃两口', selected: false},
        {id: 104, title: '每天背10个英语单词', selected: false},
        {id: 105, title: '少说多做', selected: false},
        {id: 106, title: '养成自律的习惯', selected: false},
        {id: 107, title: '一夜暴富!!!', selected: false},
        {id: 108, title: '比2024年过得好', selected: false}
      ],
      // 第二组
      [
        {id: 201, title: '每天少掉两根头发', selected: false},
        {id: 202, title: '再也不立Flag了', selected: false},
        {id: 203, title: '活在当下', selected: false},
        {id: 204, title: '社恐症状减轻', selected: false},
        {id: 205, title: '找到真正感兴趣的方向', selected: false},
        {id: 206, title: '不再容貌焦虑', selected: false},
        {id: 207, title: '不做舔狗', selected: false},
        {id: 208, title: '保持满满正能量', selected: false}
      ],
      // 第三组
      [
        {id: 301, title: '身材达到理想状态', selected: false},
        {id: 302, title: '用完一支口红再买新的', selected: false},
        {id: 303, title: '定期清理手机内存', selected: false},
        {id: 304, title: '每天记录一件开心的事', selected: false},
        {id: 305, title: '合理躺平', selected: false},
        {id: 306, title: '摄影技术变牛', selected: false},
        {id: 307, title: '少打两局游戏', selected: false}
      ],
      // 第四组
      [
        {id: 401, title: '染一个大胆的发色', selected: false},
        {id: 402, title: '练出完美腹肌', selected: false},
        {id: 403, title: '重视牙齿健康', selected: false},
        {id: 404, title: '每天擦身体乳', selected: false},
        {id: 405, title: '一定记得擦防晒霜', selected: false},
        {id: 406, title: '减少对手机的依赖', selected: false},
        {id: 407, title: '周末多出门走走', selected: false},
        {id: 408, title: '植发', selected: false},
        {id: 409, title: '瘦!十!斤!', selected: false}
      ],
      // 第五组
      [
        {id: 501, title: '存款超五位数', selected: false},
        {id: 502, title: '发展一项副业', selected: false},
        {id: 503, title: '坚持每周去健身', selected: false},
        {id: 504, title: '完成去年未完成的flag', selected: false},
        {id: 505, title: '坚持每天读书', selected: false},
        {id: 506, title: '不和别人做比较', selected: false},
        {id: 507, title: '保持完美', selected: false},
        {id: 508, title: '尝试滑雪', selected: false}
      ],
      // 第六组
      [
        {id: 601, title: '脱单!!!', selected: false},
        {id: 602, title: '每天12点前睡觉', selected: false},
        {id: 603, title: '不翘二郎腿', selected: false},
        {id: 604, title: '摆脱失眠', selected: false},
        {id: 605, title: '体检一切正常', selected: false},
        {id: 606, title: '四六级过过过', selected: false},
        {id: 607, title: '每天喝8杯水', selected: false},
        {id: 608, title: '定期断舍离', selected: false}
      ]
    ],
    selectedPlans: [],
    customPlan: '',
    touchStartX: 0,
    rowOffsets: [0, 0, 0, 0, 0, 0],
    isPaused: [false, false, false, false, false, false]
  },

  // 触摸开始
  touchStart(e) {
    const rowIndex = e.currentTarget.dataset.row;
    this.setData({
      touchStartX: e.touches[0].clientX,
      [`isPaused[${rowIndex}]`]: true
    });
  },

  // 触摸移动
  touchMove(e) {
    const rowIndex = e.currentTarget.dataset.row;
    const moveX = e.touches[0].clientX - this.data.touchStartX;
    const newOffset = this.data.rowOffsets[rowIndex] + moveX;
    
    this.setData({
      [`rowOffsets[${rowIndex}]`]: newOffset,
      touchStartX: e.touches[0].clientX
    });
  },

  // 触摸结束
  touchEnd(e) {
    const rowIndex = e.currentTarget.dataset.row;
    setTimeout(() => {
      this.setData({
        [`isPaused[${rowIndex}]`]: false,
        [`rowOffsets[${rowIndex}]`]: 0
      });
    }, 50);
  },

  onPlanSelect(e) {
    const plan = e.currentTarget.dataset.plan;
    const rowIndex = e.currentTarget.dataset.row;
    const plans = this.data.planGroups[rowIndex].map(p => {
      if (p.id === plan.id) {
        if (p.selected) {
          const index = this.data.selectedPlans.findIndex(sp => sp.id === p.id);
          if (index > -1) {
            this.data.selectedPlans.splice(index, 1);
          }
          return {...p, selected: false};
        } else if (this.data.selectedPlans.length < 5) {
          this.data.selectedPlans.push(p);
          return {...p, selected: true};
        } else {
          wx.showToast({
            title: '最多选择5个计划',
            icon: 'none'
          });
          return p;
        }
      }
      return p;
    });

    const newPlanGroups = [...this.data.planGroups];
    newPlanGroups[rowIndex] = plans;

    this.setData({ 
      planGroups: newPlanGroups,
      selectedPlans: this.data.selectedPlans
    });
  },

  onCustomInput(e) {
    this.setData({ customPlan: e.detail.value })
  },

  onAddCustomPlan() {
    if (!this.data.customPlan.trim()) return;
    
    if (this.data.selectedPlans.length >= 5) {
      wx.showToast({
        title: '最多选择5个计划',
        icon: 'none'
      });
      return;
    }

    const customPlan = {
      id: Date.now(),
      title: this.data.customPlan.trim(),
      isCustom: true,
      selected: true
    };

    this.setData({
      selectedPlans: [...this.data.selectedPlans, customPlan],
      customPlan: ''
    });

    wx.showToast({
      title: '已添加到计划',
      icon: 'success',
      duration: 1500
    });
  },

  onNext() {
    if (this.data.selectedPlans.length === 0) {
      wx.showToast({
        title: '请至少选择一个计划',
        icon: 'none'
      })
      return
    }

    const plans = this.data.selectedPlans.map(p => p.title)
    wx.navigateTo({
      url: `/pages/input2/input2?plans=${JSON.stringify(plans)}`
    })
  }
}) 