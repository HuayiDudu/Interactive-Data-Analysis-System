/**
 * upload.js - 数据管理模块前端逻辑
 * =====================================
 * 【负责人】数据管理模块开发人员
 * 【依赖】无外部依赖，仅调用 /upload 和 /export API
 *
 * 暴露给 Web 界面模块的接口:
 *   - handleUpload(file)    → 上传文件，返回 data 对象
 *   - renderPreview(data)   → 渲染数据预览表格
 *   - handleExport(id, fmt) → 导出数据文件
 *
 * 【实现要求】
 * - 仅调用控制层 HTTP API，不直接操作后端
 * - 上传使用 FormData/multipart，导出构造 URL 跳转
 * - 所有错误通过 throw Error 传递，由 Web 界面模块统一处理
 */

// ================================================================
// 1. 文件上传
// ================================================================

/**
 * 上传文件到服务器。
 *
 * @param {File} file - 用户选择的文件对象
 * @returns {Promise<object>} 上传成功后的 data 对象
 *   { dataset_id, columns, preview, shape, dtypes }
 * @throws {Error} 上传失败时抛出，消息为后端返回的 message
 *
 * 【实现步骤】
 * 1. 构造 FormData，文件字段名为 "file"
 * 2. POST /upload（Content-Type 由浏览器自动设为 multipart/form-data）
 * 3. 解析 JSON 响应
 * 4. 如果 status === "error"，throw new Error(message)
 * 5. 如果 status === "success"，return result.data
 */
async function handleUpload(file) {
    // ================================================================
    // 【待实现】
    // 提示: 不要设置 Content-Type header，浏览器会为 FormData 自动设置
    // ================================================================
    throw new Error("handleUpload 未实现");
}

// ================================================================
// 2. 数据预览渲染
// ================================================================

/**
 * 根据上传返回的数据渲染预览表格。
 *
 * @param {object} data - { columns, preview, shape, dtypes }
 *
 * 【实现步骤】
 * 1. 填充 #dataset-info: 显示 "100 行 × 5 列" 格式
 * 2. 填充 #preview-header: 一行 <tr>，每个列名一个 <th>
 * 3. 填充 #preview-body: 遍历 data.preview 每行创建 <tr>
 * 4. 每列数据类型可以鼠标悬停显示（title 属性）
 */
function renderPreview(data) {
    // ================================================================
    // 【待实现】
    // ================================================================
}

// ================================================================
// 3. 数据导出
// ================================================================

/**
 * 导出指定数据集为文件。
 *
 * @param {string} datasetId - 数据集 ID
 * @param {string} format - 导出格式 ("csv" | "xlsx")
 *
 * 【实现步骤】
 * 直接在浏览器打开 /export?dataset_id=xxx&format=xxx
 * 后端会返回 Content-Disposition: attachment 触发下载
 */
function handleExport(datasetId, format) {
    // ================================================================
    // 【待实现】
    // window.open 或 document.location.href
    // ================================================================
}
