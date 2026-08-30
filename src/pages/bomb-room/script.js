// ========== MPOSTOR 拆弹小队 · 联机房间 ==========

console.log('[BOMB] 拆弹小队联机房间已加载');

var WS_URL = 'ws://localhost:8080/ws/game';

// ========== DOM 引用 ==========
var roomIdTag = document.getElementById('roomIdTag');
var gameStatus = document.getElementById('gameStatus');
var playerCount = document.getElementById('playerCount');
var playersList = document.getElementById('playersList');
var rangeMin = document.getElementById('rangeMin');
var rangeMax = document.getElementById('rangeMax');
var rangeFill = document.getElementById('rangeFill');
var rangeSub = document.getElementById('rangeSub');
var bombInput = document.getElementById('bombInput');
var guessBtn = document.getElementById('guessBtn');
var bombFeedback = document.getElementById('bombFeedback');
var bombLog = document.getElementById('bombLog');
var attemptTag = document.getElementById('attemptTag');
var hostPanel = document.getElementById('hostPanel');
var startBtn = document.getElementById('startBtn');
var closeBtn = document.getElementById('closeBtn');
var kickList = document.getElementById('kickList');
var overPanel = document.getElementById('overPanel');
var resultIcon = document.getElementById('resultIcon');
var resultTitle = document.getElementById('resultTitle');
var resultDesc = document.getElementById('resultDesc');
var rankingList = document.getElementById('rankingList');
var backHallBtn = document.getElementById('backHallBtn');
var resetBtn = document.getElementById('resetBtn');
var muteBtn = document.getElementById('muteBtn');

// ========== 状态 ==========
var state = {
    roomId: null,
    playerId: null,
    isHost: false,
    ws: null,
    connected: false,
    status: 'connecting',   // connecting | waiting | playing | ended
    players: [],
    displayNames: {},
    eliminated: [],
    min: 1,
    max: 100,
    maxCuts: 0,
    currentTurn: null,
    attempts: 0,
    decoys: 0,      // 干扰线数量（剪断无区间信息）
    fuses: 0,       // 熔断线数量（剪断额外消耗 1 次）
    maxPlayers: 0,
    roomName: ''
};

// ========== 工具 ==========
function setStatus(text, cls) {
    gameStatus.textContent = text;
    gameStatus.className = 'status' + (cls ? ' ' + cls : '');
}

function setFeedback(text, cls) {
    bombFeedback.textContent = text;
    bombFeedback.className = 'feedback-line' + (cls ? ' ' + cls : '');
}

function getDisplayName(id) {
    if (!id) return '---';
    var names = state.displayNames || {};
    return names[id] || id;
}

function speak(text) {
    if (window.MPOSTOR) window.MPOSTOR.voice.speak(text);
}

function addLog(text, cls) {
    var first = bombLog.querySelector('.empty-hint');
    if (first) first.remove();
    var entry = document.createElement('div');
    entry.className = 'log-entry' + (cls ? ' ' + cls : '');
    entry.innerHTML = '<span class="log-no">#' + state.attempts + '</span><span>' + text + '</span>';
    bombLog.appendChild(entry);
    bombLog.scrollTop = bombLog.scrollHeight;
}

function clearLog() {
    bombLog.innerHTML = '<div class="empty-hint">// 等待开局</div>';
}

function send(msg) {
    if (state.ws && state.ws.readyState === WebSocket.OPEN) {
        state.ws.send(JSON.stringify(msg));
        return true;
    }
    return false;
}

function backToHall() {
    window.location.href = '../game-hall/index.html';
}

function fail(text) {
    setStatus('异常', 'ended');
    bombFeedback.textContent = text;
    bombFeedback.className = 'feedback-line err';
}

// ========== 渲染 ==========
function setRange(min, max) {
    state.min = min;
    state.max = max;
    rangeMin.textContent = min;
    rangeMax.textContent = max;
    var total = 99; // 1..100 共 100 格，比例窗口
    var left = ((min - 1) / total) * 100;
    var width = ((max - min + 1) / total) * 100;
    rangeFill.style.left = left + '%';
    rangeFill.style.width = Math.max(width, 2) + '%';
}

