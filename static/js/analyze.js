/**
 * analyze.js - 分析功能模块前端逻辑
 * =======================================
 * 【层】表示层（Web 界面）
 * 【说明】提供数据分析的 UI 交互，仅调用控制层 HTTP API。
 *         暴露 populateAlgorithmParams() 和 handleAnalyze() 供 app.js 调用。
 *         支持统一分发路由 (POST /analyze) 和按算法独立路由两种方式。
 * 【负责人】分析功能模块开发人员
 */

// ================================================================
// 模块内部状态
// ================================================================
let _currentColumns = [];

// ================================================================
// 工具函数
// ================================================================

function _getDatasetId() {
    return window.currentDatasetId || null;
}

function _showError(containerId, msg) {
    var el = document.getElementById(containerId);
    if (el) el.innerHTML = '<div class="alert alert-danger">' + msg + '</div>';
}

function _showLoading(containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;
    el.style.display = "block";
    el.innerHTML =
        '<div class="text-center py-3">' +
        '  <div class="spinner-border text-primary"></div>' +
        '  <p class="mt-2 text-muted">分析中，请稍候…</p>' +
        '</div>';
}

async function _postJSON(url, payload) {
    var resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    var json = await resp.json();
    if (json.status !== "success") throw new Error(json.message);
    return json.data;
}

function _metricBadge(label, value, hint) {
    hint = hint || "";
    var display = (value === null || value === undefined) ? "暂无" : value;
    var hintHtml = hint
        ? '<small class="text-muted ms-2">' + hint + '</small>'
        : "";
    return '<li class="list-group-item d-flex justify-content-between align-items-center">' +
        '<span>' + label + hintHtml + '</span>' +
        '<span class="badge bg-primary rounded-pill">' + display + '</span>' +
        '</li>';
}

function _renderSummaryTable(summary, highlightKey) {
    highlightKey = highlightKey || "";
    if (!summary || summary.length === 0) {
        return '<p class="text-muted">无可用对比数据</p>';
    }
    var headers = Object.keys(summary[0]);
    var headerRow = headers.map(function (h) { return '<th>' + h + '</th>'; }).join("");
    var bodyRows = summary.map(function (row) {
        var isHighlight = highlightKey && row[highlightKey] === "✓";
        var rowClass = isHighlight ? "table-success fw-bold" : "";
        var cells = headers.map(function (h) { return '<td>' + (row[h] ?? "—") + '</td>'; }).join("");
        return '<tr class="' + rowClass + '">' + cells + '</tr>';
    }).join("");
    return '<table class="table table-sm table-bordered table-hover">' +
        '<thead class="table-light"><tr>' + headerRow + '</tr></thead>' +
        '<tbody>' + bodyRows + '</tbody></table>';
}

function _skippedColsWarning(skippedCols) {
    if (!skippedCols || skippedCols.length === 0) return "";
    return '<div class="alert alert-warning py-1 mb-2">' +
        '以下非数值列已被自动跳过：<strong>' + skippedCols.join("、") + '</strong>' +
        '</div>';
}

// ================================================================
// 渲染函数
// ================================================================

function _renderKmeansResult(data) {
    var counts = {};
    data.labels.forEach(function (l) { counts[l] = (counts[l] || 0) + 1; });

    var tableRows = data.centers.map(function (center, i) {
        var coord = center.map(function (v) { return v.toFixed(3); }).join(", ");
        return '<tr><td>' + i + '</td><td>' + (counts[i] || 0) + '</td><td>[' + coord + ']</td></tr>';
    }).join("");

    document.getElementById("analyze-result").innerHTML =
        '<h5>K-Means 聚类结果（K=' + data.n_clusters + '）</h5>' +
        _skippedColsWarning(data.skipped_cols) +
        '<ul class="list-group mb-3">' +
        _metricBadge("Inertia（误差平方和）", data.inertia, "越小越好") +
        _metricBadge("轮廓系数 Silhouette", data.silhouette_score, "越接近 1 越好") +
        _metricBadge("Davies-Bouldin 指数", data.davies_bouldin_score, "越小越好") +
        '</ul>' +
        '<table class="table table-sm table-bordered">' +
        '<thead><tr><th>簇编号</th><th>数据点数</th><th>中心坐标</th></tr></thead>' +
        '<tbody>' + tableRows + '</tbody></table>';
    document.getElementById("analyze-result").style.display = "block";
}

