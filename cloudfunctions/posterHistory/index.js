const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const COLLECTION = 'poster_history'
const MAX_HISTORY = 20

function success(data) {
  return {
    success: true,
    data
  }
}

function failure(error) {
  return {
    success: false,
    error: {
      message: error.message || '云端历史操作失败'
    }
  }
}

function formatCreateTime(timestamp) {
  const date = new Date(timestamp + 8 * 60 * 60 * 1000)
  const pad = (value) => String(value).padStart(2, '0')

  return [
    date.getUTCFullYear(),
    '/',
    date.getUTCMonth() + 1,
    '/',
    date.getUTCDate(),
    ' ',
    pad(date.getUTCHours()),
    ':',
    pad(date.getUTCMinutes()),
    ':',
    pad(date.getUTCSeconds())
  ].join('')
}

function normalizeImageBase64(imageBase64) {
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    throw new Error('图片数据为空')
  }

  return imageBase64.replace(/^data:image\/\w+;base64,/, '')
}

async function getTempUrls(records) {
  const fileList = records.map((record) => record.imageFileID).filter(Boolean)

  if (!fileList.length) {
    return {}
  }

  const result = await cloud.getTempFileURL({ fileList })
  const urlMap = {}

  ;(result.fileList || []).forEach((file) => {
    if (file.status === 0 && file.tempFileURL) {
      urlMap[file.fileID] = file.tempFileURL
    }
  })

  return urlMap
}

async function cleanupOldRecords(openid) {
  const oldRecords = await db.collection(COLLECTION)
    .where({ openid })
    .orderBy('createdAt', 'desc')
    .skip(MAX_HISTORY)
    .limit(20)
    .get()

  if (!oldRecords.data.length) {
    return
  }

  const fileList = oldRecords.data.map((record) => record.imageFileID).filter(Boolean)

  if (fileList.length) {
    await cloud.deleteFile({ fileList }).catch((error) => {
      console.warn('清理旧海报文件失败:', error)
    })
  }

  await Promise.all(oldRecords.data.map((record) => (
    db.collection(COLLECTION).doc(record._id).remove()
  )))
}

async function saveHistory(event, openid) {
  const timestamp = Date.now()
  const imageBuffer = Buffer.from(normalizeImageBase64(event.imageBase64), 'base64')
  const cloudPath = `poster-history/${openid}/${timestamp}-${Math.random().toString(36).slice(2, 8)}.png`
  const uploadResult = await cloud.uploadFile({
    cloudPath,
    fileContent: imageBuffer
  })

  const record = {
    openid,
    imageFileID: uploadResult.fileID,
    cloudPath,
    plans: Array.isArray(event.plans) ? event.plans.slice(0, 5).map(String) : [],
    templateId: Number(event.templateId || 1),
    templateName: String(event.templateName || ''),
    createdAt: timestamp,
    createTime: formatCreateTime(timestamp)
  }
  const addResult = await db.collection(COLLECTION).add({
    data: record
  })

  await cleanupOldRecords(openid)

  return success({
    id: addResult._id,
    ...record
  })
}

async function listHistory(openid) {
  const result = await db.collection(COLLECTION)
    .where({ openid })
    .orderBy('createdAt', 'desc')
    .limit(MAX_HISTORY)
    .get()
  const urlMap = await getTempUrls(result.data)

  return success({
    history: result.data.map((record) => ({
      id: record._id,
      imageUrl: urlMap[record.imageFileID] || '',
      imageFileID: record.imageFileID,
      plans: record.plans || [],
      templateId: record.templateId,
      templateName: record.templateName,
      createTime: record.createTime,
      source: 'cloud'
    }))
  })
}

async function deleteHistory(event, openid) {
  const id = String(event.id || '')

  if (!id) {
    throw new Error('历史记录 ID 为空')
  }

  const recordResult = await db.collection(COLLECTION)
    .doc(id)
    .get()
  const record = recordResult.data

  if (!record || record.openid !== openid) {
    throw new Error('历史记录不存在')
  }

  await db.collection(COLLECTION).doc(id).remove()

  if (record.imageFileID) {
    await cloud.deleteFile({
      fileList: [record.imageFileID]
    }).catch((error) => {
      console.warn('删除海报文件失败:', error)
    })
  }

  return success({ id })
}

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  if (!openid) {
    return failure(new Error('无法获取用户身份'))
  }

  try {
    if (event.action === 'save') {
      return await saveHistory(event, openid)
    }

    if (event.action === 'list') {
      return await listHistory(openid)
    }

    if (event.action === 'delete') {
      return await deleteHistory(event, openid)
    }

    throw new Error('未知操作')
  } catch (error) {
    console.error('云端历史操作失败:', error)
    return failure(error)
  }
}