function updatePlayers() {
    playersList.innerHTML = '';
    if (!state.players.length) {
        playersList.innerHTML = '<div class="empty-hint">// 暂无玩家</div>';
    }
    for (var i = 0; i < state.players.length; i++) {
        var p = state.players[i];
        var row = document.createElement('div');
        row.className = 'player-row';
        var isEliminated = state.eliminated.indexOf(p) !== -1;
        var isTurn = state.status === 'playing' && state.currentTurn === p && !isEliminated;
        if (isEliminated) row.className += ' eliminated';
        if (isTurn) row.className += ' current';

        row.innerHTML =
            '<span class="player-name">' + getDisplayName(p) + '</span>' +
            (p === state.playerId ? '<span class="player-badge me">你</span>' : '') +
            (p === state.roomHost ? '<span class="player-badge host">房主</span>' : '') +
            (isEliminated ? '<span class="player-badge dead">已离场</span>' : '') +
            (isTurn ? '<span class="player-badge turn">当前回合</span>' : '');
        playersList.appendChild(row);
    }
    playerCount.textContent = state.players.length + '/' + (state.maxPlayers || '?');
}

function refreshUi() {
    updatePlayers();
    var cutsLeft = state.maxCuts ? Math.max(0, state.maxCuts - state.attempts) : 0;
    attemptTag.textContent = state.status === 'playing' && state.maxCuts
        ? 'LEFT ' + cutsLeft
        : '#' + state.attempts;

    var myTurn = state.status === 'playing' &&
        state.currentTurn === state.playerId &&
        state.eliminated.indexOf(state.playerId) === -1;
    bombInput.disabled = !myTurn;
    guessBtn.disabled = !myTurn;

    if (state.status === 'playing') {
        if (state.eliminated.indexOf(state.playerId) !== -1) {
            rangeSub.textContent = '// 你已离场，观战中';
        } else if (myTurn) {
            rangeSub.textContent = '// 轮到你剪线（' + state.min + '~' + state.max + '）· 剩余 ' + cutsLeft + ' 次';
            if (document.activeElement !== bombInput) bombInput.focus();
        } else {
            rangeSub.textContent = '// 轮到 ' + getDisplayName(state.currentTurn) + ' 剪线 · 剩余 ' + cutsLeft + ' 次';
        }
    }
}

function renderKickList() {
    kickList.innerHTML = '';
    var hasKick = false;
    for (var i = 0; i < state.players.length; i++) {
        var p = state.players[i];
        if (p === state.playerId || p.indexOf('AI-') === 0) continue;
        hasKick = true;
        var btn = document.createElement('button');
        btn.className = 'btn btn-sm kick-btn';
        btn.textContent = '✕ 踢出 ' + getDisplayName(p);
        (function (target) {
            btn.addEventListener('click', function () {
                if (confirm('确定要踢出 ' + getDisplayName(target) + ' 吗？')) {
                    send({ type: 'kickPlayer', playerId: state.playerId, data: { roomId: state.roomId, targetId: target } });
                }
            });
        })(p);
        kickList.appendChild(btn);
    }
    if (!hasKick) kickList.innerHTML = '<span class="kick-hint">// 暂无其他玩家</span>';
}

// ========== 阶段切换 ==========
function enterWaiting() {
    state.status = 'waiting';
    setStatus('等待中', 'waiting');
    hostPanel.style.display = state.isHost ? '' : 'none';
    overPanel.style.display = 'none';
    clearLog();
    setRange(1, 100);
    state.attempts = 0;
    state.currentTurn = null;
    rangeSub.textContent = '// 等待房主开局';
    setFeedback('', '');
    if (state.isHost) {
        startBtn.disabled = state.players.length < 2;
        renderKickList();
    }
    refreshUi();
}

function enterPlaying(msg) {
    state.status = 'playing';
    setStatus('对局中', 'playing');
    hostPanel.style.display = 'none';
    overPanel.style.display = 'none';
    setFeedback('', '');

    if (msg) {
        state.players = msg.players || state.players;
        state.displayNames = msg.displayNames || state.displayNames;
        state.eliminated = [];
        setRange(msg.min != null ? msg.min : 1, msg.max != null ? msg.max : 100);
        state.maxCuts = msg.maxCuts || (4 + 2 * state.players.length);
        state.attempts = 0;
        state.decoys = msg.decoyCount || 0;
        state.fuses = msg.fuseCount || 0;
        state.currentTurn = msg.currentTurn || null;
        clearLog();
        addLog('▓ 炸弹已启动 · 引爆密码在 1~100 · 剪线上限 ' + state.maxCuts + ' 次', 'info');
        if (state.decoys || state.fuses) {
            addLog('// 威胁评估：干扰线 ×' + state.decoys + '（剪断无区间信息） · 熔断线 ×' + state.fuses + '（剪断额外消耗 1 次）', 'info');
        }
        var diffTag = msg.difficulty === 'easy' ? '简单' : (msg.difficulty === 'hard' ? '困难' : '普通');
        addLog('// 任务难度：' + diffTag, 'info');
        if (window.MPOSTOR) {
            window.MPOSTOR.sound.play('confirm');
            window.MPOSTOR.fx.deployTransition('BOMB SQUAD // 拆弹小队', null);
        }
        speak('游戏开始。炸弹已启动，引爆密码在 1 到 100。小队共有 ' + state.maxCuts + ' 次剪线机会。' +
            (state.decoys || state.fuses ? '注意，区间内埋有 ' + state.decoys + ' 根干扰线和 ' + state.fuses + ' 根熔断线。' : '') +
            '轮到 ' + getDisplayName(state.currentTurn));
    }
    refreshUi();
}

