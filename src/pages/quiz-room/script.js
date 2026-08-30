// ========== MPOSTOR 趣味问答 · 联机房间 ==========

console.log('? 趣味问答联机房间已加载');

var WS_URL = 'ws://localhost:8080/ws/game';
var OPTION_KEYS = ['A', 'B', 'C', 'D'];

// ========== DOM 引用 ==========
var roomIdTag = document.getElementById('roomIdTag');
var gameStatus = document.getElementById('gameStatus');
var playerCount = document.getElementById('playerCount');
var playersList = document.getElementById('playersList');
var questionNo = document.getElementById('questionNo');
var sourceTag = document.getElementById('sourceTag');
var progressTag = document.getElementById('progressTag');
var quizQuestion = document.getElementById('quizQuestion');
var quizOptions = document.getElementById('quizOptions');
var quizFeedback = document.getElementById('quizFeedback');
var revealBox = document.getElementById('revealBox');
var revealExplanation = document.getElementById('revealExplanation');
var revealResults = document.getElementById('revealResults');
var nextBtn = document.getElementById('nextBtn');
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
    roomHost: null,
    ws: null,
    connected: false,
    status: 'connecting',   // connecting | waiting | playing | ended
    players: [],
    displayNames: {},
    scores: {},
    total: 5,
    source: '',
    category: '',
    currentNo: 1,
    hasAnswered: false,
    revealed: false,
    answeredCount: 0,
    totalPlayers: 0,
    question: '',
    options: [],
    correctIndex: -1,
    explanation: '',
    myIndex: null,
    maxPlayers: 0,
    busy: false
};

// ========== 工具 ==========
function setStatus(text, cls) {
    gameStatus.textContent = text;
    gameStatus.className = 'status' + (cls ? ' ' + cls : '');
}

function setFeedback(text, cls) {
    quizFeedback.textContent = text;
    quizFeedback.className = 'feedback-line' + (cls ? ' ' + cls : '');
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
function renderQuestion(q, no) {
    state.question = q.question;
    state.options = q.options || [];
    state.currentNo = no;
    state.hasAnswered = false;
    state.revealed = false;
    state.myIndex = null;

    quizQuestion.textContent = q.question;
    questionNo.textContent = 'Q' + no + '/' + state.total;
    setFeedback('', '');
    revealBox.style.display = 'none';
    quizOptions.innerHTML = '';

    for (var i = 0; i < state.options.length; i++) {
        var btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerHTML = '<span class="option-key">' + (OPTION_KEYS[i] || (i + 1)) + '</span><span>' + escapeHtml(state.options[i]) + '</span>';
        (function (index, b) {
            b.addEventListener('click', function () {
                if (state.hasAnswered || state.revealed || state.busy || state.status !== 'playing') return;
                state.busy = true;
                state.myIndex = index;
                b.classList.add('picked');
                setFeedback('已选择 ' + (OPTION_KEYS[index] || (index + 1)) + '，等待其他玩家作答...', 'ok');
                send({ type: 'quizAnswer', playerId: state.playerId, data: { roomId: state.roomId, index: index } });
                setTimeout(function () { state.busy = false; }, 1000);
            });
        })(i, btn);
        quizOptions.appendChild(btn);
    }

    var speakText = '第' + no + '题。' + q.question;
    for (var s = 0; s < state.options.length; s++) {
        speakText += '。选项' + (OPTION_KEYS[s] || (s + 1)) + '，' + state.options[s];
    }
    speak(speakText);
}

function renderReveal(msg) {
    state.revealed = true;
    state.hasAnswered = true;
    state.correctIndex = msg.correctIndex;
    state.explanation = msg.explanation || '';
    if (msg.scores) state.scores = msg.scores;

    var btns = quizOptions.querySelectorAll('.option-btn');
    for (var i = 0; i < btns.length; i++) {
        btns[i].disabled = true;
        if (i === msg.correctIndex) btns[i].classList.add('correct');
        else if (i === state.myIndex) btns[i].classList.add('wrong');
    }

    revealBox.style.display = '';
    revealExplanation.textContent = '解析：' + state.explanation;

    // 各玩家作答结果
    var results = msg.results || [];
    revealResults.innerHTML = '';
    for (var r = 0; r < results.length; r++) {
        var res = results[r];
        var row = document.createElement('div');
        row.className = 'reveal-row' + (res.correct ? ' ok' : ' no');
        row.innerHTML = '<span>' + getDisplayName(res.playerId) + '</span>' +
            '<span>' + (res.correct ? '✓ 正确' : '✕ 错误') + '</span>';
        revealResults.appendChild(row);
    }

    // 本人对错反馈
    var myResult = null;
    for (var m = 0; m < results.length; m++) {
        if (results[m].playerId === state.playerId) myResult = results[m];
    }
    if (myResult) {
        setFeedback(myResult.correct ? '▣ 回答正确！' : '✕ 回答错误。', myResult.correct ? 'ok' : 'err');
        if (window.MPOSTOR) {
            window.MPOSTOR.sound.play(myResult.correct ? 'chirp' : 'buzz');
            if (!myResult.correct) window.MPOSTOR.fx.glitch(250);
            speak((myResult.correct ? '回答正确。' : '回答错误。') + (state.explanation || ''));
        }
    }

    updatePlayers();
    nextBtn.style.display = (state.isHost && state.status === 'playing') ? '' : 'none';
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
        var score = state.scores[p] != null ? state.scores[p] : 0;
        var answeredMark = '';
        if (state.status === 'playing' && !state.revealed) {
            answeredMark = state.hasAnswered || (state.myIndex != null)
                ? '<span class="player-badge answered">已答</span>'
                : '<span class="player-badge thinking">思考中</span>';
        }
        row.innerHTML =
            '<span class="player-name">' + getDisplayName(p) + '</span>' +
            (p === state.playerId ? '<span class="player-badge me">你</span>' : '') +
            (p === state.roomHost ? '<span class="player-badge host">房主</span>' : '') +
            answeredMark +
            '<span class="player-score">' + score + ' 分</span>';
        playersList.appendChild(row);
    }
    playerCount.textContent = state.players.length + '/' + (state.maxPlayers || '?');
}

