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

// ================================================================
// DOM 元素缓存
// ================================================================
const fileInput = document.getElementById("file-input");
const btnUploadButton = document.getElementById("btn-upload");
const uploadZone = document.getElementById("upload-zone");
const uploadProgress = document.getElementById("upload-progress");
const fileNameDisplay = document.getElementById("file-name-display");
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
        fileNameDisplay.textContent = this.files[0].name;
        fileNameDisplay.style.display = "inline-block";
    } else {
        btnUploadButton.disabled = true;
        fileNameDisplay.style.display = "none";
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
        fileNameDisplay.textContent = e.dataTransfer.files[0].name;
        fileNameDisplay.style.display = "inline-block";
    }
});

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
    currentDatasetId = data.dataset_id;
    currentColumns = data.columns;
    currentDtypes = data.dtypes || {};

    uploadProgress.style.display = "none";
    btnUploadButton.disabled = true;
    uploadZone.style.pointerEvents = "auto";

    renderPreview(data);
    populateCleanOptions(data.columns);
    populatePlotColumns(data.columns);
    populateAlgorithmParams("kmeans", data.columns);

    setNavStatus("upload", "COMPLETED");
    markNavDone("upload");
    setSysStatus("数据已就绪 — " + data.shape[0] + " 行 × " + data.shape[1] + " 列");

    document.getElementById("preview-empty").style.display = "none";
    document.getElementById("plot-empty").style.display = "none";
    document.getElementById("analyze-empty").style.display = "none";

    showSuccess("数据上传成功！" + data.shape[0] + " 行 × " + data.shape[1] + " 列");
    addRecord("upload", data.shape[0] + " 行 × " + data.shape[1] + " 列，共 " + data.columns.length + " 个字段");
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
        document.getElementById("clean-report-content").textContent =
            JSON.stringify(result.report, null, 2);

        setNavStatus("clean", "COMPLETED");
        markNavDone("clean");
        setSysStatus("清洗完成");
        showSuccess("数据清洗完成");
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

        setNavStatus("visualize", "COMPLETED");
        markNavDone("visualize");
        setSysStatus("图表生成完成");
        var plotDetail = x + " vs " + y + " · " + type;
        addRecord("plot", plotDetail);
        if (result.plotly_json) {
            setTimeout(function () {
                try {
                    Plotly.toImage("plotly-chart", { format: "png", width: 400, height: 250 }).then(function (imgUrl) {
                        var records = loadRecords();
                        if (records.length > 0 && records[0].type === "plot") {
                            records[0].chartImg = imgUrl;
                            localStorage.setItem("idas_history", JSON.stringify(records));
                            if (currentView === "history") { renderHistory(); }
                        }
                    }).catch(function () { });
                } catch (e) { }
            }, 500);
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
});

var kSlider = document.getElementById("k-slider");
var kValueDisplay = document.getElementById("k-value-display");
kSlider.addEventListener("input", function () {
    kValueDisplay.textContent = this.value;
});

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
        var algoLabel = algorithm === "kmeans"
            ? "K-Means (K=" + parseInt(document.getElementById("k-slider").value) + ")"
            : "线性回归";
        addRecord("analyze", algoLabel);
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
// 7. 历史记录（localStorage 存储）
// ================================================================

function addRecord(type, detail, chartImg) {
    var records = loadRecords();
    var now = new Date();
    var record = {
        type: type,
        detail: detail,
        time: now.toLocaleString("zh-CN"),
        timestamp: now.getTime(),
        chartImg: chartImg || null,
    };
    records.unshift(record);
    if (records.length > 50) {
        records = records.slice(0, 50);
    }
    localStorage.setItem("idas_history", JSON.stringify(records));
    if (currentView === "history") {
        renderHistory();
    }
}

function loadRecords() {
    try {
        var raw = localStorage.getItem("idas_history");
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
}

function renderHistory() {
    var records = loadRecords();
    var listEl = document.getElementById("history-list");
    var emptyEl = document.getElementById("history-empty");
    var clearBtn = document.getElementById("btn-clear-history");

    listEl.innerHTML = "";

    if (records.length === 0) {
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

    var typeIcons = {
        upload: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
        clean: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>',
        plot: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="12" width="4" height="9"/><rect x="10" y="6" width="4" height="15"/><rect x="16" y="3" width="4" height="18"/></svg>',
        analyze: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="2"/><circle cx="16" cy="16" r="2"/><line x1="9.4" y1="9.4" x2="14.6" y2="14.6"/></svg>',
        export: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    };

    records.forEach(function (rec, idx) {
        var card = document.createElement("div");
        card.className = "history-card";
        card.style.animationDelay = idx * 0.04 + "s";

        var iconHtml = typeIcons[rec.type] || "";
        var label = typeLabels[rec.type] || rec.type;

        var inner = '<div class="history-card-header">';
        inner += '<span class="history-card-type">' + iconHtml + " " + label + "</span>";
        inner += '<span class="history-card-time">' + rec.time + "</span>";
        inner += "</div>";
        inner += '<div class="history-card-detail">' + rec.detail + "</div>";

        if (rec.chartImg) {
            inner += '<div class="history-card-chart">';
            inner += '<img src="' + rec.chartImg + '" alt="chart thumbnail" />';
            inner += "</div>";
        }

        card.innerHTML = inner;
        listEl.appendChild(card);
    });
}

document.getElementById("btn-clear-history").addEventListener("click", function () {
    if (confirm("确定要清除所有历史记录吗？")) {
        localStorage.removeItem("idas_history");
        renderHistory();
    }
});

// ================================================================
// 初始化
// ================================================================
document.addEventListener("DOMContentLoaded", function () {
    console.log("交互式数据分析系统已加载");
    switchView("data");
    setSysStatus("系统就绪");
});