function showEnded(msg) {
    state.status = 'ended';
    setStatus('已结束', 'ended');
    hostPanel.style.display = 'none';
    overPanel.style.display = 'flex';
    rankingList.innerHTML = '';
    refreshUi();

    var winnerName = msg && msg.winnerName;
    var isDraw = msg && msg.result === 'draw';
    if (winnerName) {
        resultIcon.textContent = '▣';
        resultTitle.textContent = 'WINNER: ' + winnerName;
        resultDesc.textContent = '剪断密码线，拆弹成功。';
        speak('游戏结束。' + winnerName + ' 拆弹成功。');
    } else if (isDraw) {
        resultIcon.textContent = '✕';
        resultTitle.textContent = '全员阵亡';
        resultDesc.textContent = '剪线次数耗尽，炸弹引爆。';
        speak('剪线次数耗尽，炸弹引爆，无人生还。');
    } else {
        resultIcon.textContent = '■';
        resultTitle.textContent = 'GAME OVER';
        resultDesc.textContent = '本局已结束，返回大厅继续。';
    }
    resultTitle.setAttribute('data-text', resultTitle.textContent);

    var ranking = msg && msg.ranking;
    if (ranking && ranking.length) {
        for (var i = 0; i < ranking.length; i++) {
            var r = ranking[i];
            var row = document.createElement('div');
            row.className = 'ranking-row' + (r.alive ? ' win' : '');
            row.innerHTML = '<span>' + (i + 1) + '. ' + (r.name || r.playerId) + '</span>' +
                '<span>' + (r.alive ? '在场' : '离场') + '</span>';
            rankingList.appendChild(row);
        }
    }

    resetBtn.style.display = state.isHost ? '' : 'none';

    if (window.MPOSTOR) {
        var mine = (msg && msg.result === state.playerId);
        window.MPOSTOR.sound.play(mine ? 'victory' : (isDraw ? 'defeat' : 'beep'));
        if (mine) window.MPOSTOR.stats.add('bombWins');
        window.MPOSTOR.stats.add('bombPlayed');
    }
}

