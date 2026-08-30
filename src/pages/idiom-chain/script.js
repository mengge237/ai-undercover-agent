// ========== MPOSTOR 成语接龙 - 文字链路终端 ==========

console.log('✓ 文字链路终端已加载');

// ========== DOM引用 ==========
var chainLog = document.getElementById('chainLog');
var lastCharDisplay = document.getElementById('lastCharDisplay');
var lastCharHint = document.getElementById('lastCharHint');
var lastCharPanel = document.querySelector('.lastchar-panel');
var roundTag = document.getElementById('roundTag');
var idiomInput = document.getElementById('idiomInput');
var idiomPlayBtn = document.getElementById('idiomPlayBtn');
var idiomNewBtn = document.getElementById('idiomNewBtn');
var idiomFeedback = document.getElementById('idiomFeedback');
var gameStatus = document.getElementById('gameStatus');
var idiomOverPanel = document.getElementById('idiomOverPanel');
var idiomResultIcon = document.getElementById('idiomResultIcon');
var idiomResultTitle = document.getElementById('idiomResultTitle');
var idiomResultDesc = document.getElementById('idiomResultDesc');
var idiomAgainBtn = document.getElementById('idiomAgainBtn');
var muteBtn = document.getElementById('muteBtn');

// ========== 配置 ==========
var BACKEND_URL = 'http://localhost:8080';

// ========== 状态 ==========
var state = {
    gameId: null,
    lastChar: '',
    rounds: 0,
    streak: 0,
    busy: false,
    finished: false
};

// ========== 工具 ==========
function setStatus(text, cls) {
    gameStatus.textContent = text;
    gameStatus.className = 'status' + (cls ? ' ' + cls : '');
}

function escapeHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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

function setFeedback(text, cls) {
    idiomFeedback.textContent = text;
    idiomFeedback.className = 'feedback-line' + (cls ? ' ' + cls : '');
}

// ========== 渲染 ==========
function updateLastChar(ch) {
    state.lastChar = ch;
    lastCharDisplay.textContent = ch;
    lastCharHint.textContent = '以「' + ch + '」开头继续接龙';
}

function addChainRow(side, idiom, meaning, thinking) {
    var first = chainLog.querySelector('.empty-hint');
    if (first) first.remove();

    var row = document.createElement('div');
    row.className = 'chain-row ' + side + (thinking ? ' ai-thinking' : '');

    var sideTag = document.createElement('span');
    sideTag.className = 'chain-side ' + side;
    sideTag.textContent = side === 'player' ? 'YOU' : 'AI';

    var idiomEl = document.createElement('span');
    idiomEl.className = 'chain-idiom';
    idiomEl.textContent = idiom;

    row.appendChild(sideTag);
    row.appendChild(idiomEl);

    if (meaning) {
        var meaningEl = document.createElement('span');
        meaningEl.className = 'chain-meaning';
        meaningEl.textContent = '· ' + meaning;
        row.appendChild(meaningEl);
    }

    chainLog.appendChild(row);
    chainLog.scrollTop = chainLog.scrollHeight;
    return row;
}

// ========== 核心逻辑 ==========
async function startChain() {
    state.busy = true;
    state.finished = false;
    state.streak = 0;
    state.rounds = 0;
    idiomOverPanel.style.display = 'none';
    idiomInput.disabled = false;
    idiomInput.value = '';
    roundTag.textContent = 'ROUND 0';
    setFeedback('', '');
    lastCharPanel.classList.remove('ai-thinking');
    updateLastChar('—');
    setStatus('开局中...', 'thinking');

    try {
        var data = await post('/api/game/idiom/start', {});
        state.gameId = data.gameId;

        chainLog.innerHTML = '';
        updateLastChar(data.lastChar);
        addChainRow('ai', data.firstIdiom, data.meaning || '', false);
        setFeedback('AI 出了首词「' + data.firstIdiom + '」，轮到你接龙', 'ok');
        setStatus('对局中', 'playing');

        if (window.MPOSTOR) {
            window.MPOSTOR.sound.play('confirm');
            window.MPOSTOR.stats.add('idiomPlayed');
        }
    } catch (e) {
        chainLog.innerHTML = '<div class="empty-hint">// ✕ 后端连接失败，请确认 Spring Boot 已启动（localhost:8080）</div>';
        setStatus('离线', 'ended');
        if (window.MPOSTOR) window.MPOSTOR.sound.play('error');
    }
    state.busy = false;
}

