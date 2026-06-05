/**
 * app.js - Web界面主控逻辑（侧边栏 + 视图切换）
 * ==============================================
 * 【层】表示层（Web 界面）
 * 【说明】前端主控文件，负责全局状态管理、视图切换、错误处理,
 *        以及调用后端 HTTP API 完成完整数据流程。
 * 【负责人】Web界面模块开发人员
 */

// ================================================================
// 全局状态
// ================================================================
let currentDatasetId = null;
let currentColumns = [];
let currentDtypes = {};
let currentView = "upload";
let _appStateLoaded = false;

// ================================================================
// 状态持久化（localStorage）
// ================================================================

/** 保存当前应用状态到 localStorage，刷新后可恢复 */
function saveAppState() {
    var state = {
        datasetId: currentDatasetId,
        columns: currentColumns,
        dtypes: currentDtypes,
        fileName: _lastFileName || "",
        shape: _lastShape || null,
        previewHTML: (function () {
            var tbl = document.getElementById("preview-table");
            return tbl ? tbl.outerHTML : "";
        })(),
        navDone: {},
        navStatus: {},
        cleanCompleted: false,
        vizCompleted: false,
        lastView: currentView,
        sessionId: _currentSessionId,
        columnStats: window._columnStats || {}
    };
    // 记录各步骤完成状态及状态文字
    ["upload", "clean", "visualize", "analyze"].forEach(function (v) {
        var item = sidebarNav.querySelector('.nav-item[data-view="' + v + '"]');
        if (item && item.classList.contains("done")) {
            state.navDone[v] = true;
        }
        var statusEl = document.getElementById("nav-status-" + v);
        if (statusEl && statusEl.textContent) {
            state.navStatus[v] = statusEl.textContent;
        }
    });
    var cleaned = document.getElementById("clean-report");
    if (cleaned && cleaned.style.display !== "none") {
        state.cleanCompleted = true;
        state.cleanReportHTML = cleaned.innerHTML;
    }
    localStorage.setItem("idas_app_state", JSON.stringify(state));
}

/** 从 localStorage 恢复应用状态 */
function restoreAppState() {
    var raw = localStorage.getItem("idas_app_state");
    if (!raw) return false;
    try {
        var state = JSON.parse(raw);
        if (!state.datasetId) return false;

        currentDatasetId = state.datasetId;
        currentColumns = state.columns || [];
        currentDtypes = state.dtypes || {};
        _lastFileName = state.fileName || "";
        _lastShape = state.shape || null;
        currentView = state.lastView || "data";
        _currentSessionId = state.sessionId || null;
        window._columnStats = state.columnStats || {};

        // 恢复预览表格
        if (state.previewHTML) {
            var temp = document.createElement("div");
            temp.innerHTML = state.previewHTML;
            var newTable = temp.querySelector("table");
            var oldTable = document.getElementById("preview-table");
            if (newTable && oldTable && oldTable.parentNode) {
                oldTable.parentNode.replaceChild(newTable, oldTable);
            }
            document.getElementById("preview-empty").style.display = "none";
        }

        // 恢复导航完成状态
        if (state.navDone) {
            Object.keys(state.navDone).forEach(function (v) {
                if (state.navDone[v]) markNavDone(v);
            });
        }

        // 恢复导航状态文字（COMPLETED 等）
        if (state.navStatus) {
            Object.keys(state.navStatus).forEach(function (v) {
                setNavStatus(v, state.navStatus[v]);
            });
        }

        // 恢复数据集信息显示
        if (state.shape) {
            setSysStatus("数据已就绪 — " + state.shape[0] + " 行 × " + state.shape[1] + " 列");
            setNavStatus("upload", "COMPLETED");
            markNavDone("upload");
            document.getElementById("preview-empty").style.display = "none";
            document.getElementById("plot-empty").style.display = "none";
            document.getElementById("analyze-empty").style.display = "none";
        }

        // 恢复文件名显示
        if (_lastFileName && state.shape) {
            _replaceUploadTextWithFileName(_lastFileName);
        }

        // 初始化各模块下拉框
        if (currentColumns.length > 0) {
            if (typeof populateCleanOptions === "function") {
                populateCleanOptions(currentColumns);
            }
            if (typeof populatePlotColumns === "function") {
                populatePlotColumns(currentColumns, currentDtypes);
            }
            if (typeof populateAlgorithmParams === "function") {
                populateAlgorithmParams("kmeans", currentColumns);
                _updateAlgoDescription("kmeans");
            }
        }

        // 恢复清洗报告
        if (state.cleanCompleted && state.cleanReportHTML) {
            var cr = document.getElementById("clean-report");
            if (cr) {
                cr.innerHTML = state.cleanReportHTML;
                cr.style.display = "block";
            }
        }

        // 切到上次的视图
        switchView(currentView);

        return true;
    } catch (e) {
        console.error("状态恢复失败:", e);
        localStorage.removeItem("idas_app_state");
        return false;
    }
}

