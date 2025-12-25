let currentDirection = 'pm_to_dev';
let currentAbortController = null;

// Role Metadata
const agentMeta = {
    'pm_to_dev': { name: '需求转译官', title: 'PM ➔ Dev', avatar: 'assets/avatar_pm_new.png' },
    'dev_to_pm': { name: '技术转译官', title: 'Dev ➔ PM', avatar: 'assets/avatar_dev_new.png' }
};

const roleMap = {
    'pm_to_dev': '需求转译官',
    'dev_to_pm': '技术转译官'
};

const input = document.getElementById('sourceInput');
const mentionMenu = document.getElementById('mentionMenu');
const messageHistory = document.getElementById('messageHistory');
const translateBtn = document.getElementById('translateBtn');
const desktopContainer = document.querySelector('.desktop-container');

function selectAgent(direction) {
    currentDirection = direction;
    document.querySelectorAll('.agent-item').forEach(item => item.classList.remove('active'));

    const idMap = {
        'pm_to_dev': 'agent-pm',
        'dev_to_pm': 'agent-dev'
    };
    const target = document.getElementById(idMap[direction]);
    if (target) target.classList.add('active');

    // Auto-fill @mention if input is empty or just has a different mention
    const roleName = roleMap[direction];
    const currentValue = input.value.trim();
    if (!currentValue || currentValue.startsWith('@')) {
        input.value = `@${roleName} `;
        input.focus();
        input.dispatchEvent(new Event('input'));
    }
}

function applyMention(direction) {
    const roleName = roleMap[direction];
    const cursorPosition = input.selectionStart;
    const textBefore = input.value.substring(0, cursorPosition).replace(/@[^\s]*$/, '');
    const textAfter = input.value.substring(cursorPosition);

    input.value = `${textBefore}@${roleName} ${textAfter}`;
    mentionMenu.classList.add('hidden');
    selectAgent(direction);
    input.focus();
}

input.addEventListener('input', (e) => {
    input.style.height = 'auto';
    input.style.height = input.scrollHeight + 'px';

    const value = input.value;
    const cursorPosition = input.selectionStart;
    const lastAt = value.lastIndexOf('@', cursorPosition - 1);

    if (lastAt !== -1 && !value.substring(lastAt, cursorPosition).includes(' ')) {
        mentionMenu.classList.remove('hidden');
    } else {
        mentionMenu.classList.add('hidden');
    }

    if (value.trim()) translateBtn.classList.add('active');
    else translateBtn.classList.remove('active');
});

input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleTranslate();
    }
});

function cancelResponse(cancelBtn, statusText, dots) {
    if (currentAbortController) {
        currentAbortController.abort();
        currentAbortController = null;
    }
    cancelBtn.remove();
    dots.remove();
    statusText.innerText = "已取消生成";
    translateBtn.disabled = false;
}

async function handleTranslate() {
    let rawContent = input.value.trim();
    if (!rawContent || translateBtn.disabled) return;

    // Transition from Empty State to Chat State
    if (desktopContainer.classList.contains('is-empty')) {
        desktopContainer.classList.remove('is-empty');
    }

    // 1. Append User Message
    const userWrap = document.createElement('div');
    userWrap.className = 'user-message-wrap';

    const mentionMatch = rawContent.match(/^@([^\s]+)\s*/);
    let mentionHtml = "";
    let cleanContent = rawContent;
    if (mentionMatch) {
        mentionHtml = `<span class="mention-tag">@${mentionMatch[1]}</span> `;
        cleanContent = rawContent.replace(mentionMatch[0], '');
    }

    userWrap.innerHTML = `<div class="user-bubble">${mentionHtml}${cleanContent}</div>`;
    messageHistory.appendChild(userWrap);

    // Clear Input
    input.value = "";
    input.style.height = 'auto';
    translateBtn.classList.remove('active');
    translateBtn.disabled = true;

    // 2. Prepare Agent Message
    let direction = currentDirection;
    if (mentionMatch) {
        const namePart = mentionMatch[1];
        if (namePart === 'pm') direction = 'dev_to_pm';
        else if (namePart === 'dev') direction = 'pm_to_dev';
    }
    const meta = agentMeta[direction];

    const agentWrap = document.createElement('div');
    agentWrap.className = 'agent-message-wrap';

    const avatarHtml = meta.avatar ? `<img src="${meta.avatar}" class="avatar">` : `<div class="avatar avatar-placeholder">${meta.icon}</div>`;

    agentWrap.innerHTML = `
        <div class="agent-header">
            ${avatarHtml}
            <div class="agent-info">
                <span class="name">${meta.name}</span>
                <span class="title">${meta.title}</span>
            </div>
        </div>
        <div class="agent-status">
            <div class="icon-check">✓</div>
            <span class="status-text">已处理 1 步</span>
            <div class="typing-dots"><span></span><span></span><span></span></div>
            <button class="cancel-btn">取消</button>
        </div>
        <div class="agent-content markdown-body"></div>
    `;

    messageHistory.appendChild(agentWrap);
    const contentDiv = agentWrap.querySelector('.agent-content');
    const dots = agentWrap.querySelector('.typing-dots');
    const statusText = agentWrap.querySelector('.status-text');
    const cancelBtn = agentWrap.querySelector('.cancel-btn');

    cancelBtn.onclick = () => cancelResponse(cancelBtn, statusText, dots);

    messageHistory.scrollTop = messageHistory.scrollHeight;

    currentAbortController = new AbortController();

    try {
        const response = await fetch('/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: cleanContent, direction: direction }),
            signal: currentAbortController.signal
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            fullText += chunk;
            contentDiv.innerHTML = formatMarkdown(fullText);
            messageHistory.scrollTop = messageHistory.scrollHeight;
        }

        // Finalize
        if (cancelBtn.parentNode) cancelBtn.remove();
        dots.remove();
        currentAbortController = null;

    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('Fetch aborted');
        } else {
            console.error('Translation error:', error);
            contentDiv.innerHTML = `<div class="error" style="color: #ef4444;">发生错误: ${error.message}</div>`;
            if (cancelBtn.parentNode) cancelBtn.remove();
            dots.remove();
        }
    } finally {
        translateBtn.disabled = false;
    }
}


function formatMarkdown(text) {
    let html = text;
    const discussionRegex = /- \*\*当前场景\*\*：需求讨论 \(Requirement Discussion\)/i;
    const solutionRegex = /- \*\*当前场景\*\*：技术方案 \(Technical Solution\)/i;

    if (discussionRegex.test(html)) {
        html = html.replace(discussionRegex, '<div class="scenario-badge scenario-discussion">需求讨论</div>');
    } else if (solutionRegex.test(html)) {
        html = html.replace(solutionRegex, '<div class="scenario-badge scenario-solution">技术方案</div>');
    }

    return html
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/### (.*?)(?:<br>|$)/g, '<h3>$1</h3>')
        .replace(/## (.*?)(?:<br>|$)/g, '<h2>$1</h2>')
        .replace(/---/g, '<hr>');
}

document.addEventListener('DOMContentLoaded', () => {
    if (desktopContainer) {
        desktopContainer.classList.add('is-empty');
    }
    selectAgent('pm_to_dev');
});
