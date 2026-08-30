// ========== MPOSTOR 成语接龙 · 联机房间 ==========

console.log('[IDIOM] 成语接龙联机房间已加载');

var WS_URL = 'ws://localhost:8080/ws/game';

// ========== DOM 引用 ==========
var roomIdTag = document.getElementById('roomIdTag');
var gameStatus = document.getElementById('gameStatus');
var playerCount = document.getElementById('playerCount');
var playersList = document.getElementById('playersList');
var lastCharDisplay = document.getElementById('lastCharDisplay');
var lastCharHint = document.getElementById('lastCharHint');
var chainLog = document.getElementById('chainLog');
var sourceTag = document.getElementById('sourceTag');
var idiomInput = document.getElementById('idiomInput');
var playBtn = document.getElementById('playBtn');
var skipBtn = document.getElementById('skipBtn');
var idiomFeedback = document.getElementById('idiomFeedback');
var hostPanel = document.getElementById('hostPanel');
var startBtn = document.getElementById('startBtn');
var closeBtn = document.getElementById('closeBtn');
var kickList = document.getElementById('kickList');
var overPanel = document.getElementById('overPanel');
var resultIcon = document.getElementById('resultIcon');
var resultTitle = document.getElementById('resultTitle');
var resultDesc = document.getElementById('resultDesc');
var backHallBtn = document.getElementById('backHallBtn');
var resetBtn = document.getElementById('resetBtn');
var muteBtn = document.getElementById('muteBtn');

// ========== 状态 ==========
var state = {
    roomId: null,
    playerId: null,
    isHost: false,
    roomHost: null,
    ws: null,
    connected: false,
    status: 'connecting',   // connecting | waiting | playing | ended
    players: [],
    displayNames: {},
    strikes: {},
    eliminated: [],
    lastChar: '—',
    chainEntries: [],       // [{who, idiom, meaning}]
    currentTurn: null,
    maxPlayers: 0,
    busy: false
};

// ========== 工具 ==========
function setStatus(text, cls) {
    gameStatus.textContent = text;
    gameStatus.className = 'status' + (cls ? ' ' + cls : '');
}

function setFeedback(text, cls) {
    idiomFeedback.textContent = text;
    idiomFeedback.className = 'feedback-line' + (cls ? ' ' + cls : '');
}

function getDisplayName(id) {
    if (!id) return '---';
    var names = state.displayNames || {};
    return names[id] || id;
}

function speak(text) {
    if (window.MPOSTOR) window.MPOSTOR.voice.speak(text);
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
    setFeedback(text, 'err');
}

// ========== 渲染 ==========
function updateLastChar(ch) {
    state.lastChar = ch;
    lastCharDisplay.textContent = ch;
}

function renderChain() {
    chainLog.innerHTML = '';
    if (!state.chainEntries.length) {
        chainLog.innerHTML = '<div class="empty-hint">// 等待开局，AI 出首词</div>';
        return;
    }
    for (var i = 0; i < state.chainEntries.length; i++) {
        var e = state.chainEntries[i];
        var row = document.createElement('div');
        row.className = 'chain-row';
        var side = i === 0 ? 'sys' : 'player';
        row.innerHTML =
            '<span class="chain-side ' + side + '">' + (i === 0 ? '系统' : e.who) + '</span>' +
            '<span class="chain-idiom">' + e.idiom + '</span>' +
            (e.meaning ? '<span class="chain-meaning">· ' + e.meaning + '</span>' : '');
        chainLog.appendChild(row);
    }
    chainLog.scrollTop = chainLog.scrollHeight;
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
        var strikes = state.strikes[p] || 0;
        if (isEliminated) row.className += ' eliminated';
        if (isTurn) row.className += ' current';

        row.innerHTML =
            '<span class="player-name">' + getDisplayName(p) + '</span>' +
            (p === state.playerId ? '<span class="player-badge me">你</span>' : '') +
            (p === state.roomHost ? '<span class="player-badge host">房主</span>' : '') +
            (strikes > 0 ? '<span class="strikes">' + (strikes === 1 ? '▓' : '▓▓') + '</span>' : '') +
            (isEliminated ? '<span class="player-badge dead">已淘汰</span>' : '') +
            (isTurn ? '<span class="player-badge turn">当前回合</span>' : '');
        playersList.appendChild(row);
    }
    playerCount.textContent = state.players.length + '/' + (state.maxPlayers || '?');
}