var _lastFileName = "";
var _lastShape = null;

// ================================================================
// DOM 元素缓存
// ================================================================
const fileInput = document.getElementById("file-input");
const btnUploadButton = document.getElementById("btn-upload");
const uploadZone = document.getElementById("upload-zone");
const uploadProgress = document.getElementById("upload-progress");
const errorToast = document.getElementById("error-toast");
const errorToastMsg = document.getElementById("error-toast-msg");
const successToast = document.getElementById("success-toast");
const successToastMsg = document.getElementById("success-toast-msg");
const sidebarNav = document.getElementById("sidebar-nav");
const sysStatusText = document.getElementById("sys-status-text");

// ================================================================
// 工具函数
// ================================================================

function showError(message) {
    console.error(message);
    errorToastMsg.textContent = message;
    errorToast.style.display = "flex";
    successToast.style.display = "none";
    clearTimeout(errorToast._timeout);
    errorToast._timeout = setTimeout(function () {
        errorToast.style.display = "none";
    }, 5000);
}

function showSuccess(message) {
    successToastMsg.textContent = message;
    successToast.style.display = "flex";
    errorToast.style.display = "none";
    clearTimeout(successToast._timeout);
    successToast._timeout = setTimeout(function () {
        successToast.style.display = "none";
    }, 3000);
}

function setSysStatus(text) {
    if (sysStatusText) {
        sysStatusText.textContent = text;
    }
}

// ================================================================
// 视图切换
// ================================================================

/**
 * 切换到指定视图。
 * @param {string} viewName - "upload" | "preview" | "clean" | "visualize" | "analyze"
 */
function switchView(viewName) {
    var allNavItems = sidebarNav.querySelectorAll(".nav-item");
    allNavItems.forEach(function (item) {
        if (item.dataset.view === viewName) {
            item.classList.add("active");
        } else {
            item.classList.remove("active");
        }
    });

    var allPanels = document.querySelectorAll(".view-panel");
    allPanels.forEach(function (panel) {
        if (panel.dataset.view === viewName) {
            panel.classList.add("active");
            panel.style.animation = "none";
            panel.offsetHeight;
            panel.style.animation = "viewEnter 0.4s cubic-bezier(0.22, 1, 0.36, 1) both";
        } else {
            panel.classList.remove("active");
        }
    });

    currentView = viewName;

    if (viewName === "history") {
        renderHistory();
    }
}

/**
 * 更新侧边栏导航状态文字。
 * @param {string} viewName
 * @param {string} text - 状态文本
 */
function setNavStatus(viewName, text) {
    var el = document.getElementById("nav-status-" + viewName);
    if (el) {
        el.textContent = text;
    }
}

/**
 * 标记侧边栏项为完成。
 * @param {string} viewName
 */
function markNavDone(viewName) {
    var item = sidebarNav.querySelector('.nav-item[data-view="' + viewName + '"]');
    if (item) {
        item.classList.add("done");
    }
}

/**
 * 重置侧边栏所有步骤状态（新文件上传时调用）。
 */
function resetNavStatuses() {
    ["upload", "clean", "visualize", "analyze", "history"].forEach(function (v) {
        var el = document.getElementById("nav-status-" + v);
        if (el) el.textContent = "";
        var item = sidebarNav.querySelector('.nav-item[data-view="' + v + '"]');
        if (item) item.classList.remove("done");
    });
    document.getElementById("preview-empty").style.display = "flex";
    document.getElementById("plot-empty").style.display = "flex";
    document.getElementById("analyze-empty").style.display = "flex";
    // 清除上次的分析结果和图表内容（仅清文本，不破坏 DOM 结构）
    var crc = document.getElementById("clean-report-content");
    if (crc) crc.textContent = "";
    var ar = document.getElementById("analyze-result");
    if (ar) ar.style.display = "none";
    var cr = document.getElementById("clean-report");
    if (cr) cr.style.display = "none";
    var pc = document.getElementById("plot-container");
    if (pc) { pc.style.display = "none"; }
}

/**
 * 设置预览 badge。
 * @param {string} text
 */
function setNavBadge(viewName, text) {
    var el = document.getElementById("nav-badge-" + viewName);
    if (el) {
        el.textContent = text;
    }
}

// ================================================================
// 侧边栏点击事件
// ================================================================
sidebarNav.addEventListener("click", function (e) {
    var navItem = e.target.closest(".nav-item");
    if (!navItem) {
        return;
    }
    var viewName = navItem.dataset.view;
    if (viewName) {
        switchView(viewName);
    }
});

// ================================================================
// 1. 文件上传
// ================================================================

