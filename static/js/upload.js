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
 */
async function handleUpload(file) {
    var formData = new FormData();
    formData.append("file", file);
    var response = await fetch("/upload", {
        method: "POST",
        body: formData,
    });
    var result = await response.json();
    if (result.status === "error") {
        throw new Error(result.message || "上传失败");
    }
    return result.data;
}

// ================================================================
// 2. 数据预览渲染
// ================================================================

/**
 * 根据上传返回的数据渲染预览表格。
 *
 * @param {object} data - { columns, preview, shape, dtypes }
 */
function renderPreview(data) {
    var datasetInfo = document.getElementById("dataset-info");
    if (datasetInfo && data.shape) {
        datasetInfo.textContent = data.shape[0] + " 行 × " + data.shape[1] + " 列";
    }

    var header = document.getElementById("preview-header");
    header.innerHTML = "";
    if (data.columns) {
        var tr = document.createElement("tr");
        data.columns.forEach(function (col) {
            var th = document.createElement("th");
            th.textContent = col;
            if (data.dtypes && data.dtypes[col]) {
                th.title = "类型: " + data.dtypes[col];
            }
            tr.appendChild(th);
        });
        header.appendChild(tr);
    }

    var body = document.getElementById("preview-body");
    body.innerHTML = "";
    if (data.preview && data.preview.length > 0) {
        data.preview.forEach(function (row) {
            var tr = document.createElement("tr");
            row.forEach(function (cell) {
                var td = document.createElement("td");
                td.textContent = cell !== null && cell !== undefined ? String(cell) : "";
                tr.appendChild(td);
            });
            body.appendChild(tr);
        });
    }
}

// ================================================================
// 3. 数据导出
// ================================================================

/**
 * 导出指定数据集为文件。
 *
 * @param {string} datasetId - 数据集 ID
 * @param {string} format - 导出格式 ("csv" | "xlsx")
 */
function handleExport(datasetId, format) {
    window.open("/export?dataset_id=" + encodeURIComponent(datasetId) + "&format=" + format, "_blank");
}