// ========== 消息处理 ==========
function handle(message) {
    switch (message.type) {
        case 'authSuccess':
            break;

        case 'rejoinSuccess': {
            var d = message.data || message;
            state.players = d.players || [];
            state.displayNames = d.displayNames || {};
            state.eliminated = d.eliminated || [];
            state.maxPlayers = d.maxPlayers || 0;
            state.roomName = d.name || '';
            if (d.host) {
                state.isHost = d.host === state.playerId;
                state.roomHost = d.host;
            }
            roomIdTag.textContent = 'ROOM ' + state.roomId;
            // 对局快照
            if (d.min != null) state.min = d.min;
            if (d.max != null) state.max = d.max;
            if (d.attempts != null) state.attempts = d.attempts;
            if (d.maxCuts != null) state.maxCuts = d.maxCuts;
            if (d.decoyCount != null) state.decoys = d.decoyCount;
            if (d.fuseCount != null) state.fuses = d.fuseCount;
            if (d.currentTurn) state.currentTurn = d.currentTurn;
            if (d.alive) state.eliminated = state.eliminated.filter(function (p) { return d.alive.indexOf(p) === -1; });

            if (d.gameOver || d.status === 'ended') {
                showEnded(null);
            } else if (d.status === 'playing') {
                enterPlaying(null);
                var diffTag = d.difficulty === 'easy' ? '简单' : (d.difficulty === 'hard' ? '困难' : '普通');
                addLog('> 已重连 · 任务难度 ' + diffTag + ' · 密码区间 ' + state.min + '~' + state.max, 'info');
                speak('已重连对局。密码区间 ' + state.min + ' 到 ' + state.max + '。');
            } else {
                enterWaiting();
            }
            break;
        }

        case 'bombStarted':
            enterPlaying(message);
            break;

        case 'bombUpdate': {
            var u = message;
            state.attempts = u.attempts != null ? u.attempts : state.attempts;
            state.displayNames = state.displayNames || {};

            if (u.result === 'DEFUSED') {
                setRange(u.low, u.high);
                state.currentTurn = null;
                addLog('▣ ' + u.number + ' 是密码线 · 拆弹成功！', 'info');
                if (window.MPOSTOR) window.MPOSTOR.fx.glitch(400);
            } else if (u.result === 'BOOM') {
                setRange(u.low, u.high);
                state.currentTurn = null;
                var cause = u.decoy ? '剪中干扰线后剪线耗尽' : (u.fuse ? '熔断短路后剪线耗尽' : '剪线次数耗尽');
                addLog('✕ ' + cause + ' · 炸弹引爆 · 密码是 ' + u.code, 'boom');
                if (window.MPOSTOR) {
                    window.MPOSTOR.sound.play('buzz');
                    window.MPOSTOR.fx.glitch(400);
                }
                speak('剪线次数耗尽，炸弹引爆。');
            } else if (u.result === 'SAFE') {
                setRange(u.low, u.high);
                state.currentTurn = u.nextPlayer || null;
                var cutsLeft = u.cutsLeft != null ? u.cutsLeft : Math.max(0, (state.maxCuts || 0) - state.attempts);
                addLog('✓ ' + u.number + ' 是安全线 · 密码区间收窄到 ' + u.low + '~' + u.high + ' · 剩余 ' + cutsLeft + ' 次', 'safe');
                if (window.MPOSTOR) window.MPOSTOR.sound.play('beep');
                speak(u.number + ' 号是安全线。密码区间 ' + u.low + ' 到 ' + u.high + '。剩余 ' + cutsLeft + ' 次剪线。轮到 ' + getDisplayName(state.currentTurn));
            } else if (u.result === 'DECOY') {
                state.currentTurn = u.nextPlayer || null;
                var cutsLeft = u.cutsLeft != null ? u.cutsLeft : Math.max(0, (state.maxCuts || 0) - state.attempts);
                addLog('✕ ' + u.number + ' 是干扰线！区间不变，密码仍在 ' + u.low + '~' + u.high + ' · 剩余 ' + cutsLeft + ' 次', 'decoy');
                if (window.MPOSTOR) {
                    window.MPOSTOR.sound.play('buzz');
                    window.MPOSTOR.fx.glitch(300);
                }
                speak(u.number + ' 号是干扰线，区间没有变化。剩余 ' + cutsLeft + ' 次剪线。轮到 ' + getDisplayName(state.currentTurn));
            } else if (u.result === 'FUSE') {
                setRange(u.low, u.high);
                state.currentTurn = u.nextPlayer || null;
                var cutsLeft = u.cutsLeft != null ? u.cutsLeft : Math.max(0, (state.maxCuts || 0) - state.attempts);
                addLog('✕ ' + u.number + ' 是熔断线！短路额外消耗 1 次 · 区间收窄到 ' + u.low + '~' + u.high + ' · 剩余 ' + cutsLeft + ' 次', 'fuse');
                if (window.MPOSTOR) window.MPOSTOR.sound.play('powerdown');
                speak(u.number + ' 号是熔断线，短路额外消耗一次剪线。密码区间 ' + u.low + ' 到 ' + u.high + '。剩余 ' + cutsLeft + ' 次剪线。轮到 ' + getDisplayName(state.currentTurn));
            } else if (u.result === 'LEFT') {
                if (u.eliminated) state.eliminated = state.eliminated.concat([u.eliminated]);
                if (u.low != null) setRange(u.low, u.high);
                state.currentTurn = u.nextPlayer || state.currentTurn;
                addLog(getDisplayName(u.eliminated) + ' 离场', 'info');
            }
            refreshUi();
            break;
        }

        case 'gameEnded':
            state.displayNames = message.displayNames || state.displayNames;
            showEnded(message);
            break;

        case 'playerJoined':
        case 'playerLeft':
        case 'playerRejoined':
            send({ type: 'listRooms' });
            break;

        case 'roomList':
            if (message.rooms) {
                for (var i = 0; i < message.rooms.length; i++) {
                    var r = message.rooms[i];
                    if (r.id === state.roomId) {
                        state.players = r.players || [];
                        state.displayNames = r.displayNames || {};
                        state.maxPlayers = r.maxPlayers || state.maxPlayers;
                        if (r.host) {
                            state.roomHost = r.host;
                            state.isHost = r.host === state.playerId;
                        }
                        if (state.status === 'waiting') enterWaiting();
                        else updatePlayers();
                        break;
                    }
                }
            }
            break;

        case 'roomUpdated':
            if (message.room && message.room.id === state.roomId) {
                state.players = message.room.players || state.players;
                state.displayNames = message.room.displayNames || state.displayNames;
                state.maxPlayers = message.room.maxPlayers || state.maxPlayers;
                if (state.status === 'waiting') enterWaiting();
            }
            break;

        case 'roomReset':
            if (window.MPOSTOR) window.MPOSTOR.sound.play('confirm');
            enterWaiting();
            break;

        case 'roomClosed':
            alert('房间已解散');
            backToHall();
            break;

        case 'playerKicked':
            alert('你已被踢出房间');
            backToHall();
            break;

        case 'error':
            if (window.MPOSTOR) window.MPOSTOR.sound.play('error');
            if (message.message && message.message.indexOf('token') !== -1) {
                window.MPOSTOR.auth.logout();
                window.MPOSTOR.auth.require();
                return;
            }
            if (message.message && message.message.indexOf('不在房间') !== -1) {
                fail('你已不在房间中，请返回大厅');
                return;
            }
            setFeedback('✕ ' + (message.message || '操作失败'), 'err');
            break;
    }
}