fileInput.addEventListener("change", function () {
    if (this.files.length > 0) {
        btnUploadButton.disabled = false;
        _replaceUploadTextWithFileName(this.files[0].name);
    } else {
        btnUploadButton.disabled = true;
        _resetUploadText();
    }
});

uploadZone.addEventListener("click", function (e) {
    if (e.target !== fileInput && e.target !== btnUploadButton) {
        fileInput.click();
    }
});

uploadZone.addEventListener("dragover", function (e) {
    e.preventDefault();
    uploadZone.classList.add("drag-over");
});

uploadZone.addEventListener("dragleave", function () {
    uploadZone.classList.remove("drag-over");
});

uploadZone.addEventListener("drop", function (e) {
    e.preventDefault();
    uploadZone.classList.remove("drag-over");
    if (e.dataTransfer.files.length > 0) {
        fileInput.files = e.dataTransfer.files;
        btnUploadButton.disabled = false;
        _replaceUploadTextWithFileName(e.dataTransfer.files[0].name);
    }
});

/**
 * 用文件名替换上传区域的"拖拽或点击上传"文字
 */
function _replaceUploadTextWithFileName(name) {
    _lastFileName = name;
    var textEl = uploadZone.querySelector(".upload-compact-text");
    if (textEl) {
        textEl.textContent = name;
        textEl.style.color = "var(--accent)";
        textEl.style.fontFamily = "var(--font-mono)";
        textEl.style.fontSize = "0.78rem";
    }
}

/**
 * 恢复上传区域的原始提示文字
 */
function _resetUploadText() {
    var textEl = uploadZone.querySelector(".upload-compact-text");
    if (textEl) {
        textEl.textContent = "拖拽或点击上传";
        textEl.style.color = "";
        textEl.style.fontFamily = "";
        textEl.style.fontSize = "";
    }
    _lastFileName = "";
}

btnUploadButton.addEventListener("click", async function () {
    var file = fileInput.files[0];
    if (!file) {
        return;
    }

    uploadProgress.style.display = "flex";
    btnUploadButton.disabled = true;
    uploadZone.style.pointerEvents = "none";
    setNavStatus("upload", "上传中...");
    setSysStatus("正在上传文件...");

    try {
        var data = await handleUpload(file);
        onUploadSuccess(data);
    } catch (err) {
        uploadProgress.style.display = "none";
        btnUploadButton.disabled = false;
        uploadZone.style.pointerEvents = "auto";
        setNavStatus("upload", "FAILED");
        setSysStatus("上传失败");
        showError("上传失败: " + err.message);
    }
});

function onUploadSuccess(data) {
    // 新文件上传：重置侧边栏状态，开始全新的分析流程
    resetNavStatuses();

    currentDatasetId = data.dataset_id;
    currentColumns = data.columns;
    currentDtypes = data.dtypes || {};
    _lastShape = data.shape || null;
    window._columnStats = data.column_stats || {};

    uploadProgress.style.display = "none";
    btnUploadButton.disabled = true;
    uploadZone.style.pointerEvents = "auto";

    renderPreview(data);
    populateCleanOptions(data.columns);
    populatePlotColumns(data.columns, currentDtypes);
    populateAlgorithmParams("kmeans", data.columns);
    _updateAlgoDescription("kmeans");

    setNavStatus("upload", "COMPLETED");
    markNavDone("upload");
    setSysStatus("数据已就绪 — " + data.shape[0] + " 行 × " + data.shape[1] + " 列");

    document.getElementById("preview-empty").style.display = "none";
    document.getElementById("plot-empty").style.display = "none";
    document.getElementById("analyze-empty").style.display = "none";

    showSuccess("数据上传成功！" + data.shape[0] + " 行 × " + data.shape[1] + " 列");

    // 开始新会话（必须在 _resetUploadText 之前，因为后者会清空 _lastFileName）
    startNewSession(_lastFileName);
    addRecord("upload", data.shape[0] + " 行 × " + data.shape[1] + " 列，共 " + data.columns.length + " 个字段");

    // 上传成功后恢复上传栏提示文字，准备下次上传
    _resetUploadText();

    saveAppState();
}

// ================================================================
// 3. 数据清洗
// ================================================================

