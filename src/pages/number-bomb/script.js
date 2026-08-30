// ========== MPOSTOR 拆弹专家 - 拆弹终端 ==========

console.log('✓ 拆弹终端已加载');

// ========== DOM引用 ==========
var lowDisplay = document.getElementById('lowDisplay');
var highDisplay = document.getElementById('highDisplay');
var rangeFill = document.getElementById('rangeFill');
var rangeMarker = document.getElementById('rangeMarker');
var attemptTag = document.getElementById('attemptTag');
var bombInput = document.getElementById('bombInput');
var bombGuessBtn = document.getElementById('bombGuessBtn');
var bombNewBtn = document.getElementById('bombNewBtn');
var bombLog = document.getElementById('bombLog');
var gameStatus = document.getElementById('gameStatus');
var bombOverPanel = document.getElementById('bombOverPanel');
var bombResultIcon = document.getElementById('bombResultIcon');
var bombResultTitle = document.getElementById('bombResultTitle');
var bombResultDesc = document.getElementById('bombResultDesc');
var bombAgainBtn = document.getElementById('bombAgainBtn');
var muteBtn = document.getElementById('muteBtn');

// ========== 配置 ==========
var BACKEND_URL = 'http://localhost:8080';
var GLOBAL_MIN = 1;
var GLOBAL_MAX = 100;

// ========== 状态 ==========
var state = {
    gameId: null,
    low: GLOBAL_MIN,
    high: GLOBAL_MAX,
    maxCuts: 0,
    attempts: 0,
    decoys: 0,      // 干扰线数量（剪断无区间信息）
    fuses: 0,       // 熔断线数量（剪断额外消耗 1 次）
    difficulty: 'normal',
    busy: false,
    finished: false
};

