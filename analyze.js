// analyze.js —— 分析功能模块前端逻辑

const AnalyzeModule = (() => {

  // ══════════════════════════════════════════
  //  工具函数
  // ══════════════════════════════════════════

  function getDatasetId() {
    // 从全局状态获取当前数据集 ID（与 app.js 约定）
    return window.currentDatasetId || null;
  }

  function showError(containerId, msg) {
    document.getElementById(containerId).innerHTML =
      `<div class="alert alert-danger">${msg}</div>`;
  }

  function showLoading(containerId) {
    document.getElementById(containerId).innerHTML =
      `<div class="text-center py-3">
         <div class="spinner-border text-primary"></div>
         <p class="mt-2 text-muted">分析中，请稍候…</p>
       </div>`;
  }

  /**
   * 统一 POST 请求封装：发送 JSON，解析响应，status 非 ok 时抛出 Error。
   * 消除每个 run* 函数里重复的 fetch 样板代码。
   */
  async function postJSON(url, payload) {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await resp.json();
    if (json.status !== "ok") throw new Error(json.message);
    return json.data;
  }

  /**
   * 渲染单条评估指标行：标签 + 说明文字 + 数值徽章。
   * value 为 null/undefined 时显示"暂无"。
   */
  function metricBadge(label, value, hint = "") {
    const display = (value === null || value === undefined) ? "暂无" : value;
    const hintHtml = hint
      ? `<small class="text-muted ms-2">${hint}</small>`
      : "";
    return `
      <li class="list-group-item d-flex justify-content-between align-items-center">
        <span>${label}${hintHtml}</span>
        <span class="badge bg-primary rounded-pill">${display}</span>
      </li>`;
  }

  /**
   * 将 summary 数组渲染成通用对比表格。
   * @param {Array<Object>} summary  - 每行是一个对象，key 为列名
   * @param {string} highlightKey   - 值为 "✓" 时高亮该行（Bootstrap table-success）
   */
  function renderSummaryTable(summary, highlightKey = "") {
    if (!summary || summary.length === 0) {
      return `<p class="text-muted">无可用对比数据</p>`;
    }
    const headers = Object.keys(summary[0]);
    const headerRow = headers.map(h => `<th>${h}</th>`).join("");
    const bodyRows = summary.map(row => {
      const isHighlight = highlightKey && row[highlightKey] === "✓";
      const rowClass = isHighlight ? "table-success fw-bold" : "";
      const cells = headers.map(h => `<td>${row[h] ?? "—"}</td>`).join("");
      return `<tr class="${rowClass}">${cells}</tr>`;
    }).join("");

    return `
      <table class="table table-sm table-bordered table-hover">
        <thead class="table-light"><tr>${headerRow}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>`;
  }


  // ══════════════════════════════════════════
  //  聚类模块
  // ══════════════════════════════════════════

  // ---------- K-Means ----------

  async function runKmeans() {
    const datasetId = getDatasetId();
    if (!datasetId) { alert("请先上传数据集"); return; }

    const columns = _getSelectedColumns("kmeans-cols");
    if (!columns) return;

    const nClusters = parseInt(document.getElementById("kmeans-k").value) || 3;

    showLoading("analyze-result");
    try {
      const data = await postJSON("/analyze/kmeans", {
        dataset_id: datasetId, columns, n_clusters: nClusters,
      });
      renderKmeansResult(data);
    } catch (e) {
      showError("analyze-result", "K-Means 失败：" + e.message);
    }
  }

  function renderKmeansResult(data) {
    const counts = {};
    data.labels.forEach(l => { counts[l] = (counts[l] || 0) + 1; });

    const tableRows = data.centers.map((center, i) => {
      const coord = center.map(v => v.toFixed(3)).join(", ");
      return `<tr><td>${i}</td><td>${counts[i] || 0}</td><td>[${coord}]</td></tr>`;
    }).join("");

    document.getElementById("analyze-result").innerHTML = `
      <h5>K-Means 聚类结果（K=${data.n_clusters}）</h5>
      <ul class="list-group mb-3">
        ${metricBadge("Inertia（误差平方和）", data.inertia,          "越小越好")}
        ${metricBadge("轮廓系数 Silhouette",   data.silhouette_score, "越接近 1 越好")}
        ${metricBadge("Davies-Bouldin 指数",   data.davies_bouldin_score, "越小越好")}
      </ul>
      <table class="table table-sm table-bordered">
        <thead><tr><th>簇编号</th><th>数据点数</th><th>中心坐标</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table>`;
  }


  // ---------- DBSCAN ----------

  async function runDbscan() {
    const datasetId = getDatasetId();
    if (!datasetId) { alert("请先上传数据集"); return; }

    const columns = _getSelectedColumns("kmeans-cols"); // 复用列选择框
    if (!columns) return;

    const eps        = parseFloat(document.getElementById("dbscan-eps")?.value)         || 0.5;
    const minSamples = parseInt(document.getElementById("dbscan-min-samples")?.value)   || 5;

    showLoading("analyze-result");
    try {
      const data = await postJSON("/analyze/dbscan", {
        dataset_id: datasetId, columns, eps, min_samples: minSamples,
      });
      renderDbscanResult(data);
    } catch (e) {
      showError("analyze-result", "DBSCAN 失败：" + e.message);
    }
  }

  function renderDbscanResult(data) {
    // 统计各簇数量，噪声点（label=-1）单独显示
    const counts = {};
    data.labels.forEach(l => { counts[l] = (counts[l] || 0) + 1; });
    const clusterRows = Object.entries(counts)
      .filter(([k]) => k !== "-1")
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`)
      .join("");

    document.getElementById("analyze-result").innerHTML = `
      <h5>DBSCAN 聚类结果</h5>
      <p class="text-muted small">数据已标准化处理 | eps=${data.eps}，min_samples=${data.min_samples}</p>
      <ul class="list-group mb-3">
        ${metricBadge("发现簇数量",             data.n_clusters)}
        ${metricBadge("噪声点数量",             data.n_noise,              "label = -1 的点")}
        ${metricBadge("轮廓系数 Silhouette",    data.silhouette_score,     "越接近 1 越好（仅含非噪声点）")}
        ${metricBadge("Davies-Bouldin 指数",    data.davies_bouldin_score, "越小越好")}
      </ul>
      <table class="table table-sm table-bordered">
        <thead><tr><th>簇编号</th><th>数据点数</th></tr></thead>
        <tbody>${clusterRows}</tbody>
      </table>`;
  }


  // ---------- 聚类算法对比 ----------

  async function runCompareClustering() {
    const datasetId = getDatasetId();
    if (!datasetId) { alert("请先上传数据集"); return; }

    const columns = _getSelectedColumns("kmeans-cols");
    if (!columns) return;

    const nClusters  = parseInt(document.getElementById("kmeans-k")?.value)            || 3;
    const eps        = parseFloat(document.getElementById("dbscan-eps")?.value)         || 0.5;
    const minSamples = parseInt(document.getElementById("dbscan-min-samples")?.value)   || 5;

    showLoading("analyze-result");
    try {
      const data = await postJSON("/analyze/compare/clustering", {
        dataset_id: datasetId, columns, n_clusters: nClusters, eps, min_samples: minSamples,
      });
      renderCompareClustering(data);
    } catch (e) {
      showError("analyze-result", "聚类对比失败：" + e.message);
    }
  }

  function renderCompareClustering(data) {
    // 有算法运行失败时给出黄色提示，但不阻断成功的结果展示
    const errHtml = Object.entries(data.errors || {})
      .map(([algo, msg]) =>
        `<div class="alert alert-warning py-1 mb-1">
           <strong>${algo}</strong> 运行失败：${msg}
         </div>`)
      .join("");

    document.getElementById("analyze-result").innerHTML = `
      <h5>聚类算法对比：K-Means vs DBSCAN</h5>
      ${errHtml}
      <p class="text-muted small">↑ 越接近 1 越好 &nbsp;|&nbsp; ↓ 越小越好</p>
      ${renderSummaryTable(data.summary)}`;
  }


  // ══════════════════════════════════════════
  //  回归模块
  // ══════════════════════════════════════════

  // ---------- 线性回归 ----------

  async function runRegression() {
    const datasetId = getDatasetId();
    if (!datasetId) { alert("请先上传数据集"); return; }

    const { xCol, yCol } = _getXYCols();
    if (!xCol || !yCol) return;

    showLoading("analyze-result");
    try {
      const data = await postJSON("/analyze/regression", {
        dataset_id: datasetId, x_col: xCol, y_col: yCol,
      });
      renderRegressionResult(data);
    } catch (e) {
      showError("analyze-result", "线性回归失败：" + e.message);
    }
  }

  function renderRegressionResult(data) {
    const equation = `Y = ${data.slope} × ${data.x_col} + ${data.intercept}`;
    document.getElementById("analyze-result").innerHTML = `
      <h5>线性回归结果</h5>
      <p>回归方程：<code>${equation}</code></p>
      <ul class="list-group mb-3">
        ${metricBadge("斜率 slope",        data.slope)}
        ${metricBadge("截距 intercept",    data.intercept)}
        ${metricBadge("R² 拟合优度",       data.r2_score, "越接近 1 越好")}
        ${metricBadge("MAE 平均绝对误差",  data.mae,      "越小越好")}
        ${metricBadge("RMSE 均方根误差",   data.rmse,     "越小越好")}
      </ul>`;
  }


  // ---------- 多项式回归 ----------

  async function runPolyRegression() {
    const datasetId = getDatasetId();
    if (!datasetId) { alert("请先上传数据集"); return; }

    const { xCol, yCol } = _getXYCols();
    if (!xCol || !yCol) return;

    const degree = parseInt(document.getElementById("poly-degree")?.value) || 2;

    showLoading("analyze-result");
    try {
      const data = await postJSON("/analyze/poly_regression", {
        dataset_id: datasetId, x_col: xCol, y_col: yCol, degree,
      });
      renderPolyRegressionResult(data);
    } catch (e) {
      showError("analyze-result", "多项式回归失败：" + e.message);
    }
  }

  function renderPolyRegressionResult(data) {
    // 将系数数组拼成可读的多项式方程，例如：Y = 1.2x² + 3.4x + 5.6
    const sup = ["", "", "²", "³", "⁴", "⁵"];
    const terms = data.coefficients
      .map((c, i) => i === 0 ? null : `${c}x${sup[i] ?? `^${i}`}`)
      .filter(Boolean)
      .reverse(); // 高次项排前面
    const equation = `Y = ${terms.join(" + ")} + ${data.intercept}`;

    document.getElementById("analyze-result").innerHTML = `
      <h5>多项式回归结果（${data.degree} 阶）</h5>
      <p>回归方程：<code>${equation}</code></p>
      <ul class="list-group mb-3">
        ${metricBadge("R² 拟合优度",      data.r2_score, "越接近 1 越好")}
        ${metricBadge("MAE 平均绝对误差", data.mae,      "越小越好")}
        ${metricBadge("RMSE 均方根误差",  data.rmse,     "越小越好")}
      </ul>`;
  }


  // ---------- 回归算法对比 ----------

  async function runCompareRegression() {
    const datasetId = getDatasetId();
    if (!datasetId) { alert("请先上传数据集"); return; }

    const { xCol, yCol } = _getXYCols();
    if (!xCol || !yCol) return;

    const degree = parseInt(document.getElementById("poly-degree")?.value) || 2;

    showLoading("analyze-result");
    try {
      const data = await postJSON("/analyze/compare/regression", {
        dataset_id: datasetId, x_col: xCol, y_col: yCol, degree,
      });
      renderCompareRegression(data);
    } catch (e) {
      showError("analyze-result", "回归对比失败：" + e.message);
    }
  }

  function renderCompareRegression(data) {
    document.getElementById("analyze-result").innerHTML = `
      <h5>回归算法对比：线性 / Ridge / Lasso / 多项式</h5>
      <p class="text-muted small">
        ↑ 越接近 1 越好 &nbsp;|&nbsp; ↓ 越小越好 &nbsp;|&nbsp;
        <span class="badge bg-success">绿色行</span> 为综合 R² 最优算法
      </p>
      ${renderSummaryTable(data.summary, "最优")}`;
  }


  // ══════════════════════════════════════════
  //  私有辅助（模块内部使用，不对外暴露）
  // ══════════════════════════════════════════

  /** 读取多选列选择框，未选择时弹窗并返回 null */
  function _getSelectedColumns(selectId) {
    const el = document.getElementById(selectId);
    const cols = Array.from(el.selectedOptions).map(o => o.value);
    if (cols.length < 1) { alert("至少选择一列"); return null; }
    return cols;
  }

  /** 读取回归 X/Y 列选择框，校验不为空且不相同 */
  function _getXYCols() {
    const xCol = document.getElementById("reg-x").value;
    const yCol = document.getElementById("reg-y").value;
    if (!xCol || !yCol) { alert("请选择 X 列和 Y 列"); return {}; }
    if (xCol === yCol)  { alert("X 列和 Y 列不能相同"); return {}; }
    return { xCol, yCol };
  }


  // ══════════════════════════════════════════
  //  对外暴露（供 HTML 按钮的 onclick 调用）
  // ══════════════════════════════════════════
  return {
    runKmeans,
    runDbscan,
    runCompareClustering,
    runRegression,
    runPolyRegression,
    runCompareRegression,
  };
})();