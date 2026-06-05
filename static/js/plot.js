/**
 * plot.js - 可视化模块前端逻辑
 * ====================================
 * 【负责人】可视化模块开发人员
 * 【依赖】Plotly.js CDN（在 index.html 中引入）
 *
 * 暴露给 Web 界面模块的接口:
 *   - populatePlotColumns(columns, dtypes) → 填充 X/Y 轴列选择下拉框
 *   - handlePlot(datasetId)                → 生成图表并渲染，返回 data 对象
 *
 * 【实现要求】
 * - 仅调用控制层 HTTP API (/plot)
 * - 使用 Plotly.js 渲染交互式图表
 */

// 存储当前图表实例，用于更新
let currentPlotInstance = null;

// ================================================================
// 1. 填充列选择下拉框
// ================================================================

/**
 * 将数据集列名填充到 X 轴和 Y 轴的下拉框中。
 *
 * @param {string[]} columns - 所有列名
 * @param {object} dtypes - 列类型信息 {列名: 类型}
 */
function populatePlotColumns(columns, dtypes = {}) {
    const xSelect = document.getElementById('plot-x');
    const ySelect = document.getElementById('plot-y');
    const plotType = document.getElementById('plot-type').value;

    // 保存当前选中的值，切换类型后尽量恢复
    const prevX = xSelect.value;
    const prevY = ySelect.value;

    // 记录当前图表分组，供切换事件判断
    _lastPlotGroup = plotType === 'pie' ? 'pie' : 'numeric';

    // 清空原有选项
    xSelect.innerHTML = '';
    ySelect.innerHTML = '';

    // 区分数值列和分类列
    const numericCols = [];
    const categoricalCols = [];

    columns.forEach(col => {
        const dtype = dtypes[col] || '';
        if (dtype.includes('int') || dtype.includes('float') || dtype === 'number') {
            numericCols.push(col);
        } else {
            categoricalCols.push(col);
        }
    });

    // 根据图表类型填充不同的选项
    if (plotType === 'pie') {
        // 饼图：X轴为分类列，Y轴为数值列
        categoricalCols.forEach(col => {
            const option = document.createElement('option');
            option.value = col;
            option.textContent = col;
            xSelect.appendChild(option);
        });

        numericCols.forEach(col => {
            const option = document.createElement('option');
            option.value = col;
            option.textContent = col;
            ySelect.appendChild(option);
        });
    } else {
        // 其他图表：X轴和Y轴都填数值列
        numericCols.forEach(col => {
            const optionX = document.createElement('option');
            optionX.value = col;
            optionX.textContent = col;
            xSelect.appendChild(optionX);

            const optionY = document.createElement('option');
            optionY.value = col;
            optionY.textContent = col;
            ySelect.appendChild(optionY);
        });
    }

    // 恢复之前选中的值（仅在选项仍存在时生效）
    var found = false;
    for (var i = 0; i < xSelect.options.length; i++) {
        if (xSelect.options[i].value === prevX) {
            xSelect.selectedIndex = i;
            found = true;
            break;
        }
    }
    if (found) {
        for (var i = 0; i < ySelect.options.length; i++) {
            if (ySelect.options[i].value === prevY) {
                ySelect.selectedIndex = i;
                break;
            }
        }
    }
}

// ================================================================
// 图表类型切换事件
// ================================================================
var _lastPlotGroup = 'numeric';  // 'numeric' | 'pie'
document.getElementById('plot-type').addEventListener('change', function () {
    var newGroup = this.value === 'pie' ? 'pie' : 'numeric';
    // 只有 numeric ↔ pie 切换时才需要重建选项（列类型不同）
    if (newGroup !== _lastPlotGroup && typeof populatePlotColumns === 'function' && typeof currentColumns !== 'undefined' && currentColumns.length > 0) {
        _lastPlotGroup = newGroup;
        populatePlotColumns(currentColumns, currentDtypes);
    }
    _updateCustomParamVisibility(this.value);
});

// ================================================================
// 自定义参数控件联动
// ================================================================

/**
 * 根据当前图表类型显示/隐藏对应的自定义参数控件。
 * @param {string} chartType - "scatter" | "line" | "bar" | "pie"
 */