document.getElementById("btn-clean").addEventListener("click", async function () {
    if (!currentDatasetId) {
        showError("请先上传数据");
        switchView("data");
        return;
    }

    var btn = this;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;"></span> 清洗中...';
    setNavStatus("clean", "RUNNING...");
    setSysStatus("正在清洗数据...");

    var cleanLoading = document.getElementById("clean-loading");
    var cleanReport = document.getElementById("clean-report");
    cleanLoading.style.display = "flex";
    cleanReport.style.display = "none";

    try {
        var params = collectCleanParams();
        params.dataset_id = currentDatasetId;

        var result = await handleClean(params);

        currentDatasetId = result.dataset_id;

        if (result.preview && result.shape) {
            renderPreview({
                columns: currentColumns,
                preview: result.preview,
                shape: result.shape,
                dtypes: currentDtypes,
            });
        }

        cleanLoading.style.display = "none";
        cleanReport.style.display = "block";
        var crc = document.getElementById("clean-report-content");
        if (crc) { crc.textContent = JSON.stringify(result.report, null, 2); }

        setNavStatus("clean", "COMPLETED");
        markNavDone("clean");
        setSysStatus("清洗完成");
        showSuccess("数据清洗完成");

        // 更新清洗面板中每列的处理结果标签
        if (typeof updateCleanBadges === "function") {
            updateCleanBadges(result.report);
        }

        var cleanDetail = result.shape ? ("清洗后 " + result.shape[0] + " 行 × " + result.shape[1] + " 列") : "清洗完成";
        if (result.report) {
            var handled = [];
            if (result.report.missing_handled) {
                for (var k in result.report.missing_handled) { handled.push(k); }
            }
            if (handled.length > 0) { cleanDetail += "，处理了 " + handled.length + " 列的缺失值"; }
            if (result.report.outliers_removed) { cleanDetail += "，移除 " + result.report.outliers_removed + " 个异常值"; }
        }
        addRecord("clean", cleanDetail);
        saveAppState();
    } catch (err) {
        cleanLoading.style.display = "none";
        setNavStatus("clean", "FAILED");
        setSysStatus("清洗失败");
        showError("清洗失败: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span class="btn-ripple"></span><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>执行清洗';
    }
});

// ================================================================
// 4. 可视化
// ================================================================

document.getElementById("btn-plot").addEventListener("click", async function () {
    if (!currentDatasetId) {
        showError("请先上传数据");
        switchView("data");
        return;
    }

    var btn = this;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;"></span> 生成中...';

    var plotLoading = document.getElementById("plot-loading");
    var plotContainer = document.getElementById("plot-container");
    var plotEmpty = document.getElementById("plot-empty");
    plotLoading.style.display = "flex";
    plotContainer.style.display = "none";
    plotEmpty.style.display = "none";

    setNavStatus("visualize", "RUNNING...");
    setSysStatus("正在生成图表...");

    try {
        var x = document.getElementById("plot-x").value;
        var y = document.getElementById("plot-y").value;
        var type = document.getElementById("plot-type").value;

        var result = await handlePlot(currentDatasetId);

        plotLoading.style.display = "none";

        if (!result) {
            setNavStatus("visualize", "FAILED");
            setSysStatus("图表生成失败");
            return;
        }

        setNavStatus("visualize", "COMPLETED");
        markNavDone("visualize");
        setSysStatus("图表生成完成");
        var plotDetail = x + " vs " + y + " · " + type;
        addRecord("plot", plotDetail);
        saveAppState();
        if (result.plotly_json) {
            setTimeout(function () {
                try {
                    var chartEl = document.getElementById("plotly-chart");
                    if (chartEl && typeof Plotly !== 'undefined') {
                        Plotly.toImage(chartEl, { format: "png", width: 600, height: 375 }).then(function (imgUrl) {
                            updateLastPlotImage(imgUrl);
                        }).catch(function () { });
                    }
                } catch (e) { }
            }, 800);
        }
    } catch (err) {
        plotLoading.style.display = "none";
        plotEmpty.style.display = "block";
        setNavStatus("visualize", "FAILED");
        setSysStatus("图表生成失败");
        showError("生成图表失败: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span class="btn-ripple"></span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="12" width="4" height="9"/><rect x="10" y="6" width="4" height="15"/><rect x="16" y="3" width="4" height="18"/></svg>生成图表';
    }
});

// ================================================================
// 5. 分析
// ================================================================

document.getElementById("algorithm-type").addEventListener("change", function () {
    populateAlgorithmParams(this.value, currentColumns);
    _updateAlgoDescription(this.value);
});

var kSlider = document.getElementById("k-slider");
var kValueDisplay = document.getElementById("k-value-display");
kSlider.addEventListener("input", function () {
    kValueDisplay.textContent = this.value;
});

var epsSlider = document.getElementById("dbscan-eps");
if (epsSlider) {
    epsSlider.addEventListener("input", function () {
        var d = document.getElementById("eps-display");
        if (d) d.textContent = parseFloat(this.value).toFixed(1);
    });
}

var minSamplesSlider = document.getElementById("dbscan-min-samples");
if (minSamplesSlider) {
    minSamplesSlider.addEventListener("input", function () {
        var d = document.getElementById("min-samples-display");
        if (d) d.textContent = this.value;
    });
}

var polyDegreeSlider = document.getElementById("poly-degree");
if (polyDegreeSlider) {
    polyDegreeSlider.addEventListener("input", function () {
        var d = document.getElementById("poly-degree-display");
        if (d) d.textContent = this.value;
    });
}

var ALGO_DESCRIPTIONS = {
    kmeans: "K-Means 聚类：将数据自动划分成 K 个群组，每个数据点归属到最近的中心点。适合客户分群、商品分类等场景。",
    dbscan: "DBSCAN 密度聚类：基于数据密度自动发现簇，能识别噪声点（异常数据）。适合地理热点发现、欺诈检测。",
    linear_regression: "线性回归：找到特征与目标之间的线性关系，用于预测连续值。适合房价预测、销售额预估。",
    polynomial_regression: "多项式回归：用曲线拟合非线性关系，阶数越高弯曲度越大。适合药物剂量-疗效等曲线关系。",
    compare_clustering: "聚类对比：同时运行 K-Means 和 DBSCAN，并排对比聚类指标，帮你选择更合适的算法。",
    compare_regression: "回归对比：同时运行线性/Ridge/Lasso/多项式回归，自动标注 R² 最优算法。",
};

function _updateAlgoDescription(algo) {
    var el = document.getElementById("algo-desc");
    if (!el) return;
    var desc = ALGO_DESCRIPTIONS[algo] || "";
    if (desc) {
        el.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg><span>' + desc + '</span>';
        el.style.display = "flex";
    } else {
        el.style.display = "none";
    }
}

document.getElementById("btn-analyze").addEventListener("click", async function () {
    if (!currentDatasetId) {
        showError("请先上传数据");
        switchView("data");
        return;
    }

    var btn = this;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;"></span> 分析中...';

    var analyzeLoading = document.getElementById("analyze-loading");
    var analyzeResult = document.getElementById("analyze-result");
    var analyzeEmpty = document.getElementById("analyze-empty");
    analyzeLoading.style.display = "flex";
    analyzeResult.style.display = "none";
    analyzeEmpty.style.display = "none";

    setNavStatus("analyze", "RUNNING...");
    setSysStatus("正在执行分析...");

    try {
        var algorithm = document.getElementById("algorithm-type").value;

        var result = await handleAnalyze(currentDatasetId);

        analyzeLoading.style.display = "none";

        setNavStatus("analyze", "COMPLETED");
        markNavDone("analyze");
        setSysStatus("分析完成");
        var algoLabels = {
            kmeans: "K-Means (K=" + parseInt(document.getElementById("k-slider").value) + ")",
            dbscan: "DBSCAN (eps=" + document.getElementById("dbscan-eps").value + ")",
            linear_regression: "线性回归",
            polynomial_regression: "多项式回归 (" + document.getElementById("poly-degree").value + "阶)",
            compare_clustering: "聚类对比",
            compare_regression: "回归对比",
        };
        var algoLabel = algoLabels[algorithm] || algorithm;
        addRecord("analyze", algoLabel);
        saveAppState();
    } catch (err) {
        analyzeLoading.style.display = "none";
        analyzeEmpty.style.display = "block";
        setNavStatus("analyze", "FAILED");
        setSysStatus("分析失败");
        showError("分析失败: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span class="btn-ripple"></span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="2"/><circle cx="16" cy="16" r="2"/><line x1="9.4" y1="9.4" x2="14.6" y2="14.6"/></svg>执行分析';
    }
});

// ================================================================
// 6. 导出
// ================================================================

document.getElementById("btn-export").addEventListener("click", function (e) {
    e.preventDefault();
    if (!currentDatasetId) {
        showError("没有可导出的数据");
        switchView("data");
        return;
    }
    var fmt = document.getElementById("export-format").value;
    handleExport(currentDatasetId, fmt);
    setNavStatus("analyze", "EXPORTED");
    markNavDone("analyze");
    setSysStatus((fmt === "xlsx" ? "Excel" : "CSV") + " 导出已开始");
    showSuccess((fmt === "xlsx" ? "Excel" : "CSV") + " 导出已开始");
    addRecord("export", "导出为 " + fmt.toUpperCase() + " 文件");
    saveAppState();
});

// ================================================================
// Canvas 粒子系统（鼠标交互 + 背景粒子网）
// ================================================================
(function () {
    var canvas = document.getElementById("particle-canvas");
    if (!canvas) { return; }
    var ctx = canvas.getContext("2d");
    var particles = [];
    var mouseX = -1000;
    var mouseY = -1000;
    var MAX_PARTICLES = 200;
    var CONNECT_DIST = 130;
    var MOUSE_RADIUS = 120;
    var mouseActive = false;

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    var Particle = function (x, y) {
        this.x = x || Math.random() * canvas.width;
        this.y = y || Math.random() * canvas.height;
        this.vx = (Math.random() - 0.5) * 0.35;
        this.vy = (Math.random() - 0.5) * 0.35;
        this.radius = Math.random() * 1.2 + 0.3;
        this.baseRadius = this.radius;
        this.alpha = Math.random() * 0.35 + 0.30;
    };

    Particle.prototype.update = function () {
        if (mouseActive) {
            var dx = mouseX - this.x;
            var dy = mouseY - this.y;
            var dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < MOUSE_RADIUS) {
                var force = (1 - dist / MOUSE_RADIUS) * 0.04;
                this.vx += dx * force * 0.03;
                this.vy += dy * force * 0.03;
                this.radius = this.baseRadius + (1 - dist / MOUSE_RADIUS) * 1.4;
            } else {
                this.radius += (this.baseRadius - this.radius) * 0.04;
            }
        } else {
            this.radius += (this.baseRadius - this.radius) * 0.04;
        }

        var drag = 0.998;
        this.vx *= drag;
        this.vy *= drag;
        this.x += this.vx;
        this.y += this.vy;

        if (this.x < -20) { this.x = canvas.width + 20; }
        if (this.x > canvas.width + 20) { this.x = -20; }
        if (this.y < -20) { this.y = canvas.height + 20; }
        if (this.y > canvas.height + 20) { this.y = -20; }
    };

    Particle.prototype.draw = function () {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0, 212, 255, " + this.alpha + ")";
        ctx.fill();
    };

    function init() {
        for (var i = 0; i < MAX_PARTICLES; i++) {
            particles.push(new Particle());
        }
    }

    function connect() {
        for (var i = 0; i < particles.length; i++) {
            for (var j = i + 1; j < particles.length; j++) {
                var dx = particles[i].x - particles[j].x;
                var dy = particles[i].y - particles[j].y;
                var dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < CONNECT_DIST) {
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    var lineAlpha = (1 - dist / CONNECT_DIST) * 0.16;
                    ctx.strokeStyle = "rgba(0, 212, 255, " + lineAlpha + ")";
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }
        }
    }

    function drawMouseGlow() {
        if (!mouseActive) { return; }
        var gradient = ctx.createRadialGradient(mouseX, mouseY, 0, mouseX, mouseY, MOUSE_RADIUS);
        gradient.addColorStop(0, "rgba(0, 212, 255, 0.10)");
        gradient.addColorStop(0.5, "rgba(0, 212, 255, 0.04)");
        gradient.addColorStop(1, "rgba(0, 212, 255, 0)");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(mouseX, mouseY, MOUSE_RADIUS, 0, Math.PI * 2);
        ctx.fill();
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (var i = 0; i < particles.length; i++) {
            particles[i].update();
            particles[i].draw();
        }

        connect();
        drawMouseGlow();

        requestAnimationFrame(animate);
    }

    document.addEventListener("mousemove", function (e) {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });

    document.addEventListener("mouseenter", function () { mouseActive = true; });
    document.addEventListener("mouseleave", function () { mouseActive = false; });

    var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!prefersReducedMotion.matches) {
        init();
        animate();
    }
})();

