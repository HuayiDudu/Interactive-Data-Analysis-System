/**
 * app.js - Web界面主控逻辑（集成各模块）
 * ==============================================
 * 【层】表示层（Web 界面）
 * 【说明】前端主控文件，负责全局状态管理、步骤控制、错误处理,
 *        以及调用各模块（upload/clean/plot/analyze）暴露的函数。
 *
 * 【负责人】Web界面模块开发人员
 *
 * 【依赖关系】
 *   本文件调用以下模块 JS 文件暴露的函数:
 *   - upload.js:   handleUpload(file), renderPreview(data), handleExport(id, fmt)
 *   - clean.js:    populateCleanOptions(columns), collectCleanParams(), handleClean(params)
 *   - plot.js:     populatePlotColumns(columns), handlePlot(datasetId)
 *   - analyze.js:  populateAlgorithmParams(algorithm), handleAnalyze(datasetId)
 *
 *   ⚠ 请勿在此文件中实现其他模块的具体业务逻辑
 *   ⚠ 请勿修改 upload.js / clean.js / plot.js / analyze.js
 */

// ================================================================
// 全局状态
// ================================================================
/** 当前操作的数据集 ID（上传后设置，每次清洗/分析操作后更新） */
let currentDatasetId = null;

/** 当前数据集的列名列表 */
let currentColumns = [];

// ================================================================
// DOM 元素缓存
// ================================================================
const fileInput = document.getElementById("file-input");
const btnUpload = document.getElementById("btn-upload");
const uploadProgress = document.getElementById("upload-progress");
const errorToast = document.getElementById("error-toast");

// ================================================================
// 工具函数（Web界面模块实现）
// ================================================================

/**
 * 显示错误信息（红色提示条，5秒自动消失）。
 * @param {string} message - 错误信息
 */
function showError(message) {
    console.error(message);
    if (errorToast) {
        errorToast.textContent = message;
        errorToast.classList.remove("d-none");
        setTimeout(() => errorToast.classList.add("d-none"), 5000);
    } else {
        alert(message);
    }
}

/**
 * 发送 POST 请求（JSON 格式）。
 * @param {string} url
 * @param {object} data
 * @returns {Promise<object>}
 */
async function postJSON(url, data) {
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    return response.json();
}

// ================================================================
// 步骤控制（Web界面模块实现）
// ================================================================

/**
 * 上传成功后启用所有后续步骤。
 * @param {object} data - 上传接口返回的数据
 */
function onUploadSuccess(data) {
    // 更新全局状态
    currentDatasetId = data.dataset_id;
    currentColumns = data.columns;

    // 隐藏上传进度
    uploadProgress.style.display = "none";
    btnUpload.disabled = false;

    // 渲染预览表格（调用 upload.js）
    renderPreview(data);

    // 显示后续所有步骤
    document.getElementById("step-preview").style.display = "block";
    document.getElementById("step-clean").style.display = "block";
    document.getElementById("step-visualize").style.display = "block";
    document.getElementById("step-analyze").style.display = "block";
    document.getElementById("step-export").style.display = "block";

    // 初始化各模块的参数配置
    if (typeof populateCleanOptions === "function") {
        populateCleanOptions(data.columns);
    }
    if (typeof populatePlotColumns === "function") {
        populatePlotColumns(data.columns);
    }
}

// ================================================================
// 1. 文件上传（调用 upload.js）
// ================================================================

fileInput.addEventListener("change", function () {
    btnUpload.disabled = !this.files.length;
});

btnUpload.addEventListener("click", async function () {
    const file = fileInput.files[0];
    if (!file) return;

    uploadProgress.style.display = "block";
    btnUpload.disabled = true;

    try {
        const data = await handleUpload(file);
        onUploadSuccess(data);
    } catch (err) {
        uploadProgress.style.display = "none";
        btnUpload.disabled = false;
        showError("上传失败: " + err.message);
    }
});

// ================================================================
// 3. 数据清洗（调用 clean.js）
// ================================================================

document.getElementById("btn-clean").addEventListener("click", async function () {
    if (!currentDatasetId) {
        showError("请先上传数据");
        return;
    }

    const params = collectCleanParams();
    params.dataset_id = currentDatasetId;

    try {
        const result = await handleClean(params);
        // 更新全局状态（清洗生成了新的数据集）
        currentDatasetId = result.dataset_id;

        // 更新预览（使用新数据集的 preview）
        const previewData = {
            columns: currentColumns,  // 列名通常不变
            preview: result.preview,
            shape: null,               // shape 未返回则标注
        };
        renderPreview(previewData);

        // 显示清洗报告
        const reportDiv = document.getElementById("clean-report");
        reportDiv.style.display = "block";
        document.getElementById("clean-report-content").textContent =
            JSON.stringify(result.report, null, 2);
    } catch (err) {
        showError("清洗失败: " + err.message);
    }
});

// ================================================================
// 4. 可视化（调用 plot.js）
// ================================================================

document.getElementById("btn-plot").addEventListener("click", async function () {
    if (!currentDatasetId) {
        showError("请先上传数据");
        return;
    }

    try {
        await handlePlot(currentDatasetId);
    } catch (err) {
        showError("生成图表失败: " + err.message);
    }
});

// ================================================================
// 5. 分析（调用 analyze.js）
// ================================================================

document.getElementById("algorithm-type").addEventListener("change", function () {
    if (typeof populateAlgorithmParams === "function") {
        populateAlgorithmParams(this.value);
    }
});

document.getElementById("btn-analyze").addEventListener("click", async function () {
    if (!currentDatasetId) {
        showError("请先上传数据");
        return;
    }

    try {
        await handleAnalyze(currentDatasetId);
    } catch (err) {
        showError("分析失败: " + err.message);
    }
});

// ================================================================
// 6. 导出（调用 upload.js 的 handleExport）
// ================================================================

document.getElementById("btn-export-csv").addEventListener("click", function (e) {
    e.preventDefault();
    if (!currentDatasetId) {
        showError("没有可导出的数据");
        return;
    }
    handleExport(currentDatasetId, "csv");
});

document.getElementById("btn-export-xlsx").addEventListener("click", function (e) {
    e.preventDefault();
    if (!currentDatasetId) {
        showError("没有可导出的数据");
        return;
    }
    handleExport(currentDatasetId, "xlsx");
});

// ================================================================
// 初始化
// ================================================================
document.addEventListener("DOMContentLoaded", function () {
    console.log("交互式数据分析系统已加载");
    // 【待实现：Web界面模块】可在此添加页面初始化逻辑
});