function _updateCustomParamVisibility(chartType) {
    var allParams = document.querySelectorAll('#plot-custom-params .param-group');

    // 先全部隐藏，再按 chartType 显示对应的控件
    allParams.forEach(function (group) {
        if (group.classList.contains('plot-param-' + chartType)) {
            group.style.display = '';
        } else {
            group.style.display = 'none';
        }
    });
}

// ================================================================
// 滑块值实时显示更新 + Plotly 图表实时变化 + 历史缩略图更新
// ================================================================
function _getChartEl() {
    var el = document.getElementById('plotly-chart');
    if (!el || el.style.display === 'none' || !el._fullLayout) return null;
    return el;
}

/** 延迟更新历史记录中的图表缩略图（防抖 800ms） */
var _debouncedCaptureImage = null;
function _scheduleImageCapture() {
    if (_debouncedCaptureImage) clearTimeout(_debouncedCaptureImage);
    _debouncedCaptureImage = setTimeout(function () {
        var el = _getChartEl();
        if (!el || typeof Plotly === 'undefined') return;
        Plotly.toImage(el, { format: 'png', width: 400, height: 250 }).then(function (imgUrl) {
            if (typeof updateLastPlotImage === 'function') {
                updateLastPlotImage(imgUrl);
            }
        }).catch(function () { });
    }, 800);
}

var opacitySlider = document.getElementById('plot-opacity');
if (opacitySlider) {
    opacitySlider.addEventListener('input', function () {
        var display = document.getElementById('opacity-display');
        if (display) { display.textContent = parseFloat(this.value).toFixed(1); }
        var chart = _getChartEl();
        if (chart && typeof Plotly !== 'undefined') {
            Plotly.restyle(chart, { 'opacity': parseFloat(this.value) });
            _scheduleImageCapture();
        }
    });
}

var markerSizeSlider = document.getElementById('plot-marker-size');
if (markerSizeSlider) {
    markerSizeSlider.addEventListener('input', function () {
        var display = document.getElementById('marker-size-display');
        if (display) { display.textContent = this.value; }
        var chart = _getChartEl();
        if (chart && typeof Plotly !== 'undefined') {
            Plotly.restyle(chart, { 'marker.size': parseInt(this.value, 10) });
            _scheduleImageCapture();
        }
    });
}

var pieHoleSlider = document.getElementById('plot-hole');
if (pieHoleSlider) {
    pieHoleSlider.addEventListener('input', function () {
        var display = document.getElementById('pie-hole-display');
        if (display) { display.textContent = parseFloat(this.value).toFixed(1); }
        var chart = _getChartEl();
        if (chart && typeof Plotly !== 'undefined') {
            Plotly.restyle(chart, { 'hole': parseFloat(this.value) });
            _scheduleImageCapture();
        }
    });
}

var lineWidthSlider = document.getElementById('plot-line-width');
if (lineWidthSlider) {
    lineWidthSlider.addEventListener('input', function () {
        var display = document.getElementById('line-width-display');
        if (display) { display.textContent = this.value; }
        var chart = _getChartEl();
        if (chart && typeof Plotly !== 'undefined') {
            Plotly.restyle(chart, { 'line.width': parseInt(this.value, 10) });
            _scheduleImageCapture();
        }
    });
}

var pieMaxCatSlider = document.getElementById('plot-pie-max-categories');
if (pieMaxCatSlider) {
    pieMaxCatSlider.addEventListener('input', function () {
        var display = document.getElementById('pie-max-cat-display');
        if (display) { display.textContent = this.value; }
    });
}

// 折线图：显示标记点 checkbox 实时切换
var showMarkersCb = document.getElementById('plot-show-markers');
if (showMarkersCb) {
    showMarkersCb.addEventListener('change', function () {
        var chart = _getChartEl();
        if (chart && typeof Plotly !== 'undefined') {
            var mode = this.checked ? 'lines+markers' : 'lines';
            Plotly.restyle(chart, { 'mode': mode });
            _scheduleImageCapture();
        }
    });
}