function refreshUi() {
    updatePlayers();
    progressTag.textContent = '已答 ' + state.answeredCount + '/' + state.totalPlayers;
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
    revealBox.style.display = 'none';
    quizQuestion.textContent = '等待开局...';
    questionNo.textContent = 'Q0/0';
    quizOptions.innerHTML = '';
    setFeedback('', '');
    state.scores = {};
    state.answeredCount = 0;
    state.totalPlayers = 0;
    if (state.isHost) {
        startBtn.disabled = state.players.length < 2;
        renderKickList();
    }
    refreshUi();
}

function enterPlaying(msg) {
    state.status = 'playing';
    setStatus('答题中', 'playing');
    hostPanel.style.display = 'none';
    overPanel.style.display = 'none';
    setFeedback('', '');

    if (msg) {
        state.players = msg.players || state.players;
        state.displayNames = msg.displayNames || state.displayNames;
        state.total = msg.total || 5;
        state.source = msg.source || '';
        state.category = msg.category || '';
        state.scores = {};
        for (var i = 0; i < state.players.length; i++) state.scores[state.players[i]] = 0;
        state.totalPlayers = state.players.length;
        state.answeredCount = 0;
        sourceTag.textContent = state.source === 'local' ? 'LOCAL BANK' : 'AI GENERATED';
        var diffTag = msg.difficulty === 'easy' ? '简单' : (msg.difficulty === 'hard' ? '困难' : '普通');
        setFeedback('// 难度：' + diffTag + (msg.difficulty === 'hard' ? ' · 冷知识题库' : ''), 'ok');
        if (window.MPOSTOR) {
            window.MPOSTOR.sound.play('confirm');
            window.MPOSTOR.fx.deployTransition('QUIZ ARENA // 趣味问答', null);
        }
        speak('答题开始，共 ' + state.total + ' 题。');
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
    var isDraw = msg && msg.result === 'draw';
    if (winnerName) {
        resultIcon.textContent = '?';
        resultTitle.textContent = 'WINNER: ' + winnerName;
        resultDesc.textContent = '本轮积分最高，知识就是力量。';
    } else if (isDraw) {
        resultIcon.textContent = '?';
        resultTitle.textContent = 'DRAW';
        resultDesc.textContent = '并列第一，皆大欢喜。';
    } else {
        resultIcon.textContent = '?';
        resultTitle.textContent = 'GAME OVER';
        resultDesc.textContent = '本局已结束，返回大厅继续。';
    }
    resultTitle.setAttribute('data-text', resultTitle.textContent);

    var ranking = msg && msg.ranking;
    rankingList.innerHTML = '';
    if (ranking && ranking.length) {
        for (var i = 0; i < ranking.length; i++) {
            var r = ranking[i];
            var row = document.createElement('div');
            row.className = 'ranking-row' + (i === 0 && !isDraw ? ' win' : '');
            row.innerHTML = '<span>' + (i + 1) + '. ' + (r.name || r.playerId) + '</span>' +
                '<span>' + (r.score != null ? r.score : 0) + ' 分</span>';
            rankingList.appendChild(row);
        }
    }

    resetBtn.style.display = state.isHost ? '' : 'none';

    if (window.MPOSTOR) {
        var mine = (msg && msg.result === state.playerId);
        window.MPOSTOR.sound.play(mine ? 'victory' : 'defeat');
        window.MPOSTOR.stats.add('quizPlayed');
        window.MPOSTOR.stats.add('quizScore', state.scores[state.playerId] || 0);
        if (mine) window.MPOSTOR.ach.unlock('quiz_perfect');
        speak(winnerName ? ('游戏结束。' + winnerName + ' 获胜。') : '游戏结束。');
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
            if (d.total) state.total = d.total;
            if (d.source) state.source = d.source;
            if (d.category) state.category = d.category;
            if (d.scores) state.scores = d.scores;
            if (d.questionNo) state.currentNo = d.questionNo;
            if (d.hasAnswered != null) state.hasAnswered = d.hasAnswered;
            if (d.answeredCount != null) state.answeredCount = d.answeredCount;
            if (d.revealed != null) state.revealed = d.revealed;
            state.totalPlayers = d.totalPlayers || state.players.length;

            if (d.gameOver || d.status === 'ended') {
                sourceTag.textContent = d.source === 'local' ? 'LOCAL BANK' : 'AI GENERATED';
                var endMsg = null;
                if (d.ranking && d.ranking.length) {
                    endMsg = { ranking: d.ranking, result: 'draw', winnerName: '' };
                    var top = d.ranking[0];
                    var second = d.ranking[1];
                    if (!second || second.score !== top.score) {
                        endMsg.result = top.playerId;
                        endMsg.winnerName = top.name || top.playerId;
                    }
                }
                showEnded(endMsg);
            } else if (d.status === 'playing') {
                sourceTag.textContent = d.source === 'local' ? 'LOCAL BANK' : 'AI GENERATED';
                enterPlaying(null);
                var diffTag = d.difficulty === 'easy' ? '简单' : (d.difficulty === 'hard' ? '困难' : '普通');
                if (d.question) {
                    renderQuestion({ question: d.question, options: d.options || [] }, d.questionNo || state.currentNo);
                    if (d.revealed) {
                        renderReveal({
                            correctIndex: d.correctIndex,
                            explanation: d.explanation || '',
                            results: [],
                            scores: d.scores || state.scores
                        });
                        setFeedback('> 已重连，本题已揭晓', 'ok');
                    } else if (d.hasAnswered) {
                        var btns = quizOptions.querySelectorAll('.option-btn');
                        for (var i = 0; i < btns.length; i++) btns[i].disabled = true;
                        setFeedback('> 已重连，等待其他玩家作答...', 'ok');
                    } else {
                        setFeedback('> 已重连 · 难度 ' + diffTag + ' · 请作答', 'ok');
                    }
                    speak('已重连对局。第' + (d.questionNo || state.currentNo) + '题。');
                }
            } else {
                enterWaiting();
            }
            break;
        }

        case 'quizStarted':
            enterPlaying(message);
            break;

        case 'quizQuestion':
            renderQuestion(message, message.questionNo || 1);
            state.answeredCount = 0;
            refreshUi();
            break;

        case 'quizAnswered':
            state.answeredCount = message.answeredCount != null ? message.answeredCount : state.answeredCount;
            state.totalPlayers = message.totalPlayers || state.totalPlayers;
            refreshUi();
            break;

        case 'quizReveal':
            state.answeredCount = message.answeredCount != null ? message.answeredCount : state.answeredCount;
            renderReveal(message);
            refreshUi();
            break;

        case 'gameEnded':
            state.displayNames = message.displayNames || state.displayNames;
            if (message.scores) state.scores = message.scores;
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
nextBtn.addEventListener('click', function () {
    send({ type: 'quizNext', playerId: state.playerId, data: { roomId: state.roomId } });
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
    try { saved = JSON.parse(localStorage.getItem('quizGameData') || 'null'); } catch (e) {}
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
