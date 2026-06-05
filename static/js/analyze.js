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
    return (typeof currentDatasetId !== "undefined") ? currentDatasetId : null;
}

function _showError(containerId, msg) {
    var el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '<div class="alert alert-danger">' + msg + '</div>';
    el.style.display = "block";
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
        '<span>' + display + '</span>' +
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

function _setResult(html) {
    var el = document.getElementById("analyze-result");
    el.innerHTML = html;
    el.style.display = "block";
}

function _simpleExplanation(text) {
    return '<div class="analysis-explain"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg><span>' + text + '</span></div>';
}

function _predVsActualTable(yValues, yPredicted, targetCol, limit) {
    limit = limit || 10;
    var n = Math.min(yValues.length, limit);
    var rows = "";
    for (var i = 0; i < n; i++) {
        var diff = (yValues[i] - yPredicted[i]).toFixed(4);
        var diffClass = Math.abs(diff) > (Math.abs(yValues[i]) * 0.2 || 0.1) ? "text-danger" : "text-success";
        rows += '<tr><td>' + (i + 1) + '</td><td>' + yValues[i] + '</td><td>' + yPredicted[i] + '</td><td class="' + diffClass + '">' + diff + '</td></tr>';
    }
    var label = targetCol || "Y";
    return '<div class="mt-3"><h6>预测 vs 实际对比（前 ' + n + ' 条）</h6>' +
        '<table class="table table-sm table-bordered table-hover"><thead><tr><th>#</th><th>实际 ' + label + '</th><th>预测 ' + label + '</th><th>误差</th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table></div>';
}

// ---------- K-Means ----------

function _renderKmeansResult(data) {
    var counts = {};
    data.labels.forEach(function (l) { counts[l] = (counts[l] || 0) + 1; });

    var tableRows = data.centers.map(function (center, i) {
        var coord = center.map(function (v) { return v.toFixed(3); }).join(", ");
        return '<tr><td>' + i + '</td><td>' + (counts[i] || 0) + '</td><td>[' + coord + ']</td></tr>';
    }).join("");

    var sil = data.silhouette_score;
    var silColor = sil !== null && sil > 0.5 ? "text-success" : (sil !== null && sil > 0.3 ? "text-warning" : "text-danger");
    var db = data.davies_bouldin_score;
    var dbColor = db !== null && db < 1.0 ? "text-success" : "text-warning";

    // 结果解释：根据实际数据描述聚类结果
    var colNames = (data.columns || ["X", "Y"]).join("和");
    var largestCluster = 0, largestLabel = 0;
    for (var k in counts) { if (counts[k] > largestCluster) { largestCluster = counts[k]; largestLabel = k; } }
    var explain;
    if (sil !== null && sil > 0.5) {
        explain = '基于 <strong>' + colNames + '</strong> 将 ' + data.labels.length + ' 条数据分成了 ' + data.n_clusters + ' 个群组，聚类效果<strong>良好</strong>（轮廓系数 ' + sil + '）。';
        explain += ' 最大群组为簇' + largestLabel + '（' + largestCluster + ' 条数据），中心坐标约为 [' + data.centers[largestLabel].map(function (v) { return v.toFixed(2); }).join(', ') + ']。';
    } else if (sil !== null && sil > 0.3) {
        explain = '基于 <strong>' + colNames + '</strong> 分成了 ' + data.n_clusters + ' 个群组，效果<strong>一般</strong>（轮廓系数 ' + sil + '），群组之间有部分重叠。';
        explain += ' 可尝试调整 K 值（如 K=' + (data.n_clusters - 1) + ' 或 ' + (data.n_clusters + 1) + '）重新分析。';
    } else {
        explain = '基于 <strong>' + colNames + '</strong> 的分群效果<strong>不理想</strong>（轮廓系数 ' + sil + '），数据点分布较均匀，难以形成清晰的群组。建议改用 DBSCAN 发现自然簇。';
    }

    var html =
        _simpleExplanation(explain) +
        '<h5>K-Means 聚类结果（K=' + data.n_clusters + '）</h5>' +
        _skippedColsWarning(data.skipped_cols) +
        '<ul class="list-group mb-3">' +
        _metricBadge("Inertia（误差平方和）", data.inertia, "越小越好") +
        _metricBadge("轮廓系数 Silhouette", '<span class="' + silColor + '">' + (sil !== null ? sil : "暂无") + '</span>', "越接近 1 越好") +
        _metricBadge("Davies-Bouldin 指数", '<span class="' + dbColor + '">' + (db !== null ? db : "暂无") + '</span>', "越小越好") +
        '</ul>' +
        '<table class="table table-sm table-bordered">' +
        '<thead><tr><th>簇编号</th><th>数据点数</th><th>中心坐标</th></tr></thead>' +
        '<tbody>' + tableRows + '</tbody></table>';

    // 散点图：使用 Plotly 渲染（仅适用 2 列的情况）
    if (data.data && data.data.length > 0 && data.columns && data.columns.length >= 2 && typeof Plotly !== "undefined") {
        html += '<div id="kmeans-plot" style="width:100%;height:350px;margin-top:16px;"></div>';
    }
    _setResult(html);

    // 异步渲染图表
    if (data.data && data.data.length > 0 && data.columns && data.columns.length >= 2) {
        setTimeout(function () {
            var plotDiv = document.getElementById("kmeans-plot");
            if (!plotDiv) return;
            var c0 = data.data.map(function (r) { return r[0]; });
            var c1 = data.data.map(function (r) { return r[1]; });
            var traces = [];
            var uniqueLabels = [];
            data.labels.forEach(function (l) { if (uniqueLabels.indexOf(l) === -1) uniqueLabels.push(l); });
            uniqueLabels.sort();
            uniqueLabels.forEach(function (label) {
                var x = [], y = [];
                data.labels.forEach(function (l, i) { if (l === label) { x.push(c0[i]); y.push(c1[i]); } });
                traces.push({ x: x, y: y, mode: "markers", type: "scatter", name: "簇 " + label, marker: { size: 6 } });
            });
            Plotly.newPlot(plotDiv, traces, {
                title: "聚类分布 (" + data.columns[0] + " vs " + data.columns[1] + ")",
                xaxis: { title: data.columns[0] },
                yaxis: { title: data.columns[1] },
                plot_bgcolor: "#0d1525",
                paper_bgcolor: "#0d1525",
                font: { color: "#E8EDF4" },
                margin: { t: 40, r: 10, b: 60, l: 60 },
            }, { responsive: true, displayModeBar: false });
        }, 100);
    }
}

// ---------- DBSCAN ----------

function _renderDbscanResult(data) {
    var counts = {};
    data.labels.forEach(function (l) { counts[l] = (counts[l] || 0) + 1; });
    var clusterRows = Object.entries(counts)
        .filter(function (e) { return e[0] !== "-1"; })
        .sort(function (a, b) { return Number(a[0]) - Number(b[0]); })
        .map(function (e) { return '<tr><td>' + e[0] + '</td><td>' + e[1] + '</td></tr>'; })
        .join("");

    // 噪声点原始数据：提取前 15 条
    var noiseHtml = "";
    if (data.data && data.labels && data.n_noise > 0) {
        var noiseCount = 0;
        var noiseRows = "";
        for (var i = 0; i < data.labels.length && noiseCount < 15; i++) {
            if (data.labels[i] === -1) {
                noiseCount++;
                var rowVals = data.data[i].map(function (v) { return typeof v === "number" ? v.toFixed(3) : v; }).join(", ");
                noiseRows += '<tr><td>' + noiseCount + '</td><td>[' + rowVals + ']</td></tr>';
            }
        }
        noiseHtml = '<div class="mt-3"><h6>噪声点数据（前 ' + noiseCount + ' / ' + data.n_noise + ' 条）</h6>' +
            '<p class="text-muted small">噪声点是不属于任何簇的异常数据，建议人工审查。</p>' +
            '<table class="table table-sm table-bordered"><thead><tr><th>#</th><th>数据行 (' + (data.columns || []).join(", ") + ')</th></tr></thead>' +
            '<tbody>' + noiseRows + '</tbody></table></div>';
    }

    var sil = data.silhouette_score;
    var silColor = sil !== null && sil > 0.5 ? "text-success" : (sil !== null && sil > 0.3 ? "text-warning" : "text-danger");

    // 结果解释
    var colNames = (data.columns || ["数值列"]).join("、");
    var explain;
    if (data.n_noise > 0) {
        explain = '基于 <strong>' + colNames + '</strong> 进行密度聚类，发现 <strong>' + data.n_clusters + ' 个数据簇</strong>，其中 ' + data.n_noise + ' 条数据因密度不足被标记为<strong>噪声点</strong>（不属于任何簇）。';
        if (sil !== null && sil > 0.5) explain += ' 聚类质量良好（轮廓系数 ' + sil + '），这些噪声点可能是有价值的异常数据，建议单独审查。';
        else if (sil !== null) explain += ' 当前轮廓系数为 ' + sil + '，可调整 eps（当前 ' + data.eps + '）或 min_samples 参数改善效果。';
    } else {
        explain = '基于 <strong>' + colNames + '</strong> 进行密度聚类，<strong>全部 ' + data.labels.length + ' 条数据均被成功归类</strong>为 ' + data.n_clusters + ' 个簇，未发现噪声点。';
    }

    _setResult(
        _simpleExplanation(explain) +
        '<h5>DBSCAN 聚类结果</h5>' +
        _skippedColsWarning(data.skipped_cols) +
        '<p class="text-muted small">数据已标准化处理 | eps=' + data.eps + '，min_samples=' + data.min_samples + '</p>' +
        '<ul class="list-group mb-3">' +
        _metricBadge("发现簇数量", data.n_clusters) +
        _metricBadge("噪声点数量", data.n_noise, "label = -1 的点") +
        _metricBadge("轮廓系数 Silhouette", '<span class="' + silColor + '">' + (sil !== null ? sil : "暂无") + '</span>', "越接近 1 越好") +
        _metricBadge("Davies-Bouldin 指数", data.davies_bouldin_score, "越小越好") +
        '</ul>' +
        '<table class="table table-sm table-bordered">' +
        '<thead><tr><th>簇编号</th><th>数据点数</th></tr></thead>' +
        '<tbody>' + clusterRows + '</tbody></table>' +
        noiseHtml
    );
}

// ---------- 线性回归 ----------

function _renderRegressionResult(data) {
    var equation = _buildEquation(data);
    var r2 = data.r_squared ?? data.r2_score;
    var r2Color = r2 > 0.7 ? "text-success" : (r2 > 0.4 ? "text-warning" : "text-danger");

    var coefItems = (data.feature_cols && data.feature_cols.length > 1)
        ? data.coefficients.map(function (c, i) {
            return _metricBadge("系数 " + data.feature_cols[i], c);
        }).join("")
        : _metricBadge("斜率 slope", data.coefficients[0]);

    var predTableHtml = "";
    if (data.y_values && data.y_predicted && data.y_values.length > 0) {
        predTableHtml = _predVsActualTable(data.y_values, data.y_predicted, data.target_col, 10);
    }

    // 结果解释：解释具体哪几个特征预测哪个目标
    var targetName = data.target_col || "Y";
    var featNames = (data.feature_cols || ["X"]).join(" 和 ");
    var explain;
    if (r2 > 0.7) {
        explain = '用 <strong>' + featNames + '</strong> 来预测 <strong>' + targetName + '</strong>，模型拟合<strong>很好</strong>（R² = ' + r2 + '）。';
        explain += featNames + ' 能解释 ' + targetName + ' <strong>' + Math.round(r2 * 100) + '%</strong> 的变化，可用于可靠预测。';
        if (data.mae) explain += ' 平均预测误差约为 ' + (typeof data.mae === 'number' ? data.mae.toFixed(4) : data.mae) + '。';
    } else if (r2 > 0.4) {
        explain = '用 <strong>' + featNames + '</strong> 预测 <strong>' + targetName + '</strong>，效果<strong>一般</strong>（R² = ' + r2 + '），';
        explain += '只能解释 ' + Math.round(r2 * 100) + '% 的变化。建议增加更多相关特征或尝试多项式回归。';
    } else {
        explain = '用 <strong>' + featNames + '</strong> 预测 <strong>' + targetName + '</strong> 的效果<strong>不理想</strong>（R² = ' + r2 + '），';
        explain += '说明 ' + featNames + ' 与 ' + targetName + ' 之间的线性关系很弱 —— 仅靠当前特征无法有效预测 ' + targetName + '，建议更换特征或使用其他算法。';
    }

    _setResult(
        _simpleExplanation(explain) +
        '<h5>线性回归结果</h5>' +
        '<p>回归方程：<code>' + equation + '</code></p>' +
        '<ul class="list-group mb-3">' +
        coefItems +
        _metricBadge("截距 intercept", data.intercept) +
        _metricBadge("R² 拟合优度", '<span class="' + r2Color + '">' + r2 + '</span>', "越接近 1 越好") +
        _metricBadge("MAE 平均绝对误差", data.mae, "越小越好") +
        _metricBadge("RMSE 均方根误差", data.rmse, "越小越好") +
        '</ul>' +
        predTableHtml
    );
}

// ---------- 多项式回归 ----------

function _renderPolyRegressionResult(data) {
    var sup = ["", "", "²", "³", "⁴", "⁵"];
    var xName = data.feature_col || "x";
    var equation = _buildPolyEquation(data, sup, xName);

    var overfitWarning = "";
    if (data.degree >= 4) {
        overfitWarning = '<div class="alert alert-warning py-1 mb-2">' +
            '<strong>过拟合风险提示</strong>：' + data.degree + ' 阶多项式容易在训练数据上表现极好（R² 接近 1），但对新数据的预测能力可能很差。建议仅当数据有明显曲线趋势时使用。' +
            '</div>';
    }

    // 系数列表
    var coefItems = data.coefficients.map(function (c, i) {
        var power = i + 1;
        var xStr = power === 1 ? xName : xName + (sup[power] ?? "^" + power);
        return _metricBadge(xStr + " 系数", c);
    }).join("");

    var predTableHtml = "";
    if (data.y_values && data.y_predicted && data.y_values.length > 0) {
        predTableHtml = _predVsActualTable(data.y_values, data.y_predicted, data.target_col, 10);
    }

    // 结果解释
    var xName = data.feature_col || "X";
    var tName = data.target_col || "Y";
    var r2 = data.r_squared ?? data.r2_score;
    var explain;
    if (r2 > 0.7) {
        explain = '用 <strong>' + xName + '</strong> 的 ' + data.degree + ' 阶曲线来拟合 <strong>' + tName + '</strong>，效果<strong>很好</strong>（R² = ' + r2 + '）。';
        explain += '说明 ' + xName + ' 与 ' + tName + ' 之间存在<strong>明显的非线性关系</strong>（弯曲趋势），' + data.degree + ' 阶多项式很好地捕捉了这种规律。';
    } else if (r2 > 0.4) {
        explain = '用 ' + data.degree + ' 阶曲线拟合 <strong>' + xName + '</strong> → <strong>' + tName + '</strong>，效果<strong>一般</strong>（R² = ' + r2 + '）。';
        explain += '可尝试调整阶数：降低阶数可能更稳定，提高阶数可能更精确但有过拟合风险。';
    } else {
        explain = '用 <strong>' + xName + '</strong> 预测 <strong>' + tName + '</strong> 的 ' + data.degree + ' 阶曲线效果<strong>不理想</strong>（R² = ' + r2 + '），';
        explain += '说明这两个指标之间不存在明显的曲线关系，建议尝试其他分析方法。';
    }

    _setResult(
        _simpleExplanation(explain) +
        '<h5>多项式回归结果（' + data.degree + ' 阶，基于 ' + xName + '）</h5>' +
        overfitWarning +
        '<p>回归方程：<code>' + equation + '</code></p>' +
        '<ul class="list-group mb-3">' +
        coefItems +
        _metricBadge("截距 intercept", data.intercept) +
        _metricBadge("R² 拟合优度", data.r_squared ?? data.r2_score, "越接近 1 越好") +
        _metricBadge("MAE 平均绝对误差", data.mae, "越小越好") +
        _metricBadge("RMSE 均方根误差", data.rmse, "越小越好") +
        '</ul>' +
        predTableHtml
    );
}

// ---------- 聚类对比 ----------

function _renderCompareClustering(data) {
    var errHtml = Object.entries(data.errors || {})
        .map(function (e) {
            return '<div class="alert alert-warning py-1 mb-1"><strong>' + e[0] + '</strong> 运行失败：' + e[1] + '</div>';
        })
        .join("");

    // 结果解释：对比两种聚类在同一数据上的表现
    var kmeansSil = data.results && data.results.kmeans ? data.results.kmeans.silhouette_score : null;
    var dbscanSil = data.results && data.results.dbscan ? data.results.dbscan.silhouette_score : null;
    var colNames = "数值列";
    if (data.results && data.results.kmeans && data.results.kmeans.columns) {
        colNames = data.results.kmeans.columns.join(" 和 ");
    }
    var explain = '';
    if (kmeansSil !== null && dbscanSil !== null) {
        explain += '在 <strong>' + colNames + '</strong> 上对比两种聚类：';
        if (kmeansSil > dbscanSil) {
            explain += 'K-Means 轮廓系数（' + kmeansSil + '）<strong>高于</strong> DBSCAN（' + dbscanSil + '），说明这份数据更适合用 K-Means 划分球形群组。';
        } else if (dbscanSil > kmeansSil) {
            explain += 'DBSCAN 轮廓系数（' + dbscanSil + '）<strong>高于</strong> K-Means（' + kmeansSil + '），说明数据中存在不规则形状的自然分群，DBSCAN 更能识别。';
        } else {
            explain += '两种算法表现<strong>相当</strong>（轮廓系数均为 ' + kmeansSil + '），选择任一均可。';
        }
    } else {
        explain += '在 <strong>' + colNames + '</strong> 上进行聚类对比，查看下方对比表了解各算法指标差异。';
    }

    _setResult(
        _simpleExplanation(explain) +
        '<h5>聚类算法对比：K-Means vs DBSCAN</h5>' +
        errHtml +
        '<p class="text-muted small">↑ 越接近 1 越好 &nbsp;|&nbsp; ↓ 越小越好</p>' +
        _renderSummaryTable(data.summary)
    );
}

// ---------- 回归对比 ----------

function _renderCompareRegression(data) {
    // 提取特征和目标信息
    var featNames = (data.feature_cols || ["X"]).join(" 和 ");
    var tName = data.target_col || "Y";

    // 找最优算法
    var bestAlgo = "";
    var bestR2 = -1;
    if (data.summary) {
        data.summary.forEach(function (row) {
            var r2v = parseFloat(row["R² ↑"]);
            if (r2v > bestR2) { bestR2 = r2v; bestAlgo = row["算法"] || ""; }
        });
    }
    var explain = '用 ' + data.summary.length + ' 种算法分别尝试用 <strong>' + featNames + '</strong> 预测 <strong>' + tName + '</strong>：';
    if (bestAlgo) {
        explain += '<strong>' + bestAlgo + '</strong> 的 R² 最高（' + bestR2.toFixed(4) + '），是本次分析的最优选择。';
        if (bestR2 > 0.7) explain += " 该模型对 " + tName + " 的预测能力可靠。";
        else explain += " 但 R² 偏低，预测 " + tName + " 的精度仍有提升空间，建议收集更多相关特征。";
    }

    _setResult(
        _simpleExplanation(explain) +
        '<h5>回归算法对比：线性 / Ridge / Lasso / 多项式</h5>' +
        '<p class="text-muted small">' +
        '↑ 越接近 1 越好 &nbsp;|&nbsp; ↓ 越小越好 &nbsp;|&nbsp;' +
        '<span class="badge bg-success">绿色行</span> 为综合 R² 最优算法' +
        '</p>' +
        _renderSummaryTable(data.summary, "最优")
    );
}

// ---------- 辅助函数 ----------

function _buildEquation(data) {
    var equation;
    if (data.feature_cols && data.feature_cols.length > 1) {
        var terms = data.coefficients.map(function (c, i) { return c + " × " + data.feature_cols[i]; });
        equation = "Y = " + terms.join(" + ") + " + " + data.intercept;
    } else {
        var xName = (data.feature_cols && data.feature_cols[0]) || data.feature_col || "X";
        equation = "Y = " + data.coefficients[0] + " × " + xName + " + " + data.intercept;
    }
    return equation.replace(/\+\s*-/g, "- ");
}

function _buildPolyEquation(data, sup, xName) {
    var terms = data.coefficients.map(function (c, i) {
        var power = i + 1;
        var xStr = power === 1 ? xName : xName + (sup[power] ?? "^" + power);
        return c + xStr;
    }).slice().reverse();
    return ("Y = " + terms.join(" + ") + " + " + data.intercept).replace(/\+\s*-/g, "- ");
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

    var nClusters = parseInt(document.getElementById("k-slider")?.value) || 3;
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
 * @param {string} algorithm - 算法标识
 * @param {string[]} columns - 所有列名
 */
function populateAlgorithmParams(algorithm, columns) {
    _currentColumns = columns || [];

    // 隐藏所有参数面板
    var panels = ["kmeans-params", "dbscan-params", "lr-params", "poly-params"];
    panels.forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.style.display = "none";
    });

    if (algorithm === "kmeans") {
        showPanel("kmeans-params", "flex");
    } else if (algorithm === "dbscan") {
        showPanel("dbscan-params", "block");
    } else if (algorithm === "linear_regression") {
        showPanel("lr-params", "block");
        _fillColumnSelects(columns);
    } else if (algorithm === "polynomial_regression") {
        showPanel("poly-params", "block");
        _fillSingleColumnSelects(columns);
    } else if (algorithm === "compare_clustering") {
        showPanel("kmeans-params", "flex");
        showPanel("dbscan-params", "block");
    } else if (algorithm === "compare_regression") {
        showPanel("lr-params", "block");
        _fillColumnSelects(columns);
    }

    function showPanel(id, display) {
        var el = document.getElementById(id);
        if (el) el.style.display = display;
    }
}

