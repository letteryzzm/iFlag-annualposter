const cloud = require('wx-server-sdk')
const axios = require('axios')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

exports.main = async (event, context) => {
  const { workflowId, plans } = event

  try {
    console.log('调用参数:', { workflowId, plans })

    const response = await axios({
      url: 'https://api.coze.cn/v1/workflow/run',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer pat_zJVkV7khjZaEPqwTJbEGvQUm3vJbX2msn3Mk0OVZ1CYr9ZNrHbxGG1P371yCEIpe',
        'Content-Type': 'application/json'
      },
      data: {
        "workflow_id": String(workflowId),
        "parameters": {
          "plan1": plans[0] || "",
          "plan2": plans[1] || "",
          "plan3": plans[2] || "",
          "plan4": plans[3] || "",
          "plan5": plans[4] || ""
        },
        "is_async": false
      }
    })

    console.log('API响应:', response.data)

    if (response.data.code === 0) {
      try {
        // 解析data字段中的JSON字符串
        const parsedData = JSON.parse(response.data.data);
        
        return {
          success: true,
          data: {
            imageUrl: parsedData.output,
            debug_url: response.data.debug_url
          }
        }
      } catch (error) {
        console.error('解析响应数据失败:', error);
        throw new Error('解析响应数据失败');
      }
    } else {
      throw new Error(response.data.msg || '工作流执行失败')
    }

  } catch (error) {
    console.error('云函数错误:', error)
    return {
      success: false,
      error: {
        message: error.message || '请求失败',
        details: error.response?.data || error.message
      }
    }
  }
} 