// 折线图：填充面积 checkbox 实时切换
var fillAreaCb = document.getElementById('plot-fill-area');
if (fillAreaCb) {
    fillAreaCb.addEventListener('change', function () {
        var chart = _getChartEl();
        if (chart && typeof Plotly !== 'undefined') {
            var fillVal = this.checked ? 'tozeroy' : 'none';
            // 只改最后一条 trace（填充面积 trace）
            Plotly.restyle(chart, { 'fill': fillVal }, [chart.data ? chart.data.length - 1 : 0]);
            _scheduleImageCapture();
        }
    });
}

// 柱状图/饼图：图例 checkbox 实时切换
var showLegendCb = document.getElementById('plot-show-legend');
if (showLegendCb) {
    showLegendCb.addEventListener('change', function () {
        var chart = _getChartEl();
        if (chart && typeof Plotly !== 'undefined') {
            Plotly.relayout(chart, { 'showlegend': this.checked });
            _scheduleImageCapture();
        }
    });
}

// ================================================================
// 配色方案 / 主题实时切换（不重新请求后端，直接操作 Plotly）
// ================================================================

/** Plotly 预设色板（与后端 COLOR_SCHEMES 对应） */
var _COLOR_PALETTES = {
    d3: ['#1F77B4', '#FF7F0E', '#2CA02C', '#D62728', '#9467BD', '#8C564B', '#E377C2', '#7F7F7F', '#BCBD22', '#17BECF'],
    set1: ['#E41A1C', '#377EB8', '#4DAF4A', '#984EA3', '#FF7F00', '#FFFF33', '#A65628', '#F781BF', '#999999'],
    set2: ['#66C2A5', '#FC8D62', '#8DA0CB', '#E78AC3', '#A6D854', '#FFD92F', '#E5C494', '#B3B3B3'],
    pastel: ['#B3E2CD', '#FDCDAC', '#CBD5E8', '#F4CAE4', '#E6F5C9', '#FFF2AE', '#F1E2CC', '#CCCCCC'],
    dark24: ['#2E91E5', '#E15F99', '#1CA71C', '#FB0D0D', '#DA16FF', '#222A2A', '#B68100', '#750D86', '#EB663B', '#511CFB', '#00A08B', '#FB00D1', '#FC0080', '#B2828D', '#6C7C32', '#778AAE', '#862A16', '#A777F1', '#620042', '#1616A7', '#A8BE34', '#5A5A8D', '#8C96F0', '#22FFA7'],
    plotly: ['#636EFA', '#EF553B', '#00CC96', '#AB63FA', '#FFA15A', '#19D3F3', '#FF6692', '#B6E880', '#FF97FF', '#FECB52'],
    g10: ['#3366CC', '#DC3912', '#FF9900', '#109618', '#990099', '#0099C6', '#DD4477', '#66AA00', '#B82E2E', '#316395', '#994499', '#22AA99', '#AAAA11', '#6633CC', '#E67300', '#8B0707', '#651067', '#329262', '#5574A6', '#3B3EAC'],
    t10: ['#4C78A8', '#F58518', '#E45756', '#72B7B2', '#54A24B', '#EECA3B', '#B279A2', '#FF9DA6', '#9D755D', '#BAB0AC']
};

/** 主题预设（与后端 THEME_LIGHT / THEME_DARK 对应） */
var _THEME_PRESETS = {
    light: {
        plot_bgcolor: '#FAFAFA',
        paper_bgcolor: '#FFFFFF',
        font: { color: '#333333' },
        gridcolor: '#E5E5E5'
    },
    dark: {
        plot_bgcolor: '#0d1525',
        paper_bgcolor: '#0d1525',
        font: { color: '#E8EDF4' },
        gridcolor: 'rgba(255,255,255,0.06)'
    }
};

/**
 * 将主题实时应用到当前 Plotly 图表（不重新请求后端）
 */
function _applyChartTheme(themeName) {
    var chartEl = document.getElementById('plotly-chart');
    if (!chartEl || typeof Plotly === 'undefined') return;
    var theme = _THEME_PRESETS[themeName] || _THEME_PRESETS['light'];
    Plotly.relayout(chartEl, {
        'plot_bgcolor': theme.plot_bgcolor,
        'paper_bgcolor': theme.paper_bgcolor,
        'font.color': theme.font.color,
        'xaxis.gridcolor': theme.gridcolor,
        'yaxis.gridcolor': theme.gridcolor,
        'xaxis.zerolinecolor': theme.gridcolor,
        'yaxis.zerolinecolor': theme.gridcolor
    });
}