// ========== 工具 ==========
function setStatus(text, cls) {
    gameStatus.textContent = text;
    gameStatus.className = 'status' + (cls ? ' ' + cls : '');
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

function pad2(n) {
    return (n < 10 ? '0' : '') + n;
}

// ========== 渲染 ==========
function updateRange(lastGuess) {
    lowDisplay.textContent = state.low;
    highDisplay.textContent = state.high;
    var total = GLOBAL_MAX - GLOBAL_MIN;
    var leftPct = (state.low - GLOBAL_MIN) / total * 100;
    var widthPct = (state.high - state.low) / total * 100;
    rangeFill.style.left = leftPct + '%';
    rangeFill.style.width = Math.max(0, widthPct) + '%';
    if (typeof lastGuess === 'number') {
        var markPct = (lastGuess - GLOBAL_MIN) / total * 100;
        rangeMarker.style.left = 'calc(' + markPct + '% - 1px)';
        rangeMarker.style.display = 'block';
    }
}

function addLog(kind, html) {
    var first = !state.attempts && !state.gameId;
    if (first) bombLog.innerHTML = '';

    var entry = document.createElement('div');
    entry.className = 'log-entry';

    var no = document.createElement('span');
    no.className = 'log-no';
    no.textContent = '>' + pad2(state.attempts || 1);

    var body = document.createElement('span');
    body.className = kind;
    body.innerHTML = html;

    entry.appendChild(no);
    entry.appendChild(body);
    bombLog.appendChild(entry);
    bombLog.scrollTop = bombLog.scrollHeight;
}

// ========== 核心逻辑 ==========
async function startBomb() {
    state.busy = true;
    state.finished = false;
    bombOverPanel.style.display = 'none';
    bombOverPanel.classList.remove('boom-overlay');
    bombInput.disabled = false;
    bombInput.value = '';
    rangeMarker.style.display = 'none';
    attemptTag.textContent = 'WIRES LEFT --';
    setStatus('拆弹中...', 'armed');

    try {
        var data = await post('/api/game/bomb/start', { min: GLOBAL_MIN, max: GLOBAL_MAX, difficulty: state.difficulty });
        state.gameId = data.gameId;
        state.low = data.low;
        state.high = data.high;
        state.maxCuts = data.maxCuts || 7;
        state.attempts = 0;
        state.decoys = data.decoyCount || 0;
        state.fuses = data.fuseCount || 0;
        attemptTag.textContent = 'WIRES LEFT ' + state.maxCuts;

        var diffTag = state.difficulty === 'easy' ? '简单' : (state.difficulty === 'hard' ? '困难' : '普通');
        bombLog.innerHTML = '';
        addLog('log-info', '// 对局 <span class="log-num">' + state.gameId + '</span> · 炸弹已启动，引爆密码在 (' + state.low + ', ' + state.high + ') 内 · 难度 ' + diffTag + ' · 剪线上限 ' + state.maxCuts + ' 次');
        if (state.decoys || state.fuses) {
            addLog('log-info', '// 威胁评估：干扰线 ×' + state.decoys + '（剪断无区间信息） · 熔断线 ×' + state.fuses + '（剪断额外消耗 1 次）');
        }
        updateRange();
        setStatus('炸弹已启动', 'armed');

        if (window.MPOSTOR) {
            window.MPOSTOR.sound.play('confirm');
            window.MPOSTOR.stats.add('bombPlayed');
        }
    } catch (e) {
        addLog('log-info', '// ✕ 后端连接失败，请确认 Spring Boot 已启动（localhost:8080）');
        setStatus('离线', 'ended');
        if (window.MPOSTOR) window.MPOSTOR.sound.play('error');
    }
    state.busy = false;
}

async function handleGuess() {
    if (state.busy || state.finished || !state.gameId) return;

    var raw = bombInput.value.trim();
    var num = Number(raw);

    if (!raw || !Number.isInteger(num)) {
        invalidFeedback('✕ 输入无效：请输入整数线号');
        return;
    }
    if (num <= state.low || num >= state.high) {
        invalidFeedback('✕ 线号必须在 (' + state.low + ', ' + state.high + ') 之间');
        return;
    }

    state.busy = true;
    bombInput.value = '';
    bombInput.disabled = true;

    try {
        var data = await post('/api/game/bomb/guess', { gameId: state.gameId, number: num });
        state.attempts = data.attempts || state.attempts + 1;
        attemptTag.textContent = 'WIRES LEFT ' + Math.max(0, state.maxCuts - state.attempts);

        if (data.result === 'SAFE') {
            state.low = data.low;
            state.high = data.high;
            updateRange(num);
            addLog('log-safe', '剪 <span class="log-num">' + num + '</span> 号线 → 安全 · 密码区间收窄到 (' + state.low + ', ' + state.high + ') · 剩余 <span class="log-num">' + (state.maxCuts - state.attempts) + '</span> 次');
            if (window.MPOSTOR) window.MPOSTOR.sound.play('tick');
        } else if (data.result === 'DECOY') {
            updateRange(num);
            addLog('log-decoy', '剪 <span class="log-num">' + num + '</span> 号线 → 干扰线！区间不变，密码仍在 (' + state.low + ', ' + state.high + ') · 剩余 <span class="log-num">' + (state.maxCuts - state.attempts) + '</span> 次');
            if (window.MPOSTOR) {
                window.MPOSTOR.sound.play('buzz');
                window.MPOSTOR.fx.glitch(300);
            }
        } else if (data.result === 'FUSE') {
            state.low = data.low;
            state.high = data.high;
            updateRange(num);
            addLog('log-fuse', '剪 <span class="log-num">' + num + '</span> 号线 → 熔断线！短路额外消耗 1 次 · 区间收窄到 (' + state.low + ', ' + state.high + ') · 剩余 <span class="log-num">' + (state.maxCuts - state.attempts) + '</span> 次');
            if (window.MPOSTOR) window.MPOSTOR.sound.play('powerdown');
        } else if (data.result === 'DEFUSED') {
            state.finished = true;
            updateRange(num);
            addLog('log-safe', '剪 <span class="log-num">' + num + '</span> 号线 → ▣ 密码线！拆弹成功');
            showOver('DEFUSED', '引爆密码就是 <strong>' + data.code + '</strong>。<br>第 ' + state.attempts + ' 次剪线成功拆除，拆弹专家，系统记录在案。');
        } else if (data.result === 'BOOM') {
            state.finished = true;
            updateRange(num);
            addLog('log-boom', (data.decoy ? '剪 <span class="log-num">' + num + '</span> 号线 → 干扰线！' : '剪线次数耗尽') + ' → ▓ BOOM ▓ 炸弹引爆');
            boomEffect();
            showOver('BOOM', (data.decoy ? '剪中干扰线后' : '剪线次数耗尽，') + '炸弹引爆。<br>密码是 <strong>' + data.code + '</strong>，第 ' + state.attempts + ' 次剪线未能拆除。');
        }
    } catch (e) {
        addLog('log-info', '// ✕ ' + e.message);
        if (window.MPOSTOR) window.MPOSTOR.sound.play('error');
    }
    state.busy = false;
    // 修复（BLOCKER）：SAFE 或出错后恢复输入框，终局保持禁用
    bombInput.disabled = state.finished;
    if (!state.finished) bombInput.focus();
}

function invalidFeedback(text) {
    state.attempts = state.attempts || 0;
    addLog('log-info', text);
    if (window.MPOSTOR) window.MPOSTOR.sound.play('error');
}

function boomEffect() {
    if (!window.MPOSTOR) return;
    window.MPOSTOR.sound.play('powerdown');
    window.MPOSTOR.fx.glitch(700);
    var hazard = document.querySelector('.hazard');
    if (hazard) {
        hazard.style.animation = 'ledBlink 0.15s steps(1) 8';
        setTimeout(function () { hazard.style.animation = ''; }, 1300);
    }
}

function showOver(kind, desc) {
    var boom = kind === 'BOOM';
    setStatus(boom ? '已引爆' : '已拆除', boom ? 'armed' : 'defused');

    bombOverPanel.classList.toggle('boom-overlay', boom);
    bombOverPanel.style.display = 'flex';

    bombResultIcon.textContent = boom ? '✕' : '▣';
    bombResultTitle.textContent = boom ? 'BOOM' : 'DEFUSED';
    bombResultTitle.setAttribute('data-text', bombResultTitle.textContent);
    bombResultDesc.innerHTML = desc;

    if (window.MPOSTOR) {
        if (boom) {
            window.MPOSTOR.sound.play('defeat');
            window.MPOSTOR.voice.speak('剪线次数耗尽，炸弹引爆。');
        } else {
            window.MPOSTOR.sound.play('victory');
            window.MPOSTOR.ach.unlock('bomb_survivor');
            window.MPOSTOR.stats.add('bombWins');
            window.MPOSTOR.voice.speak('拆弹成功。');
        }
    }
}

// ========== 事件绑定 ==========
bombGuessBtn.addEventListener('click', handleGuess);
bombNewBtn.addEventListener('click', startBomb);
bombAgainBtn.addEventListener('click', startBomb);

bombInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        handleGuess();
    }
});

