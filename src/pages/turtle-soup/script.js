// ========== MPOSTOR 海龟汤 - 推理终端 ==========

console.log('◍ 海龟汤推理终端已加载');

// ========== DOM引用 ==========
var turtleStory = document.getElementById('turtleStory');
var turtleSource = document.getElementById('turtleSource');
var turtleLog = document.getElementById('turtleLog');
var turtleInput = document.getElementById('turtleInput');
var askBtn = document.getElementById('askBtn');
var guessBtn = document.getElementById('guessBtn');
var revealBtn = document.getElementById('revealBtn');
var newBtn = document.getElementById('newBtn');
var questionCount = document.getElementById('questionCount');
var gameStatus = document.getElementById('gameStatus');
var revealPanel = document.getElementById('revealPanel');
var revealIcon = document.getElementById('revealIcon');
var revealTitle = document.getElementById('revealTitle');
var revealAnswer = document.getElementById('revealAnswer');
var revealAgainBtn = document.getElementById('revealAgainBtn');
var muteBtn = document.getElementById('muteBtn');

// ========== 配置 ==========
var BACKEND_URL = 'http://localhost:8080';

// ========== 状态 ==========
var state = {
    gameId: null,
    questionCount: 0,
    busy: false,
    solved: false
};

// ========== 工具 ==========
function setStatus(text, cls) {
    gameStatus.textContent = text;
    gameStatus.className = 'status' + (cls ? ' ' + cls : '');
}

function addLog(question, verdict, hint, cls) {
    var entry = document.createElement('div');
    entry.className = 'log-entry' + (cls ? ' ' + cls : '');

    var html = '';
    if (question) {
        html += '<span class="log-q">Q' + state.questionCount + '</span>' +
                '<span class="log-question">' + escapeHtml(question) + '</span>';
    }
    if (verdict) {
        html += '<span class="log-verdict ' + verdict.cls + '">' + verdict.text + '</span>';
    }
    if (hint) {
        html += '<span class="log-hint">▸ ' + escapeHtml(hint) + '</span>';
    }
    entry.innerHTML = html;
    turtleLog.appendChild(entry);
    turtleLog.scrollTop = turtleLog.scrollHeight;
    return entry;
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
}

function clearLog() {
    turtleLog.innerHTML = '';
    addLog(null, null, '// 向 AI 主持提问，答案只有：是 / 否 / 无法确定');
}