// ================================================================
// 7. 历史记录（按会话分组，localStorage 存储）
// ================================================================

/** 当前会话 ID（上传时生成） */
var _currentSessionId = null;

/**
 * 开始新会话（上传文件时调用）。
 * @param {string} fileName
 * @param {string} [sessionId] - 可选，指定会话 ID
 */
function startNewSession(fileName, sessionId) {
    var sid = sessionId || String(Date.now());
    _currentSessionId = sid;
    var sessions = loadSessions();
    // 检查是否已存在同 ID 会话（避免重复）
    var exists = false;
    for (var i = 0; i < sessions.length; i++) {
        if (sessions[i].sessionId === sid) { exists = true; break; }
    }
    if (!exists) {
        sessions.unshift({
            sessionId: sid,
            fileName: fileName,
            time: new Date().toLocaleString("zh-CN"),
            timestamp: Date.now(),
            steps: []
        });
    }
    if (sessions.length > 30) sessions = sessions.slice(0, 30);
    localStorage.setItem("idas_history", JSON.stringify(sessions));
}

/**
 * 添加一条操作记录到当前会话中。
 * @param {string} type - "upload"|"clean"|"plot"|"analyze"|"export"
 * @param {string} detail - 操作描述
 * @param {string} [chartImg] - 图表图片 data URL
 */
