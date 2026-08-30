// ========== MPOSTOR 海龟汤 · 联机房间 ==========

console.log('◍ 海龟汤联机房间已加载');

var WS_URL = 'ws://localhost:8080/ws/game';

// ========== DOM 引用 ==========
var roomIdTag = document.getElementById('roomIdTag');
var gameStatus = document.getElementById('gameStatus');
var playerCount = document.getElementById('playerCount');
var playersList = document.getElementById('playersList');
var sourceTag = document.getElementById('sourceTag');
var questionCount = document.getElementById('questionCount');
var turtleStory = document.getElementById('turtleStory');
var turtleLog = document.getElementById('turtleLog');
var turtleInput = document.getElementById('turtleInput');
var askBtn = document.getElementById('askBtn');
var guessBtn = document.getElementById('guessBtn');
var turtleFeedback = document.getElementById('turtleFeedback');
var judgePanel = document.getElementById('judgePanel');
var pendingList = document.getElementById('pendingList');
var revealBtn = document.getElementById('revealBtn');
var hostPanel = document.getElementById('hostPanel');
var startBtn = document.getElementById('startBtn');
var closeBtn = document.getElementById('closeBtn');
var kickList = document.getElementById('kickList');
var overPanel = document.getElementById('overPanel');
var resultIcon = document.getElementById('resultIcon');
var resultTitle = document.getElementById('resultTitle');
var resultDesc = document.getElementById('resultDesc');
var answerText = document.getElementById('answerText');
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
    story: '',
    source: '',
    qas: [],                // [{no, playerId, question, answer, hint}]
    pending: [],            // 房主待判 [{no, playerId, question}]
    maxQuestions: 20,
    count: 0,
    answer: '',             // 汤底（仅房主）
    keywords: [],
    revealedAnswer: '',
    maxPlayers: 0,
    busy: false
};

// ========== 工具 ==========
function setStatus(text, cls) {
    gameStatus.textContent = text;
    gameStatus.className = 'status' + (cls ? ' ' + cls : '');
}

function setFeedback(text, cls) {
    turtleFeedback.textContent = text;
    turtleFeedback.className = 'feedback-line' + (cls ? ' ' + cls : '');
}

function getDisplayName(id) {
    if (!id) return '---';
    var names = state.displayNames || {};
    return names[id] || id;
}

function speak(text) {
    if (window.MPOSTOR) window.MPOSTOR.voice.speak(text);
}

function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
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
function renderLog() {
    turtleLog.innerHTML = '';
    if (!state.qas.length) {
        turtleLog.innerHTML = '<div class="empty-hint">// 向房主提问，答案只有：是 / 否 / 无法确定</div>';
    }
    for (var i = 0; i < state.qas.length; i++) {
        var qa = state.qas[i];
        var entry = document.createElement('div');
        entry.className = 'log-entry';

        var verdictHtml = '';
        if (qa.answer) {
            var cls = qa.answer === '是' ? 'yes' : qa.answer === '否' ? 'no' : 'unknown';
            verdictHtml = '<span class="log-verdict ' + cls + '">' + escapeHtml(qa.answer) + '</span>';
        } else {
            verdictHtml = '<span class="log-verdict pending">待判定</span>';
        }

        entry.innerHTML =
            '<span class="log-q">Q' + qa.no + '</span>' +
            '<span class="log-question">' + escapeHtml(getDisplayName(qa.playerId)) + '：' + escapeHtml(qa.question) + '</span>' +
            verdictHtml +
            (qa.hint ? '<span class="log-hint">▸ ' + escapeHtml(qa.hint) + '</span>' : '');
        turtleLog.appendChild(entry);
    }
    turtleLog.scrollTop = turtleLog.scrollHeight;
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

        row.innerHTML =
            '<span class="player-name">' + getDisplayName(p) + '</span>' +
            (p === state.playerId ? '<span class="player-badge me">你</span>' : '') +
            (p === state.roomHost ? '<span class="player-badge host">房主</span>' : '');
        playersList.appendChild(row);
    }
    playerCount.textContent = state.players.length + '/' + (state.maxPlayers || '?');
}

