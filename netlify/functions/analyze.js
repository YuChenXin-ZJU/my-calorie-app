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
                model: "qwen-vl-plus",
                input: {
                    messages: [
                        {
                            role: "user",
                            content: [
                                {
                                    image: dataUrl
                                },
                                {
                                    text: "请分析这张图片中的食物，如果图片中包含食物，请详细描述食物的种类、估算的重量，并计算总卡路里。请以JSON格式返回，包含以下字段：\n- isFood: 是否包含食物(boolean)\n- foods: 食物列表，每个食物包含name(名称)、weight(重量,克)、calories(卡路里)\n- totalCalories: 总卡路里\n- description: 详细描述\n\n如果不是食物图片，请设置isFood为false，并在description中说明图片内容。"
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
        
        // 尝试解析JSON响应
        let analysisResult;
        try {
            // 尝试从响应中提取JSON - 处理代码块包装的情况
            let jsonText = extractedText;
            
            // 移除markdown代码块标记
            jsonText = jsonText.replace(/```json\s*/g, '').replace(/```\s*/g, '');
            
            // 尝试找到JSON对象
            const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                // 清理JSON中的注释
                let cleanJson = jsonMatch[0];
                cleanJson = cleanJson.replace(/\/\/[^\n\r]*/g, ''); // 移除单行注释
                cleanJson = cleanJson.replace(/\/\*[\s\S]*?\*\//g, ''); // 移除多行注释
                
                console.log('清理后的JSON:', cleanJson);
                analysisResult = JSON.parse(cleanJson);
            } else {
                throw new Error('未找到有效的JSON格式');
            }
        } catch (parseError) {
            console.log('JSON解析失败，使用文本响应:', parseError.message);
            // 如果JSON解析失败，创建默认结构
            analysisResult = {
                isFood: extractedText.toLowerCase().includes('食物') || extractedText.toLowerCase().includes('food'),
                foods: [],
                totalCalories: 0,
                description: extractedText
            };
        }
        
        console.log('最终分析结果:', analysisResult);
        
        // 确保返回的结果包含所有必需字段
        const finalResult = {
            isFood: analysisResult.isFood || false,
            foods: analysisResult.foods || [],
            totalCalories: analysisResult.totalCalories || 0,
            description: analysisResult.description || extractedText
        };

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
