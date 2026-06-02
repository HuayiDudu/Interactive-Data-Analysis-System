/**
 * analyze.js - 分析功能模块前端逻辑
 * =======================================
 * 【负责人】分析功能模块开发人员
 * 【依赖】无外部依赖，仅调用 /analyze API
 *
 * 暴露给 Web 界面模块的接口:
 *   - populateAlgorithmParams(algorithm, columns) → 根据算法类型显示参数配置
 *   - handleAnalyze(datasetId)                    → 执行分析并返回结果
 *
 * 【实现要求】
 * - 仅调用控制层 HTTP API (/analyze)
 * - K-Means 参数: n_clusters（来自滑动条）
 * - 线性回归参数: feature_cols（多选）, target_col（单选）
 */

// ================================================================
// 1. 算法参数配置
// ================================================================

/**
 * 根据选择的算法类型显示对应的参数配置。
 *
 * @param {string} algorithm - "kmeans" | "linear_regression"
 * @param {string[]} columns - 所有列名（线性回归时用于填充特征列选择）
 */
function populateAlgorithmParams(algorithm, columns) {
    var kmeansParams = document.getElementById("kmeans-params");
    var lrParams = document.getElementById("lr-params");

    if (algorithm === "kmeans") {
        kmeansParams.style.display = "flex";
        lrParams.style.display = "none";
    } else if (algorithm === "linear_regression") {
        kmeansParams.style.display = "none";
        lrParams.style.display = "block";

        if (columns && columns.length > 0) {
            var featureSelect = document.getElementById("lr-feature-cols");
            var targetSelect = document.getElementById("lr-target-col");
            featureSelect.innerHTML = "";
            targetSelect.innerHTML = "";
            columns.forEach(function (col) {
                var featureOption = document.createElement("option");
                featureOption.value = col;
                featureOption.textContent = col;
                featureSelect.appendChild(featureOption);

                var targetOption = document.createElement("option");
                targetOption.value = col;
                targetOption.textContent = col;
                targetSelect.appendChild(targetOption);
            });
        }
    }
}

// ================================================================
// 2. 执行分析
// ================================================================

/**
 * 执行数据分析并返回结果。
 *
 * @param {string} datasetId - 当前数据集 ID
 * @returns {Promise<object>} 后端返回的分析结果 data 对象
 * @throws {Error} 分析失败时抛出
 */
async function handleAnalyze(datasetId) {
    var algorithm = document.getElementById("algorithm-type").value;
    var params = {
        dataset_id: datasetId,
        algorithm: algorithm,
    };

    if (algorithm === "kmeans") {
        params.n_clusters = parseInt(document.getElementById("k-slider").value);
    } else if (algorithm === "linear_regression") {
        var targetCol = document.getElementById("lr-target-col").value;
        if (!targetCol) {
            throw new Error("请选择目标列");
        }
        var selectedFeatures = Array.from(
            document.getElementById("lr-feature-cols").selectedOptions
        ).map(function (opt) { return opt.value; });
        if (selectedFeatures.length === 0) {
            throw new Error("请选择至少一个特征列");
        }
        params.feature_cols = selectedFeatures;
        params.target_col = targetCol;
    }

    var response = await fetch("/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
    });
    var result = await response.json();
    if (result.status === "error") {
        throw new Error(result.message || "分析失败");
    }

    showAnalyzeResult(result.data);
    return result.data;
}

/**
 * 在页面中渲染分析结果。
 *
 * @param {object} data - 分析结果数据
 */
function showAnalyzeResult(data) {
    var analyzeResult = document.getElementById("analyze-result");
    analyzeResult.style.display = "block";
    document.getElementById("analyze-result-content").textContent =
        JSON.stringify(data, null, 2);
}