function addRecord(type, detail, chartImg) {
    // 如果没有当前会话，自动创建一个（支持流程中断后继续记录）
    if (!_currentSessionId) {
        var sid = String(Date.now());
        _currentSessionId = sid;
        var fileName = _lastFileName || "未命名文件";
        startNewSession(fileName, sid);
    }
    var sessions = loadSessions();
    var found = false;
    for (var i = 0; i < sessions.length; i++) {
        if (sessions[i].sessionId === _currentSessionId) {
            sessions[i].steps.push({
                type: type,
                detail: detail,
                time: new Date().toLocaleString("zh-CN"),
                chartImg: chartImg || null
            });
            sessions[i].timestamp = Date.now();
            found = true;
            break;
        }
    }
    // 找不到会话则新建一个
    if (!found) {
        var newSes = {
            sessionId: _currentSessionId,
            fileName: _lastFileName || "未命名文件",
            time: new Date().toLocaleString("zh-CN"),
            timestamp: Date.now(),
            steps: [{
                type: type,
                detail: detail,
                time: new Date().toLocaleString("zh-CN"),
                chartImg: chartImg || null
            }]
        };
        sessions.unshift(newSes);
    } else {
        // 移到最前面
        for (var i = 0; i < sessions.length; i++) {
            if (sessions[i].sessionId === _currentSessionId && i > 0) {
                var s = sessions.splice(i, 1)[0];
                sessions.unshift(s);
                break;
            }
        }
    }
    if (sessions.length > 30) sessions = sessions.slice(0, 30);
    localStorage.setItem("idas_history", JSON.stringify(sessions));
    if (currentView === "history") renderHistory();
}

