// renderer.js

// 获取 DOM 元素
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const previewContainer = document.getElementById('previewContainer');
const previewImage = document.getElementById('previewImage');
const analyzeBtn = document.getElementById('analyzeBtn');
const resultContent = document.getElementById('resultContent');
const loading = document.getElementById('loading');

let selectedFile = null;

/**
 * 自动检测部署平台并返回正确的API URL
 * @returns {string} API端点URL
 */
function getApiUrl() {
    // 检测是否为Netlify部署
    if (window.location.hostname.includes('netlify.app')) {
        return '/.netlify/functions/analyze';
    }
    // 默认为Vercel部署
    return '/api/analyze';
}

/**
 * 统一处理文件（点击选择或拖拽）
 * @param {File} file 
 */
function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) {
        alert('请选择一个有效的图片文件 (JPG, PNG, GIF等)');
        return;
    }

    // 检查文件大小（10MB限制）
    if (file.size > 10 * 1024 * 1024) {
        alert('图片文件太大，请选择小于10MB的图片');
        return;
    }
    
    console.log('选择的文件:', file.name, file.type, file.size);
    selectedFile = file;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        console.log('文件读取成功');
        
        // 设置图片预览源，并等待加载完成
        previewImage.src = e.target.result;
        previewImage.onload = () => {
            previewContainer.classList.add('show');
            analyzeBtn.disabled = false;
            console.log('图片预览显示成功');
        };
        
        previewImage.onerror = () => {
            console.error('预览图片加载失败');
            alert('图片预览失败，文件可能已损坏或格式不支持。');
        };
        
        // 清空之前的结果
        resultContent.innerHTML = `
            <div class="result-empty">
                <div class="result-empty-icon">🤖</div>
                <div>点击"开始分析"按钮进行AI分析...</div>
            </div>`;
    };
    
    reader.onerror = (error) => {
        console.error('文件读取失败:', error);
        alert('文件读取失败，请重新选择图片');
    };
    
    reader.readAsDataURL(file);
}

// 文件选择后处理
fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    handleFile(file);
});

// 拖拽上传功能
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    
    const file = e.dataTransfer.files[0];
    handleFile(file);
});

// 分析按钮点击事件
analyzeBtn.addEventListener('click', async () => {
    if (!selectedFile) {
        alert('请先选择一张图片');
        return;
    }

    // 显示加载状态
    loading.classList.add('show');
    analyzeBtn.disabled = true;
    resultContent.innerHTML = '<div class="result-empty">正在分析中...</div>';

    try {
        const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                resolve(event.target.result);
            };
            reader.onerror = (error) => reject(error);
            reader.readAsDataURL(selectedFile);
        });

        // 调用后端 API 分析图片
        const apiUrl = getApiUrl();
        console.log('使用API端点:', apiUrl);
        
        const apiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ dataUrl }),
        });

        if (!apiResponse.ok) {
            const errorData = await apiResponse.json().catch(() => ({}));
            const errorMessage = errorData.error || `请求失败，状态码: ${apiResponse.status}`;
            throw new Error(errorMessage);
        }

        const data = await apiResponse.json();
        console.log('收到的响应:', data);
        
        // 修正：从API响应中正确提取result对象
        const response = data.result;
        
        // 隐藏加载状态
        loading.classList.remove('show');
        analyzeBtn.disabled = false;

        // 检查响应格式
        if (!response) {
            throw new Error('API响应中缺少result字段');
        }

        console.log('解析后的响应:', response);

        // 检查是否为食物
        if (response.isFood) {
            // 显示分析结果
            const calories = response.totalCalories || 0;
            const description = response.description || '无详细信息';
            
            resultContent.innerHTML = `
                <div class="result-success">
                    <div class="result-header">
                        <div class="result-icon">🍽️</div>
                        <div>
                            <h3>分析完成！</h3>
                            <p>检测到食物，营养分析如下：</p>
                        </div>
                    </div>
                    <div class="calories-display">
                        <div class="calories-number">${calories}</div>
                        <div class="calories-unit">千卡 (kcal)</div>
                    </div>
                    <div class="analysis-details">
                        <h4>详细分析：</h4>
                        <div class="description-text">${description.replace(/\n/g, '<br>')}</div>
                    </div>
                </div>
            `;
        } else {
            // 非食物情况
            resultContent.innerHTML = `
                <div class="result-warning">
                    <div class="result-header">
                        <div class="result-icon">⚠️</div>
                        <div>
                            <h3>未检测到食物</h3>
                            <p>这张图片中没有识别出可分析的食物。</p>
                        </div>
                    </div>
                    <div class="analysis-details">
                        <p><strong>AI分析结果：</strong></p>
                        <div class="description-text">${(response.description || '无法识别图片内容').replace(/\n/g, '<br>')}</div>
                    </div>
                </div>
            `;
        }

    } catch (error) {
        // 隐藏加载状态
        loading.classList.remove('show');
        analyzeBtn.disabled = false;

        console.error('分析失败:', error);
        
        let errorMessage = '分析失败';
        if (error.message) {
            errorMessage = error.message;
        }
        
        resultContent.innerHTML = `
            <div class="result-error">
                <div class="result-header">
                    <div class="result-icon">❌</div>
                    <div>
                        <h3>分析失败</h3>
                        <p>${errorMessage}</p>
                        <small>请检查网络连接和API配置</small>
                    </div>
                </div>
            </div>
        `;
    }
});

/**
 * 格式化营养成分显示
 */
function formatNutrients(foods) {
    if (!foods || foods.length === 0) {
        return '<p>暂无详细营养数据</p>';
    }
    
    let html = '<div class="nutrients-grid">';
    foods.forEach(food => {
        html += `
            <div class="food-item">
                <h5>${food.name}</h5>
                <div class="nutrients">
                    <span>热量: ${food.calories || 0} kcal</span>
                    <span>蛋白质: ${food.protein || 0}g</span>
                    <span>碳水: ${food.carbs || 0}g</span>
                    <span>脂肪: ${food.fat || 0}g</span>
                </div>
            </div>
        `;
    });
    html += '</div>';
    return html;
}

// 页面加载完成后的初始化
document.addEventListener('DOMContentLoaded', () => {
    console.log('页面加载完成');
    
    // 初始化结果区域
    resultContent.innerHTML = `
        <div class="result-empty">
            <div class="result-empty-icon">📸</div>
            <div>请先上传一张食物图片...</div>
        </div>
    `;
    
    // 初始状态下禁用分析按钮
    analyzeBtn.disabled = true;
});