function refreshUi() {
    updatePlayers();

    var myTurn = state.status === 'playing' &&
        state.currentTurn === state.playerId &&
        state.eliminated.indexOf(state.playerId) === -1;
    idiomInput.disabled = !myTurn;
    playBtn.disabled = !myTurn;

    skipBtn.style.display = (state.isHost && state.status === 'playing') ? '' : 'none';
    skipBtn.disabled = state.status !== 'playing' ||
        state.currentTurn === state.playerId || !state.currentTurn;

    if (state.status === 'playing') {
        if (state.eliminated.indexOf(state.playerId) !== -1) {
            lastCharHint.textContent = '你已被淘汰，观战中';
        } else if (myTurn) {
            lastCharHint.textContent = '轮到你，以「' + state.lastChar + '」开头继续接龙';
            idiomInput.focus();
        } else {
            lastCharHint.textContent = '轮到 ' + getDisplayName(state.currentTurn) + '，以「' + state.lastChar + '」开头';
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
    state.chainEntries = [];
    state.strikes = {};
    state.eliminated = [];
    state.currentTurn = null;
    updateLastChar('—');
    lastCharHint.textContent = '等待房主开局...';
    renderChain();
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
        state.strikes = {};
        state.eliminated = [];
        state.chainEntries = [{ who: '系统', idiom: msg.firstIdiom, meaning: msg.meaning || '' }];
        updateLastChar(msg.lastChar || '—');
        state.currentTurn = msg.currentTurn || null;
        sourceTag.textContent = (msg.source === 'local' ? 'LOCAL BANK' : 'AI GENERATED');
        var diffTag = msg.difficulty === 'easy' ? '简单' : (msg.difficulty === 'hard' ? '困难' : '普通');
        setFeedback('// 难度：' + diffTag + (msg.difficulty === 'hard' ? ' · 生僻成语' : ''), 'ok');
        renderChain();
        if (window.MPOSTOR) {
            window.MPOSTOR.sound.play('confirm');
            window.MPOSTOR.fx.deployTransition('IDIOM CHAIN // 成语接龙', null);
        }
        speak('接龙开始。首词：' + msg.firstIdiom + '。以「' + state.lastChar + '」开头。轮到 ' + getDisplayName(state.currentTurn));
    }
    refreshUi();
}

function showEnded(msg) {
    state.status = 'ended';
    setStatus('已结束', 'ended');
    hostPanel.style.display = 'none';
    overPanel.style.display = 'flex';
    refreshUi();

    var winnerName = msg && msg.winnerName;
    if (winnerName) {
        resultIcon.textContent = '[IDIOM]';
        resultTitle.textContent = 'WINNER: ' + winnerName;
        resultDesc.textContent = '词穷者出局，接龙到最后的是赢家。';
        speak('游戏结束。' + winnerName + ' 获胜。');
    } else {
        resultIcon.textContent = '▣';
        resultTitle.textContent = 'GAME OVER';
        resultDesc.textContent = '本局已结束，返回大厅继续。';
    }
    resultTitle.setAttribute('data-text', resultTitle.textContent);
    resetBtn.style.display = state.isHost ? '' : 'none';

    if (window.MPOSTOR) {
        var mine = (msg && msg.result === state.playerId);
        window.MPOSTOR.sound.play(mine ? 'victory' : 'defeat');
        window.MPOSTOR.stats.add('idiomPlayed');
        if (mine) window.MPOSTOR.stats.add('idiomWins');
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
            if (d.host) {
                state.roomHost = d.host;
                state.isHost = d.host === state.playerId;
            }
            roomIdTag.textContent = 'ROOM ' + state.roomId;

            // 对局快照
            if (d.chain) {
                var entries = [];
                for (var i = 0; i < d.chain.length; i++) {
                    entries.push({
                        who: i === 0 ? '系统' : '玩家',
                        idiom: d.chain[i],
                        meaning: i === 0 ? (d.firstMeaning || '') : ''
                    });
                }
                state.chainEntries = entries;
            }
            if (d.lastChar) state.lastChar = d.lastChar;
            if (d.strikes) state.strikes = d.strikes;
            if (d.currentTurn) state.currentTurn = d.currentTurn;

            if (d.gameOver || d.status === 'ended') {
                renderChain();
                showEnded(null);
            } else if (d.status === 'playing') {
                sourceTag.textContent = (d.firstSource === 'local' ? 'LOCAL BANK' : 'AI GENERATED');
                enterPlaying(null);
                var diffTag = d.difficulty === 'easy' ? '简单' : (d.difficulty === 'hard' ? '困难' : '普通');
                setFeedback('> 已重连 · 难度 ' + diffTag + ' · 末字「' + state.lastChar + '」', 'ok');
                speak('已重连对局。以「' + state.lastChar + '」开头。');
            } else {
                enterWaiting();
            }
            break;
        }

        case 'idiomStarted':
            enterPlaying(message);
            break;

        case 'idiomUpdate': {
            var u = message;
            if (u.strikes) state.strikes = u.strikes;
            if (u.displayNames) state.displayNames = u.displayNames;

            if (u.valid) {
                state.chainEntries.push({ who: getDisplayName(u.playerName), idiom: u.idiom, meaning: u.meaning || '' });
                if (u.lastChar) updateLastChar(u.lastChar);
                if (u.eliminated) state.eliminated = state.eliminated.concat([u.eliminated]);
                state.currentTurn = u.nextPlayer || null;
                renderChain();
                setFeedback('▸ ' + getDisplayName(u.playerName) + ' 接龙成功', 'ok');
                if (window.MPOSTOR) window.MPOSTOR.sound.play('chirp');
                speak(getDisplayName(u.playerName) + ' 接了：' + u.idiom + '。轮到 ' + getDisplayName(state.currentTurn));
            } else if (u.result === 'left') {
                if (u.eliminated) state.eliminated = state.eliminated.concat([u.eliminated]);
                state.currentTurn = u.nextPlayer || null;
                setFeedback(getDisplayName(u.playerName) + ' 离场', 'err');
            } else {
                if (u.eliminated) state.eliminated = state.eliminated.concat([u.eliminated]);
                state.currentTurn = u.nextPlayer || null;
                setFeedback('✕ ' + getDisplayName(u.playerName) + ' 犯规：' + (u.reason || '接龙失败'), 'err');
                if (window.MPOSTOR) {
                    window.MPOSTOR.sound.play('buzz');
                    window.MPOSTOR.fx.glitch(250);
                }
                speak(getDisplayName(u.playerName) + ' 犯规。' + (u.reason || ''));
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
function submitPlay() {
    if (playBtn.disabled || state.busy) return;
    var idiom = idiomInput.value.trim();
    if (!idiom) {
        setFeedback('✕ 请输入成语', 'err');
        return;
    }
    if (idiom.length !== 4) {
        setFeedback('✕ 必须是四字成语', 'err');
        return;
    }
    if (state.lastChar !== '—' && idiom.charAt(0) !== state.lastChar) {
        setFeedback('✕ 必须以「' + state.lastChar + '」开头', 'err');
        return;
    }
    state.busy = true;
    idiomInput.value = '';
    setFeedback('', '');
    send({ type: 'idiomPlay', playerId: state.playerId, data: { roomId: state.roomId, idiom: idiom } });
    setTimeout(function () { state.busy = false; }, 1500);
}

playBtn.addEventListener('click', submitPlay);
idiomInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        submitPlay();
    }
});

skipBtn.addEventListener('click', function () {
    if (confirm('确定跳过 ' + getDisplayName(state.currentTurn) + ' 的本轮接龙吗？（记 1 次犯规）')) {
        send({ type: 'idiomSkip', playerId: state.playerId, data: { roomId: state.roomId } });
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
    try { saved = JSON.parse(localStorage.getItem('idiomGameData') || 'null'); } catch (e) {}
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
