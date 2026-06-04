// analyze.js —— 分析功能模块前端逻辑

const AnalyzeModule = (() => {

  // ---------- 工具函数 ----------

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
      `<div class="text-center"><div class="spinner-border"></div><p>分析中...</p></div>`;
  }

  // ---------- K-Means ----------

  async function runKmeans() {
    const datasetId = getDatasetId();
    if (!datasetId) { alert("请先上传数据集"); return; }

    // 读取用户选择的列（多选框）
    const colSelect = document.getElementById("kmeans-cols");
    const columns = Array.from(colSelect.selectedOptions).map(o => o.value);
    if (columns.length < 1) { alert("至少选择一列"); return; }

    const nClusters = parseInt(document.getElementById("kmeans-k").value) || 3;

    showLoading("analyze-result");

    try {
      const resp = await fetch("/analyze/kmeans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataset_id: datasetId, columns, n_clusters: nClusters }),
      });
      const json = await resp.json();
      if (json.status !== "ok") throw new Error(json.message);
      renderKmeansResult(json.data);
    } catch (e) {
      showError("analyze-result", "聚类失败：" + e.message);
    }
  }

  function renderKmeansResult(data) {
    // 统计每个簇的数量
    const counts = {};
    data.labels.forEach(l => { counts[l] = (counts[l] || 0) + 1; });

    let html = `
      <h5>K-Means 聚类结果（K=${data.n_clusters}）</h5>
      <p>误差平方和 (Inertia)：<strong>${data.inertia}</strong></p>
      <table class="table table-sm table-bordered">
        <thead><tr><th>簇编号</th><th>数据点数量</th><th>中心坐标</th></tr></thead>
        <tbody>
    `;
    data.centers.forEach((center, i) => {
      const coordStr = center.map(v => v.toFixed(3)).join(", ");
      html += `<tr><td>${i}</td><td>${counts[i] || 0}</td><td>[${coordStr}]</td></tr>`;
    });
    html += `</tbody></table>`;

    document.getElementById("analyze-result").innerHTML = html;
  }

  // ---------- 线性回归 ----------

  async function runRegression() {
    const datasetId = getDatasetId();
    if (!datasetId) { alert("请先上传数据集"); return; }

    const xCol = document.getElementById("reg-x").value;
    const yCol = document.getElementById("reg-y").value;
    if (!xCol || !yCol) { alert("请选择 X 列和 Y 列"); return; }
    if (xCol === yCol) { alert("X 列和 Y 列不能相同"); return; }

    showLoading("analyze-result");

    try {
      const resp = await fetch("/analyze/regression", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataset_id: datasetId, x_col: xCol, y_col: yCol }),
      });
      const json = await resp.json();
      if (json.status !== "ok") throw new Error(json.message);
      renderRegressionResult(json.data);
    } catch (e) {
      showError("analyze-result", "回归失败：" + e.message);
    }
  }

  function renderRegressionResult(data) {
    const equation = `Y = ${data.slope} × ${data.x_col} + ${data.intercept}`;
    const html = `
      <h5>线性回归结果</h5>
      <p>回归方程：<code>${equation}</code></p>
      <ul class="list-group mb-3">
        <li class="list-group-item">斜率（slope）：<strong>${data.slope}</strong></li>
        <li class="list-group-item">截距（intercept）：<strong>${data.intercept}</strong></li>
        <li class="list-group-item">R² 拟合优度：<strong>${data.r2_score}</strong>
          <small class="text-muted">（越接近 1 越好）</small></li>
      </ul>
    `;
    document.getElementById("analyze-result").innerHTML = html;
  }

  // ---------- 对外暴露 ----------
  return { runKmeans, runRegression };
})();