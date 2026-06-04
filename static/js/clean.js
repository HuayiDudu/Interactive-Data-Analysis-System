/**
 * clean.js - 数据清洗模块前端逻辑
 * =====================================
 * 【负责人】数据清洗模块开发人员
 * 【依赖】无外部依赖，仅调用 /clean API
 *
 * 暴露给 Web 界面模块的接口:
 *   - populateCleanOptions(columns) → 生成每列的缺失值策略下拉框
 *   - collectCleanParams()          → 收集清洗参数
 *   - handleClean(params)          → 执行清洗并返回结果
 *
 * 【实现要求】
 * - 仅调用控制层 HTTP API (/clean)
 * - 清洗参数格式: { dataset_id, missing: {列名: 策略}, outlier: "iqr" | "" }
 */

// ================================================================
// 1. 清洗参数配置
// ================================================================

/**
 * 为数据集的每一列生成缺失值策略下拉框。
 *
 * @param {string[]} columns - 所有列名
 *
 * 【实现步骤】
 * 1. 获取 #missing-strategies 容器
 * 2. 遍历 columns，为每列创建一行:
 *    - 左侧: 列名 badge
 *    - 右侧: <select> 下拉框，选项: 不处理 / 均值填充 / 中位数填充 / 删除行
 *    值为: "" / "mean" / "median" / "drop"
 * 3. 追加到容器中
 */
function populateCleanOptions(columns) {
    const container = document.getElementById("missing-strategies");
    container.innerHTML = "";

    columns.forEach(function (col) {
        var div = document.createElement("div");
        div.className = "row mb-2 align-items-center";
        div.innerHTML =
            '<div class="col-3">' +
            '<span class="badge bg-secondary">' + col + '</span>' +
            '</div>' +
            '<div class="col-9">' +
            '<select class="form-select form-select-sm strategy-select" ' +
            'data-col="' + col + '">' +
            '<option value="">不处理</option>' +
            '<option value="mean">均值填充</option>' +
            '<option value="median">中位数填充</option>' +
            '<option value="drop">删除行</option>' +
            '</select>' +
            '</div>';
        container.appendChild(div);
    });
}

// ================================================================
// 2. 收集清洗参数
// ================================================================

/**
 * 从页面中收集用户配置的清洗参数。
 *
 * @returns {object} 清洗参数
 *   { missing: {列名: 策略}, outlier: "iqr" | "" }
 *
 * 【实现步骤】
 * 1. 遍历所有 .strategy-select 下拉框，收集非空的策略
 * 2. 获取 #outlier-method 的值
 */
function collectCleanParams() {
    var missing = {};
    var selects = document.querySelectorAll(".strategy-select");

    selects.forEach(function (select) {
        if (select.value) {
            missing[select.dataset.col] = select.value;
        }
    });

    var outlier = document.getElementById("outlier-method").value;

    return { missing: missing, outlier: outlier };
}

// ================================================================
// 3. 执行清洗
// ================================================================

/**
 * 发送清洗请求并返回结果。
 *
 * @param {object} params - { dataset_id, missing, outlier }
 * @returns {Promise<object>} { dataset_id, preview, shape, report }
 * @throws {Error} 清洗失败时抛出
 *
 * 【实现步骤】
 * 1. POST /clean，请求体为 params 的 JSON
 * 2. 解析响应
 * 3. status === "error" 时 throw
 * 4. 返回 result.data
 */
async function handleClean(params) {
    var response = await fetch("/clean", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
    });

    var result = await response.json();

    if (result.status === "error") {
        throw new Error(result.message);
    }

    return result.data;
}