/**
 * 更新当前会话中最后一张图表步骤的图片（异步回调用）。
 * @param {string} imgUrl - base64 data URL
 */
function updateLastPlotImage(imgUrl) {
    if (!_currentSessionId) return;
    var sessions = loadSessions();
    for (var i = 0; i < sessions.length; i++) {
        if (sessions[i].sessionId === _currentSessionId) {
            var steps = sessions[i].steps;
            for (var j = steps.length - 1; j >= 0; j--) {
                if (steps[j].type === "plot") {
                    steps[j].chartImg = imgUrl;
                    break;
                }
            }
            break;
        }
    }
    localStorage.setItem("idas_history", JSON.stringify(sessions));
    if (currentView === "history") renderHistory();
}

function loadRecords() {
    return loadSessions();
}

/** @returns {Array} 会话列表，自动迁移旧格式数据 */
function loadSessions() {
    try {
        var raw = localStorage.getItem("idas_history");
        if (!raw) return [];
        var data = JSON.parse(raw);
        if (!Array.isArray(data) || data.length === 0) return [];

        // 检测是否为新会话格式（第一个元素必须有 sessionId 或 steps）
        if (data[0].sessionId && Array.isArray(data[0].steps)) {
            return data;
        }

        // 旧格式扁平记录，将其包装为一个会话
        // 从第一条记录取时间作为会话时间
        var migratedSteps = [];
        for (var i = data.length - 1; i >= 0; i--) {
            migratedSteps.push({
                type: data[i].type || "upload",
                detail: data[i].detail || "",
                time: data[i].time || "",
                chartImg: data[i].chartImg || null
            });
        }
        var migrated = [{
            sessionId: String(Date.now()),
            fileName: migratedSteps[0] ? (migratedSteps[0].detail || "历史数据") : "未知文件",
            time: data[data.length - 1] ? data[data.length - 1].time : new Date().toLocaleString("zh-CN"),
            timestamp: Date.now(),
            steps: migratedSteps
        }];
        localStorage.setItem("idas_history", JSON.stringify(migrated));
        return migrated;
    } catch (e) {
        localStorage.removeItem("idas_history");
        return [];
    }
}

var _historyExpandedSession = null;