function _renderRegressionResult(data) {
    var equation;
    if (data.feature_cols && data.feature_cols.length > 1) {
        var terms = data.coefficients.map(function (c, i) { return c + " × " + data.feature_cols[i]; });
        equation = "Y = " + terms.join(" + ") + " + " + data.intercept;
    } else {
        var xName = (data.feature_cols && data.feature_cols[0]) || data.feature_col || "X";
        equation = "Y = " + data.coefficients[0] + " × " + xName + " + " + data.intercept;
    }
    equation = equation.replace(/\+\s*-/g, "- ");

    var coefItems = (data.feature_cols && data.feature_cols.length > 1)
        ? data.coefficients.map(function (c, i) {
            return _metricBadge("系数 " + data.feature_cols[i], c);
        }).join("")
        : _metricBadge("斜率 slope", data.coefficients[0]);

    document.getElementById("analyze-result").innerHTML =
        '<h5>线性回归结果</h5>' +
        '<p>回归方程：<code>' + equation + '</code></p>' +
        '<ul class="list-group mb-3">' +
        coefItems +
        _metricBadge("截距 intercept", data.intercept) +
        _metricBadge("R² 拟合优度", data.r_squared ?? data.r2_score, "越接近 1 越好") +
        _metricBadge("MAE 平均绝对误差", data.mae, "越小越好") +
        _metricBadge("RMSE 均方根误差", data.rmse, "越小越好") +
        '</ul>';
    document.getElementById("analyze-result").style.display = "block";
}

function _renderDbscanResult(data) {
    var counts = {};
    data.labels.forEach(function (l) { counts[l] = (counts[l] || 0) + 1; });
    var clusterRows = Object.entries(counts)
        .filter(function (e) { return e[0] !== "-1"; })
        .sort(function (a, b) { return Number(a[0]) - Number(b[0]); })
        .map(function (e) { return '<tr><td>' + e[0] + '</td><td>' + e[1] + '</td></tr>'; })
        .join("");

    document.getElementById("analyze-result").innerHTML =
        '<h5>DBSCAN 聚类结果</h5>' +
        _skippedColsWarning(data.skipped_cols) +
        '<p class="text-muted small">数据已标准化处理 | eps=' + data.eps + '，min_samples=' + data.min_samples + '</p>' +
        '<ul class="list-group mb-3">' +
        _metricBadge("发现簇数量", data.n_clusters) +
        _metricBadge("噪声点数量", data.n_noise, "label = -1 的点") +
        _metricBadge("轮廓系数 Silhouette", data.silhouette_score, "越接近 1 越好（仅含非噪声点）") +
        _metricBadge("Davies-Bouldin 指数", data.davies_bouldin_score, "越小越好") +
        '</ul>' +
        '<table class="table table-sm table-bordered">' +
        '<thead><tr><th>簇编号</th><th>数据点数</th></tr></thead>' +
        '<tbody>' + clusterRows + '</tbody></table>';
    document.getElementById("analyze-result").style.display = "block";
}

function _renderPolyRegressionResult(data) {
    var sup = ["", "", "²", "³", "⁴", "⁵"];
    var xName = data.feature_col || "x";
    var terms = data.coefficients.map(function (c, i) {
        var power = i + 1;
        var xStr = power === 1 ? xName : xName + (sup[power] ?? "^" + power);
        return c + xStr;
    }).slice().reverse();
    var equation = "Y = " + terms.join(" + ") + " + " + data.intercept;
    equation = equation.replace(/\+\s*-/g, "- ");

    document.getElementById("analyze-result").innerHTML =
        '<h5>多项式回归结果（' + data.degree + ' 阶，基于 ' + xName + '）</h5>' +
        '<p>回归方程：<code>' + equation + '</code></p>' +
        '<ul class="list-group mb-3">' +
        _metricBadge("R² 拟合优度", data.r_squared ?? data.r2_score, "越接近 1 越好") +
        _metricBadge("MAE 平均绝对误差", data.mae, "越小越好") +
        _metricBadge("RMSE 均方根误差", data.rmse, "越小越好") +
        '</ul>';
    document.getElementById("analyze-result").style.display = "block";
}

