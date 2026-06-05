/**
 * export.js - 数据导出模块前端逻辑
 * ========================================
 * 【层】表示层（Web 界面）
 * 【说明】提供数据导出功能，通过 GET /export 触发文件下载。
 *         暴露 handleExport() 供 app.js 调用。
 * 【负责人】Web 界面模块开发人员
 */

// ================================================================
// 暴露给 app.js 的接口
// ================================================================

/**
 * 触发数据文件下载。
 *
 * 通过 GET /export?dataset_id=xxx&format=csv 获取文件流并触发浏览器下载。
 *
 * @param {string} datasetId - 当前数据集 ID
 * @param {string} format - 导出格式 "csv" | "xlsx"
 */
function handleExport(datasetId, format) {
  if (!datasetId) {
    alert("没有可导出的数据");
    return;
  }

  format = format || "csv";

  // 创建隐藏的 a 标签触发下载（避免 fetch 方式下的文件名控制问题）
  var url = "/export?dataset_id=" + encodeURIComponent(datasetId) +
    "&format=" + encodeURIComponent(format);

  var a = document.createElement("a");
  a.href = url;
  a.download = "";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
