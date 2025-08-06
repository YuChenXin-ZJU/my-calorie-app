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
            // 显示美化后的分析结果
            const calories = response.totalCalories || 0;
            const description = response.description || '无详细信息';
            
            // 解析并美化显示
            const formattedResult = formatAnalysisResult(description, calories);
            
            resultContent.innerHTML = `
                <div class="result-success">
                    <div class="result-header">
                        <div class="result-icon">🍽️</div>
                        <div>
                            <h3>分析完成！</h3>
                            <p>AI已识别出您的美食，营养分析如下：</p>
                        </div>
                    </div>
                    <div class="calories-display">
                        <div class="calories-number">${calories}</div>
                        <div class="calories-unit">千卡 (kcal)</div>
                        <div class="calories-label">总热量</div>
                    </div>
                    ${formattedResult}
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
 * 格式化AI分析结果为美观的HTML显示
 */
function formatAnalysisResult(description, totalCalories) {
    const sections = description.split('【');
    let foodIdentification = '';
    let nutritionAnalysis = '';
    let totalNutrition = '';
    
    sections.forEach(section => {
        if (section.startsWith('食物识别】')) {
            foodIdentification = section.replace('食物识别】\n', '').split('【')[0].trim();
        } else if (section.startsWith('营养分析】')) {
            nutritionAnalysis = section.replace('营养分析】\n', '').split('【')[0].trim();
        } else if (section.startsWith('总计】')) {
            totalNutrition = section.replace('总计】\n', '').split('【')[0].trim();
        }
    });
    
    let html = '';
    
    // 合并营养分析 - 只显示一个区域
    if (nutritionAnalysis && foodIdentification) {
        html += `
            <div class="analysis-section">
                <h4><span class="section-icon">📊</span> 营养分析</h4>
                <div class="nutrition-grid">
                    ${formatCombinedNutritionItems(foodIdentification, nutritionAnalysis)}
                </div>
            </div>
        `;
    }
    
    // 营养总计部分
    if (totalNutrition) {
        html += `
            <div class="analysis-section">
                <h4><span class="section-icon">📈</span> 营养总计</h4>
                <div class="nutrition-summary">
                    ${formatNutritionSummary(totalNutrition)}
                </div>
            </div>
        `;
    }
    
    return html;
}

/**
 * 合并格式化食物识别和营养分析
 */
function formatCombinedNutritionItems(foodText, nutritionText) {
    // 解析食物识别数据
    const foodItems = foodText.split('\n').filter(line => line.trim().startsWith('-'));
    const nutritionItems = nutritionText.split('\n').filter(line => line.trim().startsWith('-'));
    
    // 创建食物名称到营养信息的映射
    const nutritionMap = {};
    nutritionItems.forEach(item => {
        const cleanItem = item.replace(/^-\s*/, '').trim();
        const parts = cleanItem.split(':');
        if (parts.length >= 2) {
            const foodName = parts[0].trim();
            const nutrition = parts[1].trim();
            nutritionMap[foodName] = nutrition;
        }
    });
    
    return foodItems.map(item => {
        const cleanItem = item.replace(/^-\s*/, '').trim();
        const parts = cleanItem.split(':');
        if (parts.length >= 2) {
            const type = parts[0].trim();
            const amount = parts[1].trim();
            const emoji = getFoodEmoji(type, amount);
            
            // 查找对应的营养信息
            let nutritionInfo = '';
            const matchingNutrition = nutritionMap[type];
            if (matchingNutrition) {
                // 解析营养成分
                const nutritionParts = matchingNutrition.split(',').map(n => n.trim());
                let nutritionHtml = '';
                nutritionParts.forEach(part => {
                    if (part.includes('热量')) {
                        const calories = part.match(/(\d+)\s*kcal/);
                        if (calories) {
                            nutritionHtml += `<span class="nutrition-item calories">🔥 ${calories[1]}kcal</span>`;
                        }
                    } else if (part.includes('蛋白质')) {
                        nutritionHtml += `<span class="nutrition-item protein">💪 ${part}</span>`;
                    } else if (part.includes('碳水')) {
                        nutritionHtml += `<span class="nutrition-item carbs">🌾 ${part}</span>`;
                    } else if (part.includes('脂肪')) {
                        nutritionHtml += `<span class="nutrition-item fat">🥑 ${part}</span>`;
                    }
                });
                nutritionInfo = nutritionHtml;
            }
            
            return `
                <div class="nutrition-card">
                    <div class="nutrition-header">
                        <span class="food-emoji">${emoji}</span>
                        <div class="food-info">
                            <strong>${type}</strong>
                            <span class="food-amount">${amount}</span>
                        </div>
                    </div>
                    <div class="nutrition-details">
                        ${nutritionInfo}
                    </div>
                </div>
            `;
        }
        return '';
    }).filter(item => item).join('');
}

/**
 * 格式化食物识别项目
 */
function formatFoodItems(foodText) {
    const items = foodText.split('\n').filter(line => line.trim().startsWith('-'));
    return items.map(item => {
        const cleanItem = item.replace(/^-\s*/, '').trim();
        const parts = cleanItem.split(':');
        if (parts.length >= 2) {
            const type = parts[0].trim();
            const details = parts[1].trim();
            const emoji = getFoodEmoji(type, details);
            return `
                <div class="food-item">
                    <span class="food-emoji">${emoji}</span>
                    <div class="food-details">
                        <strong>${type}:</strong> ${details}
                    </div>
                </div>
            `;
        }
        return `<div class="food-item">${cleanItem}</div>`;
    }).join('');
}

/**
 * 格式化营养分析项目
 */
function formatNutritionItems(nutritionText) {
    const items = nutritionText.split('\n').filter(line => line.trim().startsWith('-'));
    return items.map(item => {
        const cleanItem = item.replace(/^-\s*/, '').trim();
        const parts = cleanItem.split(':');
        if (parts.length >= 2) {
            const foodName = parts[0].trim();
            const nutrition = parts[1].trim();
            const emoji = getFoodEmoji('', foodName);
            
            // 解析营养成分
            const nutritionParts = nutrition.split(',').map(n => n.trim());
            let nutritionHtml = '';
            nutritionParts.forEach(part => {
                if (part.includes('热量')) {
                    nutritionHtml += `<span class="nutrition-item calories">🔥 ${part}</span>`;
                } else if (part.includes('蛋白质')) {
                    nutritionHtml += `<span class="nutrition-item protein">💪 ${part}</span>`;
                } else if (part.includes('碳水')) {
                    nutritionHtml += `<span class="nutrition-item carbs">🌾 ${part}</span>`;
                } else if (part.includes('脂肪')) {
                    nutritionHtml += `<span class="nutrition-item fat">🥑 ${part}</span>`;
                } else {
                    nutritionHtml += `<span class="nutrition-item">${part}</span>`;
                }
            });
            
            return `
                <div class="nutrition-card">
                    <div class="nutrition-header">
                        <span class="food-emoji">${emoji}</span>
                        <strong>${foodName}</strong>
                    </div>
                    <div class="nutrition-details">
                        ${nutritionHtml}
                    </div>
                </div>
            `;
        }
        return `<div class="nutrition-card">${cleanItem}</div>`;
    }).join('');
}

/**
 * 格式化营养总计
 */
function formatNutritionSummary(totalText) {
    const items = totalText.split('\n').filter(line => line.trim().startsWith('-'));
    return items.map(item => {
        const cleanItem = item.replace(/^-\s*/, '').trim();
        if (cleanItem.includes('总热量')) {
            return `<div class="summary-item calories-total">🔥 ${cleanItem}</div>`;
        } else if (cleanItem.includes('总蛋白质')) {
            return `<div class="summary-item protein-total">💪 ${cleanItem}</div>`;
        } else if (cleanItem.includes('总碳水')) {
            return `<div class="summary-item carbs-total">🌾 ${cleanItem}</div>`;
        } else if (cleanItem.includes('总脂肪')) {
            return `<div class="summary-item fat-total">🥑 ${cleanItem}</div>`;
        } else {
            return `<div class="summary-item">${cleanItem}</div>`;
        }
    }).join('');
}

/**
 * 根据食物类型获取对应的emoji
 */
function getFoodEmoji(type, details) {
    const text = (type + ' ' + details).toLowerCase();
    
    if (text.includes('肉') || text.includes('鸡') || text.includes('猪') || text.includes('牛')) return '🥩';
    if (text.includes('米饭') || text.includes('饭')) return '🍚';
    if (text.includes('面') || text.includes('粉')) return '🍜';
    if (text.includes('蔬菜') || text.includes('生菜') || text.includes('青菜')) return '🥬';
    if (text.includes('汤') || text.includes('汤水')) return '🍲';
    if (text.includes('水') || text.includes('饮料')) return '💧';
    if (text.includes('蛋') || text.includes('鸡蛋')) return '🥚';
    if (text.includes('豆') || text.includes('豆干')) return '🫘';
    if (text.includes('炸') || text.includes('油炸')) return '🍗';
    if (text.includes('卤') || text.includes('卤味')) return '🍖';
    if (text.includes('果') || text.includes('水果')) return '🍎';
    if (text.includes('菜品')) return '🍽️';
    if (text.includes('饮料')) return '🥤';
    
    return '🍽️'; // 默认emoji
}

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
