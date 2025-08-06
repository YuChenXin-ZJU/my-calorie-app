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
        const apiResponse = await fetch('/api/analyze', {
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
        const response = data.result;
        
        // 隐藏加载状态
        loading.classList.remove('show');
        analyzeBtn.disabled = false;
        
        console.log('收到的响应:', response, '类型:', typeof response);
        
        // 显示结果
        if (response && typeof response === 'string' && response.trim() !== '') {
            resultContent.innerHTML = formatAnalysisResult(response);
        } else {
            console.error('Unexpected response:', response);
            // 尝试显示原始响应内容
            let debugInfo = '';
            try {
                debugInfo = JSON.stringify(response, null, 2);
            } catch (e) {
                debugInfo = String(response);
            }
            
            resultContent.innerHTML = `
                <div class="error-message">
                    <strong>⚠️ 响应解析问题</strong><br>
                    收到的响应: ${debugInfo}<br>
                    <small>请检查控制台获取详细信息</small>
                </div>`;
        }
        
    } catch (error) {
        // 隐藏加载状态
        loading.classList.remove('show');
        analyzeBtn.disabled = false;
        
        console.error('File reading or main process call failed:', error);
        resultContent.innerHTML = `
            <div class="error-message">
                <strong>❌ 分析失败</strong><br>
                ${error.message}<br>
                <small>请检查网络连接和API配置</small>
            </div>`;
    }
});