/**
 * 将配色方案实时应用到当前 Plotly 图表的 trace 颜色（不重新请求后端）
 * 对 scatter/line/bar 改 trace marker.color 或 line.color
 * 对 pie 改 marker.colors（整个序列）
 */
function _applyChartColorScheme(schemeName) {
    var chartEl = document.getElementById('plotly-chart');
    if (!chartEl || typeof Plotly === 'undefined') return;
    var colors = _COLOR_PALETTES[schemeName] || _COLOR_PALETTES['d3'];
    var plotType = document.getElementById('plot-type').value;

    if (plotType === 'pie') {
        Plotly.restyle(chartEl, { 'marker.colors': [colors] });
    } else if (plotType === 'bar') {
        var nTraces = chartEl.data ? chartEl.data.length : 0;
        for (var i = 0; i < nTraces; i++) {
            Plotly.restyle(chartEl, { 'marker.color': colors[i % colors.length] }, [i]);
        }
    } else {
        // scatter / line
        Plotly.restyle(chartEl, { 'marker.color': colors[0] });
        if (plotType === 'line') {
            Plotly.restyle(chartEl, { 'line.color': colors[0] });
        }
    }
}

// 主题选择器事件
var themeSelect = document.getElementById('plot-theme');
if (themeSelect) {
    themeSelect.addEventListener('change', function () {
        _applyChartTheme(this.value);
        _scheduleImageCapture();
    });
}

// 配色选择器事件
var colorSchemeSelect = document.getElementById('plot-color-scheme');
if (colorSchemeSelect) {
    colorSchemeSelect.addEventListener('change', function () {
        _applyChartColorScheme(this.value);
        _scheduleImageCapture();
    });
}

// ================================================================
// 2. 生成图表
// ================================================================

/**
 * 根据用户配置生成图表并渲染到页面。
 *
 * @param {string} datasetId - 当前数据集 ID
 * @returns {Promise<object|undefined>} 成功时返回 { plotly_json }，失败返回 undefined
 */