function refreshUi() {
    updatePlayers();
    questionCount.textContent = 'Q:' + state.count + '/' + state.maxQuestions;

    var canAsk = state.status === 'playing' &&
        !state.isHost &&
        state.count < state.maxQuestions;
    askBtn.disabled = !canAsk;
    guessBtn.disabled = state.status !== 'playing' || state.isHost;
    turtleInput.disabled = askBtn.disabled && guessBtn.disabled;

    judgePanel.style.display = (state.isHost && state.status === 'playing') ? '' : 'none';
    if (state.isHost && state.status === 'playing') renderPending();
}

function renderPending() {
    pendingList.innerHTML = '';
    if (!state.pending.length) {
        pendingList.innerHTML = '<div class="pending-hint">// 暂无待判定问题</div>';
    }
    for (var i = 0; i < state.pending.length; i++) {
        var pend = state.pending[i];
        var item = document.createElement('div');
        item.className = 'pending-item';
        item.innerHTML =
            '<span class="pending-q">Q' + pend.no + '</span>' +
            '<span class="pending-question">' + escapeHtml(getDisplayName(pend.playerId)) + '：' + escapeHtml(pend.question) + '</span>' +
            '<span class="pending-verdicts">' +
            '<button class="btn btn-sm v-yes" data-no="' + pend.no + '">是</button>' +
            '<button class="btn btn-sm v-no" data-no="' + pend.no + '">否</button>' +
            '<button class="btn btn-sm v-unknown" data-no="' + pend.no + '">无法确定</button>' +
            '</span>' +
            '<input type="text" class="input hint-input" placeholder="补充提示（可选）" maxlength="60" data-no="' + pend.no + '">';
        pendingList.appendChild(item);
    }

    var btns = pendingList.querySelectorAll('button[data-no]');
    for (var b = 0; b < btns.length; b++) {
        (function (btn) {
            btn.addEventListener('click', function () {
                var no = parseInt(btn.dataset.no, 10);
                var hintInput = pendingList.querySelector('.hint-input[data-no="' + no + '"]');
                var verdict = btn.classList.contains('v-yes') ? '是' :
                    btn.classList.contains('v-no') ? '否' : '无法确定';
                send({
                    type: 'turtleAnswer',
                    playerId: state.playerId,
                    data: { roomId: state.roomId, questionNo: no, answer: verdict, hint: hintInput ? hintInput.value.trim() : '' }
                });
            });
        })(btns[b]);
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
    judgePanel.style.display = 'none';
    overPanel.style.display = 'none';
    state.qas = [];
    state.pending = [];
    state.answer = '';
    state.count = 0;
    turtleStory.textContent = '等待开局...';
    sourceTag.textContent = '--';
    renderLog();
    setFeedback('', '');
    if (state.isHost) {
        startBtn.disabled = state.players.length < 2;
        renderKickList();
    }
    refreshUi();
}

function enterPlaying(msg) {
    state.status = 'playing';
    setStatus('推理中', 'playing');
    hostPanel.style.display = 'none';
    overPanel.style.display = 'none';
    setFeedback('', '');

    if (msg) {
        state.players = msg.players || state.players;
        state.displayNames = msg.displayNames || state.displayNames;
        state.story = msg.story || '';
        state.source = msg.source || '';
        state.maxQuestions = msg.maxQuestions || 20;
        state.count = 0;
        state.qas = [];
        state.pending = [];
        state.roomHost = msg.host || state.roomHost;
        state.isHost = state.roomHost === state.playerId;
        sourceTag.textContent = state.source === 'local' ? 'LOCAL BANK' : 'AI GENERATED';
        turtleStory.textContent = '';
        if (window.MPOSTOR && window.MPOSTOR.fx && typeof window.MPOSTOR.fx.typewriter === 'function') {
            window.MPOSTOR.fx.typewriter(turtleStory, state.story, 45);
        } else {
            turtleStory.textContent = state.story;
        }
        renderLog();
        var diffTag = msg.difficulty === 'easy' ? '简单' : (msg.difficulty === 'hard' ? '困难' : '普通');
        setFeedback('// 难度：' + diffTag + (msg.difficulty === 'hard' ? ' · 多重反转' : ''), 'ok');
        if (window.MPOSTOR) {
            window.MPOSTOR.sound.play('confirm');
            window.MPOSTOR.fx.deployTransition('TURTLE SOUP // 海龟汤', null);
        }
        speak(state.story);
        if (state.isHost) speak('你是房主，等待玩家提问。');
    }
    refreshUi();
}

function showEnded(msg) {
    state.status = 'ended';
    setStatus('已结束', 'ended');
    hostPanel.style.display = 'none';
    judgePanel.style.display = 'none';
    overPanel.style.display = 'flex';
    refreshUi();

    var winnerName = msg && msg.winnerName;
    var answer = (msg && msg.answer) || state.revealedAnswer || state.answer || '';
    var isDraw = msg && msg.result === 'draw';

    if (winnerName) {
        resultIcon.textContent = '◍';
        resultTitle.textContent = 'WINNER: ' + winnerName;
        resultDesc.textContent = '汤底破译，真相大白。';
        speak('游戏结束。' + winnerName + ' 获胜。' + (answer ? '汤底是：' + answer : ''));
    } else if (isDraw) {
        resultIcon.textContent = '◍';
        resultTitle.textContent = 'DRAW';
        resultDesc.textContent = '本局平局。';
    } else {
        resultIcon.textContent = '◍';
        resultTitle.textContent = 'GAME OVER';
        resultDesc.textContent = '本局已结束，返回大厅继续。';
    }
    resultTitle.setAttribute('data-text', resultTitle.textContent);

    if (answer) {
        answerText.textContent = '汤底：' + answer;
        answerText.style.display = '';
    } else {
        answerText.style.display = 'none';
    }

    resetBtn.style.display = state.isHost ? '' : 'none';

    if (window.MPOSTOR) {
        var mine = (msg && msg.result === state.playerId);
        window.MPOSTOR.sound.play(mine ? 'victory' : 'defeat');
        window.MPOSTOR.stats.add('turtlePlayed');
        if (mine) {
            window.MPOSTOR.stats.add('turtleSolved');
            window.MPOSTOR.ach.unlock('turtle_solver');
        }
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
            state.maxPlayers = d.maxPlayers || 0;
            if (d.host) {
                state.roomHost = d.host;
                state.isHost = d.host === state.playerId;
            }
            roomIdTag.textContent = 'ROOM ' + state.roomId;

            // 快照
            if (d.story) state.story = d.story;
            if (d.source) state.source = d.source;
            if (d.maxQuestions) state.maxQuestions = d.maxQuestions;
            if (d.questionCount != null) state.count = d.questionCount;
            if (d.qas) state.qas = d.qas;
            if (d.pending) state.pending = d.pending;
            if (d.answer) state.answer = d.answer;
            if (d.keywords) state.keywords = d.keywords;

            if (d.gameOver || d.status === 'ended') {
                renderLog();
                showEnded(null);
            } else if (d.status === 'playing') {
                sourceTag.textContent = d.source === 'local' ? 'LOCAL BANK' : 'AI GENERATED';
                turtleStory.textContent = state.story;
                enterPlaying(null);
                var diffTag = d.difficulty === 'easy' ? '简单' : (d.difficulty === 'hard' ? '困难' : '普通');
                setFeedback('> 已重连 · 难度 ' + diffTag, 'ok');
                speak('已重连对局。');
            } else {
                enterWaiting();
            }
            break;
        }

        case 'turtleStarted':
            enterPlaying(message);
            break;

        case 'turtleHostSecret': {
            state.answer = message.answer || '';
            state.keywords = message.keywords || [];
            if (window.MPOSTOR) window.MPOSTOR.sound.play('secret');
            speak('你已获得汤底：' + state.answer);
            break;
        }

        case 'turtleAsked': {
            state.count = Math.max(state.count, message.no || 0);
            state.qas.push({
                no: message.no,
                playerId: message.playerName,
                question: message.question,
                answer: '',
                hint: ''
            });
            renderLog();
            refreshUi();
            if (window.MPOSTOR) window.MPOSTOR.sound.play('beep');
            if (state.isHost) speak(message.no + ' 号问题：' + message.question);
            break;
        }

        case 'turtleAnswered': {
            for (var i = 0; i < state.qas.length; i++) {
                if (state.qas[i].no === message.no) {
                    state.qas[i].answer = message.answer || '';
                    state.qas[i].hint = message.hint || '';
                }
            }
            state.pending = state.pending.filter(function (p) { return p.no !== message.no; });
            renderLog();
            refreshUi();
            if (window.MPOSTOR) window.MPOSTOR.sound.play('chirp');
            // 提问者本人播报判定
            for (var j = 0; j < state.qas.length; j++) {
                if (state.qas[j].no === message.no && state.qas[j].playerId === state.playerId) {
                    speak('第 ' + message.no + ' 个问题：' + message.answer + '。' + (message.hint || ''));
                }
            }
            break;
        }

        case 'turtleGuessResult': {
            var entry = document.createElement('div');
            entry.className = 'log-entry guess-entry' + (message.correct ? ' win' : '');
            entry.innerHTML =
                '<span class="log-q">猜</span>' +
                '<span class="log-question">' + escapeHtml(getDisplayName(message.playerName)) + ' 猜：' + escapeHtml(message.guess) + '</span>' +
                '<span class="log-verdict ' + (message.correct ? 'yes' : 'no') + '">' + (message.correct ? '✓ 猜中' : '✕ 未中') + '</span>' +
                (message.comment ? '<span class="log-hint">▸ ' + escapeHtml(message.comment) + '</span>' : '');
            turtleLog.appendChild(entry);
            turtleLog.scrollTop = turtleLog.scrollHeight;
            if (window.MPOSTOR) {
                window.MPOSTOR.sound.play(message.correct ? 'victory' : 'buzz');
                if (message.playerName === state.playerId && !message.correct) {
                    speak(message.comment || '还没猜中。');
                }
            }
            break;
        }

        case 'turtleRevealed': {
            state.revealedAnswer = message.answer || '';
            if (window.MPOSTOR) window.MPOSTOR.sound.play('secret');
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
function submitAsk() {
    if (askBtn.disabled || state.busy) return;
    var question = turtleInput.value.trim();
    if (!question) {
        setFeedback('✕ 请输入问题', 'err');
        return;
    }
    if (question.length < 2) {
        setFeedback('✕ 问题太短了，至少 2 个字', 'err');
        return;
    }
    state.busy = true;
    turtleInput.value = '';
    setFeedback('', '');
    send({ type: 'turtleAsk', playerId: state.playerId, data: { roomId: state.roomId, question: question } });
    setTimeout(function () { state.busy = false; }, 1000);
}

function submitGuess() {
    if (guessBtn.disabled || state.busy) return;
    var guess = turtleInput.value.trim();
    if (!guess) {
        setFeedback('✕ 请输入你的猜测', 'err');
        return;
    }
    state.busy = true;
    turtleInput.value = '';
    setFeedback('', '');
    send({ type: 'turtleGuess', playerId: state.playerId, data: { roomId: state.roomId, guess: guess } });
    setTimeout(function () { state.busy = false; }, 1000);
}

askBtn.addEventListener('click', submitAsk);
guessBtn.addEventListener('click', submitGuess);
turtleInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        submitAsk();
    }
});

revealBtn.addEventListener('click', function () {
    if (confirm('确定公布汤底吗？（你将获胜）')) {
        send({ type: 'turtleReveal', playerId: state.playerId, data: { roomId: state.roomId } });
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
    try { saved = JSON.parse(localStorage.getItem('turtleGameData') || 'null'); } catch (e) {}
    if (!state.roomId && saved && saved.roomId) state.roomId = saved.roomId;
    if (saved && saved.playerId) state.playerId = saved.playerId;
    if (saved && saved.isHost) state.isHost = saved.isHost;

    if (!state.roomId || !state.playerId) {
        fail('缺少房间信息，请从大厅重新进入');
    } else {
        roomIdTag.textContent = 'ROOM ' + state.roomId;
        window.MPOSTOR.voice.attachMic(turtleInput);
        connectWs();
    }
}