// 格式化分析结果
function formatAnalysisResult(result) {
    if (!result || result.trim() === '') {
        return '<div class="result-empty">未能识别到食物内容</div>';
    }
    
    // 如果结果包含"未识别到食物"
    if (result.includes('未识别到食物') || result.toLowerCase().includes('no food')) {
        return `
            <div style="text-align: center; color: #666; padding: 20px;">
                <div style="font-size: 2em; margin-bottom: 10px;">🤔</div>
                <strong>未识别到食物</strong><br>
                <small>请尝试上传更清晰的食物图片</small>
            </div>`;
    }
    
    // 清理文本，移除markdown格式和多余符号
    let cleanedResult = result
        .replace(/\*\*/g, '') // 移除markdown粗体
        .replace(/\*/g, '') // 移除markdown斜体
        .replace(/- /g, '') // 移除列表符号
        .replace(/#+/g, '') // 移除markdown标题
        .replace(/\n\s*\n\s*\n/g, '\n\n') // 合并多个空行
        .trim();
    
    // 尝试提取结构化内容
    const sections = extractSections(cleanedResult);
    
    if (sections.foods || sections.nutrition || sections.total) {
        return formatStructuredResult(sections);
    }
    
    // 如果无法解析结构化内容，使用简单格式
    return formatSimpleResult(cleanedResult);
}

// 提取各个部分的内容
function extractSections(text) {
    const sections = {
        foods: null,
        nutrition: null,
        total: null
    };
    
    // 提取食物识别部分
    const foodMatch = text.match(/【食物识别】([\s\S]*?)(?=【|$)/);
    if (foodMatch) {
        sections.foods = foodMatch[1].trim();
    }
    
    // 提取营养分析部分
    const nutritionMatch = text.match(/【营养分析】([\s\S]*?)(?=【|$)/);
    if (nutritionMatch) {
        sections.nutrition = nutritionMatch[1].trim();
    }
    
    // 提取总计部分
    const totalMatch = text.match(/【总计】([\s\S]*?)(?=【|补充说明|最终总计|$)/);
    if (totalMatch) {
        sections.total = totalMatch[1].trim();
    }
    
    return sections;
}

// 格式化结构化结果
function formatStructuredResult(sections) {
    let result = '';
    
    // 食物识别部分
    if (sections.foods) {
        result += `
            <div style="margin-bottom: 20px;">
                <h3 style="color: #4f46e5; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                    <span>🍽️</span> 食物识别
                </h3>
                <div style="background: #f8fafc; padding: 15px; border-radius: 8px; border-left: 4px solid #4f46e5;">
                    ${formatFoodItems(sections.foods)}
                </div>
            </div>`;
    }
    
    // 营养分析部分
    if (sections.nutrition) {
        result += `
            <div style="margin-bottom: 20px;">
                <h3 style="color: #059669; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                    <span>📊</span> 营养分析
                </h3>
                <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; border-left: 4px solid #059669;">
                    ${formatNutritionItems(sections.nutrition)}
                </div>
            </div>`;
    }
    
    // 总计部分
    if (sections.total) {
        result += `
            <div style="margin-bottom: 20px;">
                <h3 style="color: #dc2626; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                    <span>🔥</span> 总计
                </h3>
                <div style="background: linear-gradient(135deg, #fef2f2, #fee2e2); padding: 20px; border-radius: 12px; border: 2px solid #dc2626; text-align: center;">
                    ${formatTotalCalories(sections.total)}
                </div>
            </div>`;
    }
    
    return result;
}

// 格式化简单结果（当无法解析结构化内容时）
function formatSimpleResult(text) {
    const lines = text.split('\n').filter(line => line.trim() !== '');
    let result = '<div style="line-height: 1.8;">';
    
    lines.forEach((line) => {
        line = line.trim();
        if (line) {
            if (line.includes('kcal')) {
                result += `
                    <div style="margin: 8px 0; padding: 12px; background: #f0fdf4; border-radius: 8px; border-left: 4px solid #059669; font-weight: 500;">
                        🔥 ${line}
                    </div>`;
            } else if (line.includes(':') || line.includes('：')) {
                // 判断是否为饮料
                const isDrink = line.match(/(饮料|酒|茶|咖啡|水|汽水|果汁|牛奶|啤酒|红酒|白酒|可乐|雪碧|矿泉水|奶茶)/i);
                const icon = isDrink ? '🥤' : '🍽️';
                result += `
                    <div style="margin: 8px 0; padding: 12px; background: #f8fafc; border-radius: 8px; border-left: 4px solid #4f46e5;">
                        ${icon} ${line}
                    </div>`;
            } else {
                result += `<div style="margin: 8px 0; padding: 8px;">${line}</div>`;
            }
        }
    });
    result += '</div>';
    return result;
}

// 格式化食物项目
function formatFoodItems(content) {
    const lines = content.split('\n').filter(line => line.trim() !== '');
    let result = '';
    lines.forEach(line => {
        line = line.trim();
        if (line && (line.includes(':') || line.includes('：'))) {
            // 判断是否为饮料
            const isDrink = line.match(/(饮料|酒|茶|咖啡|水|汽水|果汁|牛奶|啤酒|红酒|白酒|可乐|雪碧|矿泉水|奶茶)/i);
            const icon = isDrink ? '🥤' : '🥘';
            result += `<div style="margin: 6px 0; font-weight: 500;">${icon} ${line}</div>`;
        } else if (line && !line.includes('补充说明') && !line.includes('最终总计') && !line.match(/^\d+\./)) {
            result += `<div style="margin: 6px 0;">${line}</div>`;
        }
    });
    return result || '<div>暂无食物识别信息</div>';
}

// 格式化营养项目
function formatNutritionItems(content) {
    const lines = content.split('\n').filter(line => line.trim() !== '');
    let result = '';
    let currentItem = '';
    
    lines.forEach(line => {
        line = line.trim();
        if (line && !line.includes('补充说明') && !line.includes('最终总计')) {
            if (line.match(/^\d+\./)) {
                // 新的营养项目开始
                if (currentItem) {
                    // 判断是否为饮料项目
                    const isDrink = currentItem.match(/(饮料|酒|茶|咖啡|水|汽水|果汁|牛奶|啤酒|红酒|白酒|可乐|雪碧|矿泉水|奶茶)/i);
                    const icon = isDrink ? '🥤' : '⚡';
                    result += `<div style="margin: 8px 0; padding: 8px; background: white; border-radius: 6px; font-weight: 500;">${icon} ${currentItem}</div>`;
                }
                currentItem = line.replace(/^\d+\.\s*/, ''); // 移除序号
            } else if (line.includes('kcal') || line.includes('蛋白质') || line.includes('碳水') || line.includes('脂肪')) {
                if (currentItem) {
                    currentItem += ` - ${line}`;
                } else {
                    currentItem = line;
                }
            } else if (currentItem && !line.includes('格式：')) {
                currentItem += ` ${line}`;
            }
        }
    });
    
    // 添加最后一个项目
    if (currentItem) {
        const isDrink = currentItem.match(/(饮料|酒|茶|咖啡|水|汽水|果汁|牛奶|啤酒|红酒|白酒|可乐|雪碧|矿泉水|奶茶)/i);
        const icon = isDrink ? '🥤' : '⚡';
        result += `<div style="margin: 8px 0; padding: 8px; background: white; border-radius: 6px; font-weight: 500;">${icon} ${currentItem}</div>`;
    }
    
    return result || '<div>暂无营养分析信息</div>';
}

// 格式化总卡路里
function formatTotalCalories(content) {
    const lines = content.split('\n').filter(line => line.trim() !== '');
    let totalCalories = '';
    let nutrients = '';
    
    lines.forEach(line => {
        line = line.trim();
        if (line && !line.includes('补充说明') && !line.includes('最终总计')) {
            if (line.includes('总卡路里') || line.includes('总热量')) {
                const calorieMatch = line.match(/(\d+)\s*kcal/);
                const calories = calorieMatch ? calorieMatch[1] : '未知';
                totalCalories = `<div style="font-size: 1.8em; font-weight: bold; color: #dc2626; margin-bottom: 15px;">🔥 总卡路里: ${calories} kcal</div>`;
            } else if (line.includes('营养成分') || line.includes('碳水化合物') || line.includes('蛋白质') || line.includes('脂肪')) {
                nutrients += `<div style="font-size: 1em; color: #666; margin: 5px 0;">📋 ${line}</div>`;
            }
        }
    });
    
    return totalCalories + nutrients || '<div>暂无总计信息</div>';
}


// 页面加载完成后可以进行一些初始化检查
window.addEventListener('DOMContentLoaded', () => {
    console.log('Renderer process loaded');
    
    // 检查所有必要的DOM元素是否存在
    const elements = {
        uploadArea,
        fileInput,
        previewContainer,
        previewImage,
        analyzeBtn,
        resultContent,
        loading
    };
    
    for (const [name, element] of Object.entries(elements)) {
        if (!element) {
            console.error(`DOM element not found: ${name}`);
        } else {
            console.log(`DOM element found: ${name}`);
        }
    }
    
    // 确保预览容器初始状态正确
    if (previewContainer) {
        previewContainer.classList.remove('show');
        console.log('Preview container initialized');
    }
    
    // 确保分析按钮初始状态正确
    if (analyzeBtn) {
        analyzeBtn.disabled = true;
        console.log('Analyze button initialized');
    }
});
