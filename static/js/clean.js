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
 */
function populateCleanOptions(columns) {
    var container = document.getElementById("missing-strategies");
    container.innerHTML = "";
    var stats = (typeof window._columnStats !== "undefined") ? window._columnStats : {};

    columns.forEach(function (col) {
        var row = document.createElement("div");
        row.className = "strategy-row";

        var nameSpan = document.createElement("span");
        nameSpan.className = "strategy-col-name";

        var colStat = stats[col] || {};
        var badges = [];

        // 缺失值标签
        if (colStat.missing > 0) {
            badges.push('<span class="col-badge col-badge-warn">缺 ' + colStat.missing + '</span>');
        } else {
            badges.push('<span class="col-badge col-badge-ok">完整</span>');
        }

        // 异常值标签（仅数值列）
        if (colStat.is_numeric && colStat.outliers > 0) {
            badges.push('<span class="col-badge col-badge-err">异常 ' + colStat.outliers + '</span>');
        }

        nameSpan.innerHTML = col + ' ' + badges.join(" ");

        var select = document.createElement("select");
        select.className = "strategy-select";
        select.dataset.column = col;
        // 有缺失值时默认建议均值填充
        var defaultSelected = colStat.missing > 0 ? ' selected' : '';
        select.innerHTML =
            '<option value="">不处理</option>' +
            '<option value="mean"' + (colStat.missing > 0 && colStat.is_numeric ? ' selected' : '') + '>均值填充</option>' +
            '<option value="median"' + (colStat.missing > 0 && colStat.is_numeric ? '' : '') + '>中位数填充</option>' +
            '<option value="drop"' + (colStat.missing > 0 ? '' : '') + '>删除行</option>';

        row.appendChild(nameSpan);
        row.appendChild(select);
        container.appendChild(row);
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
 */
function collectCleanParams() {
    var missing = {};
    var selects = document.querySelectorAll(".strategy-select");
    selects.forEach(function (select) {
        if (select.value) {
            missing[select.dataset.column] = select.value;
        }
    });

    var outlier = document.getElementById("outlier-method").value;

    return {
        missing: missing,
        outlier: outlier,
    };
}

// ================================================================
// 3. 执行清洗
// ================================================================

/**
 * 发送清洗请求并返回结果。
 */
async function handleClean(params) {
    var response = await fetch("/clean", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
    });
    var result = await response.json();
    if (result.status === "error") {
        throw new Error(result.message || "清洗失败");
    }
    return result.data;
}

// ================================================================
// 4. 清洗完成后更新列标签
// ================================================================

/**
 * 根据清洗报告更新策略行中每列的状态标签。
 * 将原来的"缺 N"标签替换为"已填充 N 个"等处理结果。
 *
 * @param {object} report - 清洗报告 { missing_handled, outliers_removed, ... }
 */
function updateCleanBadges(report) {
    var handled = (report && report.missing_handled) ? report.missing_handled : {};
    var stats = (typeof window._columnStats !== "undefined") ? window._columnStats : {};
    var selects = document.querySelectorAll(".strategy-select");
    selects.forEach(function (select) {
        var col = select.dataset.column;
        var row = select.closest(".strategy-row");
        if (!row) return;
        var nameSpan = row.querySelector(".strategy-col-name");
        if (!nameSpan) return;

        var resultText = handled[col];
        if (resultText) {
            // 有处理结果：绿色标签显示具体处理了什么
            nameSpan.innerHTML = col + ' <span class="col-badge col-badge-done">' + resultText + '</span>';
        } else {
            // 无处理：检查原始数据是否有问题
            var colStat = stats[col] || {};
            if (colStat.missing > 0) {
                // 有缺失值但策略选了"不处理"：灰色警告
                nameSpan.innerHTML = col + ' <span class="col-badge col-badge-none">跳过处理</span>';
            } else {
                // 原本就没有缺失值：绿色"正常"
                nameSpan.innerHTML = col + ' <span class="col-badge col-badge-done">正常</span>';
            }
        }
    });

    // 异常值处理标签（显示在 outlier-method 选择器旁边）
    if (report && report.outliers_removed > 0) {
        var outlierRow = document.querySelector(".outlier-result");
        if (!outlierRow) {
            var outlierSelect = document.getElementById("outlier-method");
            if (outlierSelect && outlierSelect.parentNode) {
                outlierRow = document.createElement("span");
                outlierRow.className = "outlier-result";
                outlierSelect.parentNode.appendChild(outlierRow);
            }
        }
        if (outlierRow) {
            outlierRow.innerHTML = ' <span class="col-badge col-badge-done">已移除 ' + report.outliers_removed + ' 个异常值</span>';
            outlierRow.style.display = "inline-flex";
        }
    }
}
