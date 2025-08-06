const axios = require('axios');

/**
 * Netlify Functions处理器
 * @param {Object} event - Netlify函数事件对象
 * @param {Object} context - Netlify函数上下文对象
 * @returns {Object} HTTP响应对象
 */
exports.handler = async (event, context) => {
    // 设置CORS头
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // 处理OPTIONS预检请求
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    // 只处理POST请求
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: '只支持POST方法' })
        };
    }

    try {
        console.log('Netlify函数开始处理请求');
        
        // 解析请求体
        const { dataUrl } = JSON.parse(event.body);
        
        if (!dataUrl) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: '缺少图片数据' })
            };
        }

        console.log('准备调用Qwen API');

        // 从环境变量获取API密钥
        const apiKey = process.env.QWEN_API_KEY;
        if (!apiKey) {
            console.error('QWEN_API_KEY环境变量未设置');
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: '服务器配置错误：API密钥未设置' })
            };
        }

        // 调用Qwen API
        const response = await axios.post(
            'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
            {
                model: "qwen-vl-max",
                input: {
                    messages: [
                        {
                            role: "user",
                            content: [
                                {
                                    image: dataUrl
                                },
                                {
                                    text: '你是一位顶级的营养分析师。请严格按照下面的【输出格式示例】，分析图片中的所有食物和饮料，并提供精确的营养估算。\n\n' +
                                    '【输出格式示例】\n' +
                                    '【食物识别】\n' +
                                    '- 菜品1: 红烧肉, 约150g\n' +
                                    '- 菜品2: 米饭, 约200g\n' +
                                    '- 饮料1: 橙汁, 约300ml\n\n' +
                                    '【营养分析】\n' +
                                    '- 红烧肉: 热量: 595 kcal, 蛋白质: 15g, 碳水: 5g, 脂肪: 58g\n' +
                                    '- 米饭: 热量: 260 kcal, 蛋白质: 5g, 碳水: 58g, 脂肪: 1g\n' +
                                    '- 橙汁: 热量: 135 kcal, 蛋白质: 2g, 碳水: 30g, 脂肪: 0g\n\n' +
                                    '【总计】\n' +
                                    '- 总热量: 990 kcal\n' +
                                    '- 总蛋白质: 22g\n' +
                                    '- 总碳水化合物: 93g\n' +
                                    '- 总脂肪: 59g\n\n' +
                                    '【分析要求】\n' +
                                    '1.  **全面识别**：不要遗漏任何食物、饮料、酱料或配菜。\n' +
                                    '2.  **精确估算**：根据视觉信息合理估算每项的重量(g)或容量(ml)。\n' +
                                    '3.  **考虑烹饪**：评估烹饪方式（如炒、炸、蒸）对营养的影响。\n' +
                                    '4.  **处理未知**：如果无法识别，请在对应位置标注为"未知物品"。\n' +
                                    '5.  **严格格式**：最终输出必须严格遵守【输出格式示例】，不要添加任何额外的解释或说明文字。'
                                }
                            ]
                        }
                    ]
                },
                parameters: {
                    result_format: "message"
                }
            },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 50000 // 50秒超时
            }
        );

        console.log('Qwen API调用成功');

        const qwenResult = response.data;
        
        if (!qwenResult.output || !qwenResult.output.choices || qwenResult.output.choices.length === 0) {
            throw new Error('Qwen API返回数据格式错误');
        }

        const content = qwenResult.output.choices[0].message.content;
        let extractedText = '';
        
        // 处理不同格式的响应内容
        if (Array.isArray(content)) {
            extractedText = content.filter(item => item.text).map(item => item.text).join('\n');
        } else if (typeof content === 'string') {
            extractedText = content;
        } else {
            console.error("API返回内容格式异常:", content);
            throw new Error('API返回内容格式异常');
        }
        
        console.log('原始API响应内容:', extractedText);
        
        // 由于使用了营养分析师提示词，返回的是格式化文本而不是JSON
        // 创建默认结构并将文本作为description
        const analysisResult = {
            isFood: extractedText.toLowerCase().includes('食物') || 
                   extractedText.toLowerCase().includes('菜品') || 
                   extractedText.toLowerCase().includes('热量') ||
                   extractedText.toLowerCase().includes('kcal'),
            foods: [],
            totalCalories: 0,
            description: extractedText
        };
        
        // 尝试从文本中提取总热量
        const calorieMatch = extractedText.match(/总热量[：:]\s*(\d+)\s*kcal/i);
        if (calorieMatch) {
            analysisResult.totalCalories = parseInt(calorieMatch[1]);
        }
        
        console.log('最终分析结果:', analysisResult);
        
        // 确保返回的结果包含所有必需字段
        const finalResult = {
            isFood: analysisResult.isFood || false,
            foods: analysisResult.foods || [],
            totalCalories: analysisResult.totalCalories || 0,
            description: analysisResult.description || extractedText
        };
        
        // 再次确保description是字符串
        if (Array.isArray(finalResult.description)) {
            finalResult.description = finalResult.description.map(item => item.text || '').join('\n');
        }

        console.log('最终分析结果:', finalResult);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                result: finalResult,
                timestamp: new Date().toISOString()
            })
        };

    } catch (error) {
        console.error('处理请求时出错:', error);
        
        let errorMessage = '服务器内部错误';
        let statusCode = 500;
        
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
            errorMessage = 'API请求超时，请重试';
            statusCode = 504;
        } else if (error.response) {
            statusCode = error.response.status;
            errorMessage = `API调用失败: ${error.response.statusText}`;
            if (error.response.data && error.response.data.message) {
                errorMessage += ` - ${error.response.data.message}`;
            }
        } else if (error.message) {
            errorMessage = error.message;
        }

        return {
            statusCode,
            headers,
            body: JSON.stringify({
                success: false,
                error: errorMessage,
                timestamp: new Date().toISOString()
            })
        };
    }
};
