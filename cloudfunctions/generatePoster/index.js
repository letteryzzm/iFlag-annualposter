const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const ENV_ID = 'cloud1-d6gsqr214201333f5'
const BUCKET_ID = '636c-cloud1-d6gsqr214201333f5-1330590926'

const TEMPLATE_FILE_IDS = {
  1: `cloud://${ENV_ID}.${BUCKET_ID}/poster-templates/template1.png`,
  2: `cloud://${ENV_ID}.${BUCKET_ID}/poster-templates/template2.png`,
  3: `cloud://${ENV_ID}.${BUCKET_ID}/poster-templates/template3.png`,
  4: `cloud://${ENV_ID}.${BUCKET_ID}/poster-templates/template4.png`
}

exports.main = async (event = {}) => {
  const templateId = Number(event.templateId || 1)
  const fileID = TEMPLATE_FILE_IDS[templateId] || TEMPLATE_FILE_IDS[1]

  try {
    const result = await cloud.getTempFileURL({
      fileList: [fileID]
    })
    const file = result.fileList && result.fileList[0]

    if (!file || file.status !== 0 || !file.tempFileURL) {
      throw new Error(file && file.errMsg ? file.errMsg : '获取模板临时链接失败')
    }

    return {
      success: true,
      data: {
        templateId,
        fileID,
        tempFileURL: file.tempFileURL
      }
    }
  } catch (error) {
    console.error('获取模板临时链接失败:', error)
    return {
      success: false,
      error: {
        message: error.message || '获取模板临时链接失败'
      }
    }
  }
}