function renderHistory() {
    var sessions = loadSessions();
    var listEl = document.getElementById("history-list");
    var emptyEl = document.getElementById("history-empty");
    var clearBtn = document.getElementById("btn-clear-history");

    listEl.innerHTML = "";

    if (sessions.length === 0) {
        emptyEl.style.display = "flex";
        clearBtn.style.display = "none";
        return;
    }

    emptyEl.style.display = "none";
    clearBtn.style.display = "inline-flex";

    var typeLabels = {
        upload: "数据上传",
        clean: "数据清洗",
        plot: "可视化",
        analyze: "数据分析",
        export: "数据导出",
    };

    var stepColors = {
        upload: "#00d4ff",
        clean: "#f5a623",
        plot: "#10b981",
        analyze: "#a78bfa",
        export: "#60a5fa",
    };

    sessions.forEach(function (session, idx) {
        if (!session.steps || !Array.isArray(session.steps)) return;

        var card = document.createElement("div");
        card.className = "history-card";
        card.style.animationDelay = idx * 0.06 + "s";
        card.setAttribute("data-session-id", session.sessionId);

        // 取最后一张图表缩略图
        var previewImg = null;
        for (var s = session.steps.length - 1; s >= 0; s--) {
            if (session.steps[s].chartImg) { previewImg = session.steps[s].chartImg; break; }
        }

        // 卡片外层容器
        var inner = '<div class="hc-surface">';

        // === 头部：文件名 + 时间 + 步骤徽章 ===
        inner += '<div class="hc-head">';
        inner += '<div class="hc-file-row">';
        inner += '<span class="hc-file-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></span>';
        inner += '<span class="hc-filename">' + escapeHtml(session.fileName) + '</span>';
        inner += '</div>';
        inner += '<div class="hc-meta">';
        inner += '<span class="hc-time">' + session.time + '</span>';
        inner += '<span class="hc-divider-dot"></span>';
        inner += '<span class="hc-step-count">' + session.steps.length + ' 项操作</span>';
        if (previewImg) {
            inner += '<span class="hc-divider-dot"></span>';
            inner += '<span class="hc-badge-chart">图表</span>';
        }
        inner += '</div>';
        inner += '</div>';

        // === 步骤操作条（迷你步骤指示器） ===
        inner += '<div class="hc-step-strip">';
        session.steps.forEach(function (step) {
            var clr = stepColors[step.type] || "#64748b";
            inner += '<span class="hc-step-dot" style="background:' + clr + '" title="' + escapeHtml(typeLabels[step.type] || step.type) + '"></span>';
        });
        inner += '</div>';

        // === 展开箭头 ===
        inner += '<div class="hc-expand-hint"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg></div>';

        // === 展开详情面板 ===
        inner += '<div class="hc-detail-wrap"><div class="hc-detail-inner">';
        session.steps.forEach(function (step) {
            var clr = stepColors[step.type] || "#64748b";
            inner += '<div class="hc-step-row">';
            // 时间线节点
            inner += '<div class="hc-step-marker">';
            inner += '<span class="hc-step-dot-lg" style="background:' + clr + ';box-shadow: 0 0 10px ' + clr + '40;"></span>';
            inner += '</div>';
            // 内容区
            inner += '<div class="hc-step-body">';
            inner += '<div class="hc-step-head">';
            inner += '<span class="hc-step-tag" style="color:' + clr + ';border-color:' + clr + '40;">' + (typeLabels[step.type] || step.type) + '</span>';
            inner += '<span class="hc-step-time">' + (step.time || "") + '</span>';
            inner += '</div>';
            inner += '<div class="hc-step-text">' + escapeHtml(step.detail || "") + '</div>';
            if (step.chartImg) {
                inner += '<div class="hc-chart-frame">';
                inner += '<img src="' + step.chartImg + '" alt="chart" />';
                inner += '</div>';
            }
            inner += '</div>';
            inner += '</div>';
        });
        inner += '</div></div>';

        inner += '</div>'; // .hc-surface
        card.innerHTML = inner;
        listEl.appendChild(card);
    });

    // 展开/收起（CSS max-height 动画）
    listEl.querySelectorAll(".history-card").forEach(function (card) {
        card.addEventListener("click", function (e) {
            var isExpanded = card.classList.contains("expanded");
            // 收起所有
            listEl.querySelectorAll(".history-card.expanded").forEach(function (c) {
                c.classList.remove("expanded");
                c.querySelector(".hc-detail-wrap").style.maxHeight = "0px";
            });
            // 展开当前（如果不是刚才收起的）
            if (!isExpanded) {
                card.classList.add("expanded");
                var wrap = card.querySelector(".hc-detail-wrap");
                wrap.style.maxHeight = wrap.scrollHeight + "px";
            }
        });
    });
}

function escapeHtml(text) {
    var div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

document.getElementById("btn-clear-history").addEventListener("click", function () {
    if (confirm("确定要清除所有历史记录吗？")) {
        localStorage.removeItem("idas_history");
        renderHistory();
    }
});

// ================================================================
// 认证：登录态检查 & 登出
// ================================================================

/**
 * 检查当前用户是否已登录，未登录则跳转回首页。
 */
async function checkAuth() {
    try {
        var resp = await fetch("/api/me");
        if (resp.status === 401) {
            window.location.href = "/";
            return;
        }
        var result = await resp.json();
        if (result.status === "success") {
            var userInfo = document.getElementById("user-info");
            var userName = document.getElementById("user-name");
            if (userInfo && userName) {
                userName.textContent = result.data.username;
                userInfo.style.display = "flex";
            }
        } else {
            window.location.href = "/";
        }
    } catch (_) {
        window.location.href = "/";
    }
}

document.addEventListener("click", function (e) {
    var logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn && e.target === logoutBtn) {
        fetch("/api/logout", { method: "POST" })
            .then(function () { window.location.href = "/"; })
            .catch(function () { window.location.href = "/"; });
    }
});

// ================================================================
// 初始化
// ================================================================
document.addEventListener("DOMContentLoaded", function () {
    checkAuth();
    // 尝试恢复上次会话状态
    if (!restoreAppState()) {
        switchView("data");
        setSysStatus("系统就绪");
    }
    console.log("交互式数据分析系统已加载");
});