async function handlePlay() {
    if (state.busy || state.finished || !state.gameId) return;

    var idiom = idiomInput.value.trim();
    if (!idiom) {
        setFeedback('✕ 请输入成语', 'err');
        if (window.MPOSTOR) window.MPOSTOR.sound.play('error');
        return;
    }

    state.busy = true;
    idiomInput.disabled = true;
    idiomInput.value = '';
    setFeedback('', '');
    setStatus('AI 思考中...', 'thinking');
    lastCharPanel.classList.add('ai-thinking');
    var thinkingRow = addChainRow('ai', '… …', '', true);

    try {
        var data = await post('/api/game/idiom/play', { gameId: state.gameId, idiom: idiom });
        thinkingRow.remove();
        lastCharPanel.classList.remove('ai-thinking');

        if (!data.valid) {
            setFeedback('✕ ' + (data.reason || '接龙失败'), 'err');
            if (window.MPOSTOR) {
                window.MPOSTOR.sound.play('buzz');
                window.MPOSTOR.fx.glitch(250);
            }
            setStatus('对局中', 'playing');
            state.busy = false;
            idiomInput.disabled = false;
            return;
        }

        // 玩家成语有效
        state.rounds++;
        state.streak++;
        roundTag.textContent = 'ROUND ' + state.rounds;
        addChainRow('player', idiom, data.meaning || '', false);
        if (window.MPOSTOR) window.MPOSTOR.sound.play('chirp');

        if (data.gameOver) {
            // AI 认输，玩家获胜
            state.finished = true;
            state.streak = 0;
            setStatus('对局结束', 'ended');
            showOver(data.reason || 'AI 接不上，认输！');
            return;
        }

        // AI 接龙
        var aiRow = addChainRow('ai', '', '', false);
        var aiEl = aiRow.querySelector('.chain-idiom');
        updateLastChar(data.lastChar);
        setFeedback('▸ AI 接龙：「' + data.aiIdiom + '」，以「' + data.lastChar + '」开头继续', 'ok');
        setStatus('对局中', 'playing');
        if (window.MPOSTOR) window.MPOSTOR.sound.play('beep');

        if (window.MPOSTOR && window.MPOSTOR.fx && typeof window.MPOSTOR.fx.typewriter === 'function') {
            window.MPOSTOR.fx.typewriter(aiEl, data.aiIdiom, 55);
        } else {
            aiEl.textContent = data.aiIdiom;
        }

        if (state.streak >= 5 && window.MPOSTOR) {
            window.MPOSTOR.ach.unlock('idiom_chain');
        }
    } catch (e) {
        thinkingRow.remove();
        lastCharPanel.classList.remove('ai-thinking');
        setFeedback('✕ ' + e.message, 'err');
        setStatus('对局中', 'playing');
        if (window.MPOSTOR) window.MPOSTOR.sound.play('error');
    }
    state.busy = false;
    idiomInput.disabled = false;
}

function showOver(reason) {
    idiomOverPanel.style.display = 'flex';
    idiomResultIcon.textContent = '▣';
    idiomResultTitle.textContent = 'AI 认输';
    idiomResultTitle.setAttribute('data-text', 'AI 认输');
    idiomResultDesc.innerHTML = escapeHtml(reason) + '<br>本局接龙 <strong>' + state.rounds + '</strong> 轮，链路终结。';

    if (window.MPOSTOR) {
        window.MPOSTOR.sound.play('victory');
        window.MPOSTOR.stats.add('idiomWins');
        window.MPOSTOR.voice.speak('AI 认输。' + (reason || '') + '，本局接龙 ' + state.rounds + ' 轮。');
    }
}

// ========== 事件绑定 ==========
idiomPlayBtn.addEventListener('click', handlePlay);
idiomNewBtn.addEventListener('click', startChain);
idiomAgainBtn.addEventListener('click', startChain);

idiomInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        handlePlay();
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
    window.MPOSTOR.voice.attachMic(idiomInput);
    startChain();
}
