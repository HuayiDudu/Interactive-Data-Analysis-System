/**
 * plot.js - 可视化模块前端逻辑
 * ====================================
 * 【负责人】可视化模块开发人员
 * 【依赖】如果使用 Plotly 方案，需在 index.html 中引入 Plotly.js CDN
 *
 * 暴露给 Web 界面模块的接口:
 *   - populatePlotColumns(columns, dtypes) → 填充 X/Y 轴列选择下拉框
 *   - handlePlot(datasetId)        → 生成图表并渲染
 *
 * 【实现要求】
 * - 仅调用控制层 HTTP API (/plot)
 * - 支持 Matplotlib base64 和 Plotly JSON 两种返回格式
 */

// ================================================================
// 1. 填充列选择下拉框
// ================================================================

/**
 * 将数据集列名填充到 X 轴和 Y 轴的下拉框中。
 *
 * @param {string[]} columns - 所有列名
 * @param {object} dtypes - 列类型信息 {列名: 类型}
 *
 * 【实现步骤】
 * 1. 根据图表类型区分数值列和分类列
 * 2. 清空 #plot-x 和 #plot-y 的现有选项
 * 3. 对于饼图：X轴填充分类列，Y轴填充数值列
 * 4. 对于其他图表：两个都填充数值列
 */
function populatePlotColumns(columns, dtypes = {}) {
    // 获取下拉框元素
    const xSelect = document.getElementById('plot-x');
    const ySelect = document.getElementById('plot-y');
    const plotType = document.getElementById('plot-type').value;

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
}

// ================================================================
// 图表类型切换事件
// ================================================================
document.getElementById('plot-type').addEventListener('change', function() {
    // 当图表类型改变时，重新填充列选择
    // 注意：currentColumns 和 currentDtypes 由 app.js 定义
    if (typeof populatePlotColumns === 'function' && typeof currentColumns !== 'undefined' && currentColumns.length > 0) {
        populatePlotColumns(currentColumns, currentDtypes);
    }
});

// ================================================================
// 2. 生成图表
// ================================================================

/**
 * 根据用户配置生成图表并渲染到页面。
 *
 * @param {string} datasetId - 当前数据集 ID
 * @returns {Promise<void>}
 * @throws {Error} 生成失败时抛出
 *
 * 【实现步骤】
 * 1. 获取 #plot-x, #plot-y, #plot-type 的值
 * 2. POST /plot 发送 { dataset_id, x, y, type }
 * 3. 根据返回格式渲染:
 *    - image_base64: 在 #plot-container 中插入 <img>
 *    - plotly_json: 使用 Plotly.newPlot() 渲染
 * 4. 显示 #plot-container
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

        // 2. 发送请求到后端 /plot
        const response = await fetch('/plot', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                dataset_id: datasetId,
                x: xCol,
                y: yCol,
                type: plotType
            })
        });

        const result = await response.json();

        // 请求失败
        if (result.status === 'error') {
            alert('生成图表失败：' + result.message);
            return;
        }

        const data = result.data;
        const container = document.getElementById('plot-container');
        container.style.display = 'block';
        container.innerHTML = ''; // 清空旧图表

        // 3. 根据返回类型渲染
        // 情况 A：Matplotlib 返回 base64 图片
        if (data.image_base64) {
            const img = document.createElement('img');
            img.src = 'data:image/png;base64,' + data.image_base64;
            img.style.maxWidth = '100%';
            container.appendChild(img);
        }
        // 情况 B：Plotly 返回 JSON 格式
        else if (data.plotly_json) {
            const plotDiv = document.createElement('div');
            container.appendChild(plotDiv);
            Plotly.newPlot(plotDiv, data.plotly_json.data, data.plotly_json.layout);
        }
        // 无有效数据
        else {
            alert('后端未返回有效的图表数据');
        }

    } catch (err) {
        console.error('图表请求异常：', err);
        alert('网络错误或服务异常，请稍后重试');
    }
}