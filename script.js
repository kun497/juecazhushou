// API 配置
const API_BASE_URL = 'https://czrf75dfk6.coze.site';

// 消息历史
let messages = [];

// 当前正在接收的消息元素
let currentAssistantMessageElement = null;
let currentAssistantMessageContent = '';

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    // 聚焦输入框
    document.getElementById('messageInput').focus();
});

// 处理键盘事件
function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

// 自动调整文本框高度
function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
}

// 使用示例提示
function useExample(element) {
    const text = element.innerText.trim();
    document.getElementById('messageInput').value = text;
    document.getElementById('messageInput').focus();
    sendMessage();
}

// 发送消息
async function sendMessage() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();

    if (!message) return;

    // 清空输入框
    input.value = '';
    input.style.height = 'auto';

    // 添加用户消息到界面
    addUserMessage(message);
    messages.push({ role: 'user', content: message });

    // 移除欢迎消息
    removeWelcomeMessage();

    // 显示加载指示器
    showLoading();

    try {
        // 发送请求到后端 API
        await streamResponse(messages);
    } catch (error) {
        console.error('发送消息失败:', error);
        showError('发送失败，请检查服务是否正常运行');
        hideLoading();
    }
}

// 添加用户消息
function addUserMessage(message) {
    const chatContainer = document.getElementById('chatContainer');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user-message';
    messageDiv.innerHTML = `
        <div class="message-bubble">${escapeHtml(message)}</div>
    `;
    chatContainer.appendChild(messageDiv);
    scrollToBottom();
}

// 添加助手消息（流式）
function addAssistantMessage() {
    const chatContainer = document.getElementById('chatContainer');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant-message';
    messageDiv.innerHTML = `
        <div class="avatar"><i class="fas fa-moon"></i></div>
        <div class="message-content">
            <div class="message-bubble"></div>
        </div>
    `;
    chatContainer.appendChild(messageDiv);
    currentAssistantMessageElement = messageDiv.querySelector('.message-bubble');
    currentAssistantMessageContent = '';
    scrollToBottom();
    return messageDiv;
}

// 流式响应处理
async function streamResponse(messages) {
    const response = await fetch(`${API_BASE_URL}/stream_run`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages: messages })
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    // 创建助手消息元素
    addAssistantMessage();
    hideLoading();

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // 解码数据
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        // 处理 SSE 格式的数据
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data.trim() === '') continue;

                try {
                    const json = JSON.parse(data);
                    // 处理不同类型的消息
                    if (json.type === 'answer' && json.content && json.content.answer) {
                        currentAssistantMessageContent += json.content.answer;
                        currentAssistantMessageElement.innerHTML = formatMessage(currentAssistantMessageContent);
                        scrollToBottom();
                    }
                    // 兼容旧格式
                    else if (json.content && typeof json.content === 'string') {
                        currentAssistantMessageContent += json.content;
                        currentAssistantMessageElement.innerHTML = formatMessage(currentAssistantMessageContent);
                        scrollToBottom();
                    }
                } catch (e) {
                    console.error('解析数据失败:', e, data);
                }
            }
        }
    }

    // 添加到消息历史
    messages.push({
        role: 'assistant',
        content: currentAssistantMessageContent
    });

    currentAssistantMessageElement = null;
    currentAssistantMessageContent = '';
}

// 格式化消息内容
function formatMessage(content) {
    // 处理 Markdown 格式
    let formatted = content;

    // 代码块
    formatted = formatted.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

    // 行内代码
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');

    // 粗体
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // 段落
    formatted = formatted.split('\n\n').map(p => `<p>${p}</p>`).join('');

    return formatted;
}

// HTML 转义
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 移除欢迎消息
function removeWelcomeMessage() {
    const welcomeMessage = document.querySelector('.welcome-message');
    if (welcomeMessage) {
        welcomeMessage.remove();
    }
}

// 滚动到底部
function scrollToBottom() {
    const chatContainer = document.getElementById('chatContainer');
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// 显示加载指示器
function showLoading() {
    document.getElementById('loadingIndicator').classList.remove('hidden');
}

// 隐藏加载指示器
function hideLoading() {
    document.getElementById('loadingIndicator').classList.add('hidden');
}

// 显示错误消息
function showError(message) {
    const chatContainer = document.getElementById('chatContainer');
    const errorDiv = document.createElement('div');
    errorDiv.className = 'message assistant-message';
    errorDiv.innerHTML = `
        <div class="avatar"><i class="fas fa-exclamation-circle"></i></div>
        <div class="message-content">
            <div class="message-bubble" style="background: #fff3f3; color: #dc3545;">
                <i class="fas fa-exclamation-triangle"></i> ${message}
            </div>
        </div>
    `;
    chatContainer.appendChild(errorDiv);
    scrollToBottom();
}

// 检查连接状态
async function checkConnection() {
    try {
        const response = await fetch(`${API_BASE_URL}/run`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: [] })
        });
        return response.ok;
    } catch (error) {
        return false;
    }
}

// 页面加载完成后检查连接
window.addEventListener('load', async () => {
    const isConnected = await checkConnection();
    if (!isConnected) {
        showError('无法连接到服务，请检查服务是否正常运行');
    }
});