function _fillColumnSelects(columns) {
    if (!columns || columns.length === 0) return;
    var featureSelect = document.getElementById("lr-feature-cols");
    var targetSelect = document.getElementById("lr-target-col");
    if (!featureSelect || !targetSelect) return;
    featureSelect.innerHTML = "";
    targetSelect.innerHTML = "";
    columns.forEach(function (col) {
        var fo = document.createElement("option"); fo.value = col; fo.textContent = col; featureSelect.appendChild(fo);
        var to = document.createElement("option"); to.value = col; to.textContent = col; targetSelect.appendChild(to);
    });
}

function _fillSingleColumnSelects(columns) {
    if (!columns || columns.length === 0) return;
    var fSel = document.getElementById("poly-feature-col");
    var tSel = document.getElementById("poly-target-col");
    if (!fSel || !tSel) return;
    fSel.innerHTML = "";
    tSel.innerHTML = "";
    columns.forEach(function (col) {
        var fo = document.createElement("option"); fo.value = col; fo.textContent = col; fSel.appendChild(fo);
        var to = document.createElement("option"); to.value = col; to.textContent = col; tSel.appendChild(to);
    });
}

/**
 * 执行数据分析（通过统一分发路由 POST /analyze）。
 * @param {string} datasetId - 当前数据集 ID
 */