function _renderCompareClustering(data) {
    var errHtml = Object.entries(data.errors || {})
        .map(function (e) {
            return '<div class="alert alert-warning py-1 mb-1"><strong>' + e[0] + '</strong> 运行失败：' + e[1] + '</div>';
        })
        .join("");

    document.getElementById("analyze-result").innerHTML =
        '<h5>聚类算法对比：K-Means vs DBSCAN</h5>' +
        errHtml +
        '<p class="text-muted small">↑ 越接近 1 越好 &nbsp;|&nbsp; ↓ 越小越好</p>' +
        _renderSummaryTable(data.summary);
    document.getElementById("analyze-result").style.display = "block";
}

function _renderCompareRegression(data) {
    document.getElementById("analyze-result").innerHTML =
        '<h5>回归算法对比：线性 / Ridge / Lasso / 多项式</h5>' +
        '<p class="text-muted small">' +
        '↑ 越接近 1 越好 &nbsp;|&nbsp; ↓ 越小越好 &nbsp;|&nbsp;' +
        '<span class="badge bg-success">绿色行</span> 为综合 R² 最优算法' +
        '</p>' +
        _renderSummaryTable(data.summary, "最优");
    document.getElementById("analyze-result").style.display = "block";
}

// ================================================================
// 按算法独立调用函数（供 AnalyzeModule / 扩展 HTML 用）
// ================================================================

async function runKmeans() {
    var datasetId = _getDatasetId();
    if (!datasetId) { alert("请先上传数据集"); return; }

    var nClusters = parseInt(document.getElementById("k-slider").value) || 3;
    if (nClusters < 2 || nClusters > 10) {
        alert("K 值应在 2～10 之间");
        return;
    }

    _showLoading("analyze-result");
    try {
        var data = await _postJSON("/analyze/kmeans", {
            dataset_id: datasetId,
            columns: _currentColumns,
            n_clusters: nClusters,
        });
        _renderKmeansResult(data);
    } catch (e) {
        _showError("analyze-result", "K-Means 失败：" + e.message);
    }
}

async function runRegression() {
    var datasetId = _getDatasetId();
    if (!datasetId) { alert("请先上传数据集"); return; }

    var xEl = document.getElementById("lr-feature-cols");
    var featureCols = Array.from(xEl.selectedOptions).map(function (o) { return o.value; }).filter(Boolean);
    var targetCol = document.getElementById("lr-target-col").value;

    if (featureCols.length === 0 || !targetCol) {
        alert("请选择特征列和目标列");
        return;
    }
    if (featureCols.includes(targetCol)) {
        alert("目标列不能与特征列中任意列相同");
        return;
    }

    _showLoading("analyze-result");
    try {
        var data = await _postJSON("/analyze/regression", {
            dataset_id: datasetId,
            feature_cols: featureCols,
            target_col: targetCol,
        });
        _renderRegressionResult(data);
    } catch (e) {
        _showError("analyze-result", "线性回归失败：" + e.message);
    }
}

async function runDbscan() {
    var datasetId = _getDatasetId();
    if (!datasetId) { alert("请先上传数据集"); return; }

    var eps = parseFloat(document.getElementById("dbscan-eps")?.value) || 0.5;
    var minSamples = parseInt(document.getElementById("dbscan-min-samples")?.value) || 5;

    _showLoading("analyze-result");
    try {
        var data = await _postJSON("/analyze/dbscan", {
            dataset_id: datasetId,
            columns: _currentColumns,
            eps: eps,
            min_samples: minSamples,
        });
        _renderDbscanResult(data);
    } catch (e) {
        _showError("analyze-result", "DBSCAN 失败：" + e.message);
    }
}

async function runPolyRegression() {
    var datasetId = _getDatasetId();
    if (!datasetId) { alert("请先上传数据集"); return; }

    var xEl = document.getElementById("reg-x");
    var featureCol = xEl ? Array.from(xEl.selectedOptions).map(function (o) { return o.value; })[0] : null;
    var targetCol = document.getElementById("reg-y")?.value;
    if (!featureCol || !targetCol) { alert("请选择特征列和目标列"); return; }

    var degree = parseInt(document.getElementById("poly-degree")?.value) || 2;

    _showLoading("analyze-result");
    try {
        var data = await _postJSON("/analyze/poly_regression", {
            dataset_id: datasetId,
            feature_col: featureCol,
            target_col: targetCol,
            degree: degree,
        });
        _renderPolyRegressionResult(data);
    } catch (e) {
        _showError("analyze-result", "多项式回归失败：" + e.message);
    }
}