/* ---- 难度选择 ---- */
var diffButtons = document.querySelectorAll('#bombDifficultySelector .mode-btn');
try {
    var savedDiff = localStorage.getItem('bomb_difficulty');
    if (savedDiff === 'easy' || savedDiff === 'hard') state.difficulty = savedDiff;
} catch (e) { }
function syncDiffButtons() {
    for (var i = 0; i < diffButtons.length; i++) {
        diffButtons[i].classList.toggle('active', diffButtons[i].dataset.diff === state.difficulty);
    }
}
syncDiffButtons();
for (var di = 0; di < diffButtons.length; di++) {
    (function (btn) {
        btn.addEventListener('click', function () {
            state.difficulty = this.dataset.diff;
            syncDiffButtons();
            try { localStorage.setItem('bomb_difficulty', state.difficulty); } catch (e) { }
            startBomb();
        });
    })(diffButtons[di]);
}

/* ---- MPOSTOR 静音开关 ---- */
if (muteBtn && window.MPOSTOR) {
    muteBtn.textContent = window.MPOSTOR.sound.isMuted() ? 'SOUND: OFF' : 'SOUND: ON';
    muteBtn.addEventListener('click', function () {
        var muted = window.MPOSTOR.sound.toggleMute();
        muteBtn.textContent = muted ? 'SOUND: OFF' : 'SOUND: ON';
    });
}

// ========== 初始化 ==========
// 全局登录门禁
if (window.MPOSTOR && window.MPOSTOR.auth.require()) {
    startBomb();
}