async function handlePlot(datasetId) {
    try {
        // 1. 获取用户选择的值
        const xCol = document.getElementById('plot-x').value.trim();
        const yCol = document.getElementById('plot-y').value.trim();
        const plotType = document.getElementById('plot-type').value.trim();

        // 简单校验
        if (!xCol || !yCol || !plotType) {
            alert('请选择 X 轴、Y 轴和图表类型！');
            return;
        }

        const container = document.getElementById('plot-container');
        container.style.display = 'block';

        // 保存 chart 容器引用（必须在覆盖 innerHTML 之前）
        let chartDiv = document.getElementById('plotly-chart');
        if (!chartDiv) {
            chartDiv = document.createElement('div');
            chartDiv.id = 'plotly-chart';
        }

        // 显示加载状态
        container.innerHTML = '<div class="text-center py-8"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">加载中...</span></div><p class="mt-2">正在生成图表...</p></div>';

        // 2. 构建请求体（含自定义参数）
        const body = {
            dataset_id: datasetId,
            x: xCol,
            y: yCol,
            type: plotType
        };

        // ====== 通用参数 ======
        const titleEl = document.getElementById('plot-title');
        if (titleEl) { const v = titleEl.value.trim(); if (v) body.title = v; }

        const labelXEl = document.getElementById('plot-label-x');
        if (labelXEl) { const v = labelXEl.value.trim(); if (v) body.axis_label_x = v; }

        const labelYEl = document.getElementById('plot-label-y');
        if (labelYEl) { const v = labelYEl.value.trim(); if (v) body.axis_label_y = v; }

        const colorSchemeEl = document.getElementById('plot-color-scheme');
        if (colorSchemeEl && colorSchemeEl.value !== 'd3') body.color_scheme = colorSchemeEl.value;

        const themeEl = document.getElementById('plot-theme');
        if (themeEl && themeEl.value !== 'light') body.theme = themeEl.value;

        // ====== 散点图 ======
        if (plotType === 'scatter') {
            const opacityEl = document.getElementById('plot-opacity');
            if (opacityEl) { const v = parseFloat(opacityEl.value); if (v !== 0.8) body.opacity = v; }

            const markerSizeEl = document.getElementById('plot-marker-size');
            if (markerSizeEl) { const v = parseInt(markerSizeEl.value, 10); if (v !== 12) body.marker_size = v; }
        }

        // ====== 折线图 ======
        if (plotType === 'line') {
            const markerSizeEl = document.getElementById('plot-marker-size');
            if (markerSizeEl) { const v = parseInt(markerSizeEl.value, 10); if (v !== 10) body.marker_size = v; }

            const lineWidthEl = document.getElementById('plot-line-width');
            if (lineWidthEl) { const v = parseInt(lineWidthEl.value, 10); if (v !== 3) body.line_width = v; }

            const showMarkersEl = document.getElementById('plot-show-markers');
            if (showMarkersEl && !showMarkersEl.checked) body.show_markers = false;

            const fillAreaEl = document.getElementById('plot-fill-area');
            if (fillAreaEl && !fillAreaEl.checked) body.fill_area = false;
        }

        // ====== 柱状图 ======
        if (plotType === 'bar') {
            const aggregationEl = document.getElementById('plot-aggregation');
            if (aggregationEl && aggregationEl.value !== 'mean') body.aggregation = aggregationEl.value;

            const legendEl = document.getElementById('plot-show-legend');
            if (legendEl && legendEl.checked) body.show_legend = true;
        }

        // ====== 饼图 ======
        if (plotType === 'pie') {
            const pieHoleEl = document.getElementById('plot-hole');
            if (pieHoleEl) { const v = parseFloat(pieHoleEl.value); if (v !== 0.3) body.pie_hole = v; }

            const maxCatEl = document.getElementById('plot-pie-max-categories');
            if (maxCatEl) { const v = parseInt(maxCatEl.value, 10); if (v !== 10) body.pie_max_categories = v; }

            const legendEl = document.getElementById('plot-show-legend');
            if (legendEl && !legendEl.checked) body.show_legend = false;

            const textPosEl = document.getElementById('plot-text-position');
            if (textPosEl && textPosEl.value !== 'inside') body.text_position = textPosEl.value;
        }

        // 3. 发送请求到后端 /plot
        console.log('plot 请求参数:', body);
        const response = await fetch('/plot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const result = await response.json();

        // 请求失败
        if (result.status === 'error') {
            console.error('图表生成失败（后端）:', result.message);
            container.innerHTML = '<div class="alert alert-danger text-center py-4">生成图表失败：' + result.message + '</div>';
            return;
        }

        const data = result.data;

        // 3. 使用 Plotly 渲染交互式图表
        if (data.plotly_json) {
            try {
                // 解析 Plotly JSON
                const plotlyData = JSON.parse(data.plotly_json);

                // 复用 #plotly-chart 容器（保持 id 稳定，供 app.js 截图用）
                chartDiv.style.width = '100%';
                chartDiv.style.height = '450px';

                container.innerHTML = '';
                container.appendChild(chartDiv);

                // 使用 Plotly.react 更新或创建图表
                currentPlotInstance = await Plotly.react(
                    chartDiv,
                    plotlyData.data,
                    plotlyData.layout,
                    {
                        responsive: true,
                        displayModeBar: true,
                        displaylogo: false
                    }
                );

            } catch (parseError) {
                console.error('Plotly JSON 解析失败:', parseError);
                container.innerHTML = '<div class="alert alert-danger text-center py-4">图表数据解析失败</div>';
                return;
            }
        } else {
            container.innerHTML = '<div class="alert alert-warning text-center py-4">后端未返回有效的图表数据</div>';
            return;
        }

        // 返回数据供 app.js 做历史记录等后续处理
        return data;

    } catch (err) {
        console.error('图表请求异常：', err);
        const container = document.getElementById('plot-container');
        container.style.display = 'block';
        container.innerHTML = '<div class="alert alert-danger text-center py-4">网络错误或服务异常，请稍后重试</div>';
    }
}

// 初始加载时根据默认图表类型（scatter）设置控件可见性
_updateCustomParamVisibility('scatter');