// ========== WebSocket ==========
function connectWs() {
    try {
        state.ws = new WebSocket(WS_URL);

        state.ws.onopen = function () {
            state.connected = true;
            setStatus('已连接', 'waiting');
            var token = window.MPOSTOR.auth.token();
            if (token) send({ type: 'auth', data: { token: token } });
            send({ type: 'rejoinRoom', playerId: state.playerId, data: { roomId: state.roomId } });
        };

        state.ws.onmessage = function (ev) {
            try {
                handle(JSON.parse(ev.data));
            } catch (e) {
                console.error('消息解析失败:', e);
            }
        };

        state.ws.onclose = function () {
            state.connected = false;
            setStatus('已断开', 'ended');
        };

        state.ws.onerror = function () {
            setStatus('连接异常', 'ended');
        };
    } catch (e) {
        fail('WebSocket 连接失败');
    }
}

// ========== 事件绑定 ==========
function submitGuess() {
    if (guessBtn.disabled) return;
    var num = parseInt(bombInput.value, 10);
    if (isNaN(num)) {
        setFeedback('✕ 请输入有效线号', 'err');
        return;
    }
    if (num < state.min || num > state.max) {
        setFeedback('✕ 线号需在 ' + state.min + '~' + state.max + ' 之间', 'err');
        return;
    }
    bombInput.value = '';
    setFeedback('', '');
    send({ type: 'bombGuess', playerId: state.playerId, data: { roomId: state.roomId, number: num } });
}

guessBtn.addEventListener('click', submitGuess);
bombInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        submitGuess();
    }
});

startBtn.addEventListener('click', function () {
    if (state.players.length < 2) {
        setFeedback('✕ 至少需要 2 名玩家才能开始', 'err');
        return;
    }
    send({ type: 'startGame', playerId: state.playerId, data: { roomId: state.roomId } });
});

closeBtn.addEventListener('click', function () {
    if (confirm('确定要解散这个房间吗？')) {
        send({ type: 'closeRoom', playerId: state.playerId, data: { roomId: state.roomId } });
    }
});

backHallBtn.addEventListener('click', backToHall);

resetBtn.addEventListener('click', function () {
    send({ type: 'resetRoom', playerId: state.playerId, data: { roomId: state.roomId } });
});

/* ---- MPOSTOR 静音开关 ---- */
if (muteBtn && window.MPOSTOR) {
    function syncMute() {
        var muted = window.MPOSTOR.sound.isMuted();
        muteBtn.textContent = muted ? 'SND:OFF' : 'SND:ON';
        muteBtn.className = muted ? 'btn btn-sm btn-alert' : 'btn btn-sm';
    }
    muteBtn.addEventListener('click', function () {
        window.MPOSTOR.sound.toggleMute();
        syncMute();
    });
    syncMute();
}

// ========== 初始化 ==========
if (window.MPOSTOR && window.MPOSTOR.auth.require()) {
    var params = new URLSearchParams(window.location.search);
    state.roomId = params.get('roomId');

    var saved = null;
    try { saved = JSON.parse(localStorage.getItem('bombGameData') || 'null'); } catch (e) {}
    if (!state.roomId && saved && saved.roomId) state.roomId = saved.roomId;
    if (saved && saved.playerId) state.playerId = saved.playerId;
    if (saved && saved.isHost) state.isHost = saved.isHost;

    if (!state.roomId || !state.playerId) {
        fail('缺少房间信息，请从大厅重新进入');
    } else {
        roomIdTag.textContent = 'ROOM ' + state.roomId;
        connectWs();
    }
}