async function handleAnalyze(datasetId) {
    var algorithm = document.getElementById("algorithm-type").value;
    var params = { dataset_id: datasetId, algorithm: algorithm };

    if (algorithm === "kmeans") {
        var nClusters = parseInt(document.getElementById("k-slider").value) || 3;
        if (nClusters < 2 || nClusters > 10) { alert("K 值应在 2～10 之间"); return; }
        params.n_clusters = nClusters;
    } else if (algorithm === "dbscan") {
        var eps = parseFloat(document.getElementById("dbscan-eps").value) || 0.5;
        var minSamples = parseInt(document.getElementById("dbscan-min-samples").value) || 5;
        if (eps <= 0) { alert("eps 必须大于 0"); return; }
        if (minSamples < 2) { alert("min_samples 至少为 2"); return; }
        params.eps = eps;
        params.min_samples = minSamples;
    } else if (algorithm === "linear_regression") {
        var ret = _getRegressionParams();
        if (!ret) return;
        params.feature_cols = ret.featureCols;
        params.target_col = ret.targetCol;
    } else if (algorithm === "polynomial_regression") {
        var fc = document.getElementById("poly-feature-col").value;
        var tc = document.getElementById("poly-target-col").value;
        var degree = parseInt(document.getElementById("poly-degree").value) || 2;
        if (!fc || !tc) { alert("请选择特征列和目标列"); return; }
        if (fc === tc) { alert("目标列不能与特征列相同"); return; }
        params.feature_col = fc;
        params.target_col = tc;
        params.degree = degree;
    } else if (algorithm === "compare_clustering") {
        var nC = parseInt(document.getElementById("k-slider").value) || 3;
        var e = parseFloat(document.getElementById("dbscan-eps").value) || 0.5;
        var mS = parseInt(document.getElementById("dbscan-min-samples").value) || 5;
        params.n_clusters = nC;
        params.eps = e;
        params.min_samples = mS;
    } else if (algorithm === "compare_regression") {
        var r2 = _getRegressionParams();
        if (!r2) return;
        params.feature_cols = r2.featureCols;
        params.target_col = r2.targetCol;
    }

    var renderMap = {
        kmeans: _renderKmeansResult,
        dbscan: _renderDbscanResult,
        linear_regression: _renderRegressionResult,
        polynomial_regression: _renderPolyRegressionResult,
        compare_clustering: _renderCompareClustering,
        compare_regression: _renderCompareRegression,
    };
    var renderFn = renderMap[algorithm];

    _showLoading("analyze-result");
    try {
        var data = await _postJSON("/analyze", params);
        if (renderFn) { renderFn(data); }
        else { document.getElementById("analyze-result").innerHTML = "<pre>" + JSON.stringify(data, null, 2) + "</pre>"; document.getElementById("analyze-result").style.display = "block"; }
    } catch (e) {
        _showError("analyze-result", "分析失败：" + e.message);
    }
}

function _getRegressionParams() {
    var xEl = document.getElementById("lr-feature-cols");
    var featureCols = Array.from(xEl ? xEl.selectedOptions : []).map(function (o) { return o.value; }).filter(Boolean);
    var targetCol = document.getElementById("lr-target-col") ? document.getElementById("lr-target-col").value : "";
    if (featureCols.length === 0 || !targetCol) { alert("请选择特征列和目标列"); return null; }
    if (featureCols.includes(targetCol)) { alert("目标列不能与特征列中任意列相同"); return null; }
    return { featureCols: featureCols, targetCol: targetCol };
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