async function post(path, body) {
    var resp = await fetch(BACKEND_URL + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    var data = await resp.json();
    if (data.code !== 0) {
        throw new Error(data.message || '请求失败');
    }
    return data.data;
}

// ========== 核心逻辑 ==========
async function startNewSoup() {
    if (state.busy) return;                 // 修复：连点「新汤」防重入
    state.busy = true;
    state.gameId = null;                     // 先作废旧对局，旧请求返回也不会污染新局
    state.solved = false;
    revealPanel.style.display = 'none';
    setStatus('熬汤中...', 'playing');
    turtleStory.textContent = '正在熬汤...';

    try {
        var data = await post('/api/game/turtle/start', {});
        state.gameId = data.gameId;
        state.questionCount = 0;
        questionCount.textContent = 'Q:' + state.questionCount;
        turtleSource.textContent = data.source === 'local' ? 'LOCAL BANK' : 'AI GENERATED';

        turtleStory.textContent = '';
        if (window.MPOSTOR) {
            window.MPOSTOR.fx.typewriter(turtleStory, data.story, 45);
            window.MPOSTOR.sound.play('confirm');
            window.MPOSTOR.stats.add('turtlePlayed');
            window.MPOSTOR.voice.speak(data.story);
        } else {
            turtleStory.textContent = data.story;
        }

        clearLog();
        setStatus('推理中');
        turtleInput.disabled = false;
        turtleInput.focus();
    } catch (e) {
        turtleStory.textContent = '// 后端连接失败，请确认 Spring Boot 已启动（localhost:8080）';
        setStatus('离线', 'solved');
        if (window.MPOSTOR) window.MPOSTOR.sound.play('error');
    }
    state.busy = false;
}

async function handleAsk() {
    if (state.busy || state.solved || !state.gameId) return;
    var question = turtleInput.value.trim();
    if (!question) {
        if (window.MPOSTOR) window.MPOSTOR.sound.play('error');
        return;
    }
    if (question.length < 2) {
        addLog(null, null, '问题太短了，至少 2 个字');
        if (window.MPOSTOR) window.MPOSTOR.sound.play('error');
        return;
    }

    state.busy = true;
    askBtn.disabled = true;
    turtleInput.value = '';
    addLog(question, null, 'AI 主持思考中...');

    try {
        var data = await post('/api/game/turtle/ask', { gameId: state.gameId, question: question });
        state.questionCount = data.questionCount || state.questionCount + 1;
        questionCount.textContent = 'Q:' + state.questionCount;

        // 更新最后一条日志为判定结果
        var last = turtleLog.lastElementChild;
        if (last) {
            var verdictCls = data.answer === '是' ? 'yes' : data.answer === '否' ? 'no' : 'unknown';
            last.innerHTML = '<span class="log-q">Q' + state.questionCount + '</span>' +
                '<span class="log-question">' + escapeHtml(question) + '</span>' +
                '<span class="log-verdict ' + verdictCls + '">' + escapeHtml(data.answer) + '</span>' +
                '<span class="log-hint">▸ ' + escapeHtml(data.hint || '') + '</span>';
        }
        if (window.MPOSTOR) window.MPOSTOR.sound.play('beep');
    } catch (e) {
        var lastErr = turtleLog.lastElementChild;
        if (lastErr) lastErr.innerHTML = '<span class="log-hint">✕ ' + escapeHtml(e.message) + '</span>';
        if (window.MPOSTOR) window.MPOSTOR.sound.play('error');
    }

    state.busy = false;
    askBtn.disabled = false;
    turtleInput.focus();
}

async function handleGuess() {
    if (state.busy || state.solved || !state.gameId) return;
    var guess = turtleInput.value.trim();
    if (!guess) {
        if (window.MPOSTOR) window.MPOSTOR.sound.play('error');
        return;
    }

    state.busy = true;
    guessBtn.disabled = true;
    turtleInput.value = '';

    try {
        var data = await post('/api/game/turtle/guess', { gameId: state.gameId, guess: guess });
        if (data.correct) {
            state.solved = true;
            setStatus('破案', 'solved');
            addLog(null, { text: '✓ 猜中', cls: 'yes' }, '核心真相：' + (data.answer || ''), 'win');
            if (window.MPOSTOR) {
                window.MPOSTOR.sound.play('victory');
                window.MPOSTOR.ach.unlock('turtle_solver');
                window.MPOSTOR.stats.add('turtleSolved');
            }
            revealPanel.style.display = 'flex';
            revealIcon.textContent = '◍';
            revealTitle.textContent = '汤底破译';
            revealTitle.setAttribute('data-text', '汤底破译');
            revealAnswer.textContent = data.answer || '';
            if (window.MPOSTOR) window.MPOSTOR.voice.speak('猜中了。汤底是：' + (data.answer || ''));
        } else {
            addLog(null, { text: '✕ 未中', cls: 'no' }, data.comment || '核心真相还没对上');
            if (window.MPOSTOR) window.MPOSTOR.sound.play('buzz');
        }
    } catch (e) {
        addLog(null, null, '✕ ' + e.message);
        if (window.MPOSTOR) window.MPOSTOR.sound.play('error');
    }

    state.busy = false;
    guessBtn.disabled = false;
    turtleInput.focus();
}

async function handleReveal() {
    if (state.busy || !state.gameId) return;
    state.busy = true;
    try {
        var data = await post('/api/game/turtle/reveal', { gameId: state.gameId });
        state.solved = true;
        revealPanel.style.display = 'flex';
        revealIcon.textContent = '◍';
        revealTitle.textContent = '汤底揭晓';
        revealTitle.setAttribute('data-text', '汤底揭晓');
        revealAnswer.textContent = data.answer || '';
        if (window.MPOSTOR) {
            window.MPOSTOR.sound.play('secret');
            window.MPOSTOR.voice.speak('汤底揭晓：' + (data.answer || ''));
        }
    } catch (e) {
        addLog(null, null, '✕ ' + e.message);
        if (window.MPOSTOR) window.MPOSTOR.sound.play('error');
    }
    state.busy = false;
}

// ========== 事件绑定 ==========
askBtn.addEventListener('click', handleAsk);
guessBtn.addEventListener('click', handleGuess);
revealBtn.addEventListener('click', handleReveal);
newBtn.addEventListener('click', startNewSoup);
revealAgainBtn.addEventListener('click', startNewSoup);

turtleInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !askBtn.disabled) {
        e.preventDefault();
        handleAsk();
    }
});

/* ---- MPOSTOR 静音开关 ---- */
if (muteBtn && window.MPOSTOR) {
    muteBtn.textContent = window.MPOSTOR.sound.isMuted() ? 'SOUND: OFF' : 'SOUND: ON';
    muteBtn.addEventListener('click', function () {
        var muted = window.MPOSTOR.sound.toggleMute();
        muteBtn.textContent = muted ? 'SOUND: OFF' : 'SOUND: ON';
    });
}

// ========== 初始化 ==========
// 全局登录门禁 + 语音输入挂载
if (window.MPOSTOR && window.MPOSTOR.auth.require()) {
    window.MPOSTOR.voice.attachMic(turtleInput);
    startNewSoup();
}