async function runCompareClustering() {
    var datasetId = _getDatasetId();
    if (!datasetId) { alert("请先上传数据集"); return; }

    var nClusters = parseInt(document.getElementById("kmeans-k")?.value) || 3;
    var eps = parseFloat(document.getElementById("dbscan-eps")?.value) || 0.5;
    var minSamples = parseInt(document.getElementById("dbscan-min-samples")?.value) || 5;

    _showLoading("analyze-result");
    try {
        var data = await _postJSON("/analyze/compare/clustering", {
            dataset_id: datasetId,
            columns: _currentColumns,
            n_clusters: nClusters,
            eps: eps,
            min_samples: minSamples,
        });
        _renderCompareClustering(data);
    } catch (e) {
        _showError("analyze-result", "聚类对比失败：" + e.message);
    }
}

async function runCompareRegression() {
    var datasetId = _getDatasetId();
    if (!datasetId) { alert("请先上传数据集"); return; }

    var xEl = document.getElementById("reg-x");
    var featureCols = xEl ? Array.from(xEl.selectedOptions).map(function (o) { return o.value; }) : [];
    var targetCol = document.getElementById("reg-y")?.value;
    if (featureCols.length === 0 || !targetCol) { alert("请选择特征列和目标列"); return; }

    var degree = parseInt(document.getElementById("poly-degree")?.value) || 2;

    _showLoading("analyze-result");
    try {
        var data = await _postJSON("/analyze/compare/regression", {
            dataset_id: datasetId,
            feature_cols: featureCols,
            target_col: targetCol,
            degree: degree,
        });
        _renderCompareRegression(data);
    } catch (e) {
        _showError("analyze-result", "回归对比失败：" + e.message);
    }
}

// ================================================================
// app.js 接口函数（全局函数，供 app.js 调用）
// ================================================================

/**
 * 根据选择的算法类型显示对应的参数配置。
 * @param {string} algorithm - "kmeans" | "linear_regression"
 * @param {string[]} columns - 所有列名
 */
function populateAlgorithmParams(algorithm, columns) {
    _currentColumns = columns || [];

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

/**
 * 执行数据分析（通过统一分发路由 POST /analyze）。
 *
 * 根据 algorithm-type 下拉框的值自动组装参数：
 *   - kmeans: columns + n_clusters
 *   - linear_regression: feature_cols + target_col
 *
 * @param {string} datasetId - 当前数据集 ID
 */
async function handleAnalyze(datasetId) {
    var algorithm = document.getElementById("algorithm-type").value;
    var params = { dataset_id: datasetId, algorithm: algorithm };

    if (algorithm === "kmeans") {
        var nClusters = parseInt(document.getElementById("k-slider").value) || 3;
        if (nClusters < 2 || nClusters > 10) {
            alert("K 值应在 2～10 之间");
            return;
        }
        params.n_clusters = nClusters;
    } else if (algorithm === "linear_regression") {
        var xEl = document.getElementById("lr-feature-cols");
        var featureCols = Array.from(xEl.selectedOptions).map(function (o) { return o.value; }).filter(Boolean);
        var targetCol = document.getElementById("lr-target-col").value;
        if (featureCols.length === 0 || !targetCol) {
            alert("请选择特征列和目标列");
            return;
        }
        if (featureCols.includes(targetCol)) {
            alert("目标列不能与特征列中任意列相同");
            return;
        }
        params.feature_cols = featureCols;
        params.target_col = targetCol;
    }

    var renderMap = {
        kmeans: _renderKmeansResult,
        linear_regression: _renderRegressionResult,
    };
    var renderFn = renderMap[algorithm];

    _showLoading("analyze-result");
    try {
        var data = await _postJSON("/analyze", params);
        if (renderFn) renderFn(data);
    } catch (e) {
        _showError("analyze-result", "分析失败：" + e.message);
    }
}

// ================================================================
// 导出模块对象（供扩展 HTML 使用 AnalyzeModule.runKmeans() 等）
// ================================================================
var AnalyzeModule = {
    runKmeans: runKmeans,
    runDbscan: runDbscan,
    runRegression: runRegression,
    runPolyRegression: runPolyRegression,
    runCompareClustering: runCompareClustering,
    runCompareRegression: runCompareRegression,
};
