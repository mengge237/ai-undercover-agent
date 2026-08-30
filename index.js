var WS_URL = 'ws://localhost:8080/ws/game';
var HTTP_URL = 'http://localhost:8080';

var GAME_TYPE_NAMES = { undercover: '卧底', bomb: '拆弹', idiom: '成语', turtle: '海龟汤', quiz: '问答' };

var roomList = document.getElementById('roomList');
var refreshRoomsBtn = document.getElementById('refreshRoomsBtn');
var statusDot = document.getElementById('statusDot');
var statusText = document.getElementById('statusText');
var playerIdDisplay = document.getElementById('playerIdDisplay');
var undercoverBtn = document.getElementById('undercoverBtn');
var guessBtn = document.getElementById('guessBtn');
var muteBtn = document.getElementById('muteBtn');

var state = {
    ws: null,
    connected: false,
    playerId: null,
    playerName: '玩家1',
    rooms: [],
    reconnectAttempts: 0,
    heartbeatTimer: null,
    roomIdMap: {}
};

function generatePlayerId() {
    var randomStr = String(Math.random()).substring(2, 6).toUpperCase();
    return 'P' + Date.now().toString(36).toUpperCase() + randomStr;
}

function getSavedPlayerInfo() {
    try {
        var saved = localStorage.getItem('uc_player_info');
        if (saved) {
            var info = JSON.parse(saved);
            state.playerId = info.playerId;
            state.playerName = info.playerName || '玩家1';
        }
    } catch (e) {}
    if (!state.playerId) {
        state.playerId = generatePlayerId();
    }
}

function savePlayerInfo() {
    try {
        localStorage.setItem('uc_player_info', JSON.stringify({
            playerId: state.playerId,
            playerName: state.playerName
        }));
    } catch (e) {}
}

function connectWebSocket() {
    setLed('warn');
    statusText.textContent = '连接中...';

    try {
        state.ws = new WebSocket(WS_URL);

        state.ws.onopen = function() {
            state.connected = true;
            state.reconnectAttempts = 0;
            setLed('on');
            statusText.textContent = '已连接';
            playerIdDisplay.textContent = '玩家: ' + state.playerId;

            // 先认证再 join/list
            var token = window.MPOSTOR.auth.token();
            if (token) sendMessage({ type: 'auth', data: { token: token } });

            sendMessage({
                type: 'join',
                playerId: state.playerId,
                data: { playerName: state.playerName }
            });
            sendMessage({ type: 'listRooms' });
            startHeartbeat();
        };

        state.ws.onmessage = function(event) {
            try {
                var message = JSON.parse(event.data);
                handleMessage(message);
            } catch (e) {}
        };

        state.ws.onclose = function() {
            state.connected = false;
            setLed('off');
            statusText.textContent = '已断开';
            stopHeartbeat();

            if (state.reconnectAttempts < 5) {
                state.reconnectAttempts++;
                setTimeout(connectWebSocket, 2000 * state.reconnectAttempts);
            }
        };

        state.ws.onerror = function() {};
    } catch (error) {
        setLed('off');
        statusText.textContent = '连接失败';
    }
}

function setLed(ledClass) {
    statusDot.className = 'led ' + ledClass;
}

function sendMessage(data) {
    if (state.ws && state.ws.readyState === WebSocket.OPEN) {
        state.ws.send(JSON.stringify(data));
        return true;
    }
    return false;
}

function startHeartbeat() {
    state.heartbeatTimer = setInterval(function() {
        sendMessage({ type: 'heartbeat', playerId: state.playerId });
    }, 30000);
}

function stopHeartbeat() {
    if (state.heartbeatTimer) {
        clearInterval(state.heartbeatTimer);
        state.heartbeatTimer = null;
    }
}

function handleMessage(message) {
    switch (message.type) {
        case 'roomList':
            renderRooms(message.rooms || []);
            break;
        case 'roomCreated':
        case 'roomJoined':
        case 'playerJoined':
        case 'playerLeft':
        case 'roomClosed':
        case 'roomReset':
        case 'gameStarted':
        case 'gameEnded':
        case 'playerKicked':
            sendMessage({ type: 'listRooms' });
            break;
        case 'error':
            // token 失效：清登录态回登录页
            if (message.message && message.message.indexOf('token') !== -1) {
                window.MPOSTOR.auth.logout();
                window.MPOSTOR.auth.require();
            }
            break;
    }
}

function renderRooms(rooms) {
    state.rooms = rooms;
    state.roomIdMap = {};

    if (!rooms || rooms.length === 0) {
        roomList.innerHTML = '<div class="empty-state"><p>暂无房间</p><span>点击上方「谁是卧底」创建房间</span></div>';
        return;
    }

    roomList.innerHTML = '';
    rooms.forEach(function(room) {
        state.roomIdMap[room.id] = room;
        var card = document.createElement('div');
        card.className = 'room-card';

        var statusClass = 'waiting';
        var statusText = 'WAIT';
        if (room.status === 'playing') { statusClass = 'playing'; statusText = 'LIVE'; }
        else if (room.status === 'ended') { statusClass = 'ended'; statusText = 'OVER'; }

        var playerCount = (room.players || []).length;
        var maxPlayers = room.maxPlayers || 6;
        var realCount = (room.players || []).filter(function(p) { return !p.startsWith('AI-'); }).length;

        var presetBadge = room.isPreset ? '<span class="preset-badge">SYS</span>' : '';
        var typeBadge = GAME_TYPE_NAMES[room.gameType]
            ? '<span class="type-badge">' + GAME_TYPE_NAMES[room.gameType] + '</span>' : '';

        card.innerHTML =
            '<div class="room-left">' +
                '<div>' +
                    '<div class="room-name">' + (room.name || room.id) + ' ' + typeBadge + ' ' + presetBadge + '</div>' +
                    '<div class="room-detail">' +
                        '<span>■ ' + playerCount + '/' + maxPlayers + ' 人</span>' +
                        '<span>◈ 真人 ' + realCount + '</span>' +
                        '<span>▤ ' + (room.category || '通用') + '</span>' +
                        (room.aiCount ? '<span>◎ AI ×' + room.aiCount + '</span>' : '') +
                    '</div>' +
                '</div>' +
                '<span class="room-status ' + statusClass + '">' + statusText + '</span>' +
            '</div>' +
            '<div class="room-actions">' +
                '<button class="btn-join" data-room-id="' + room.id + '"' +
                    (room.status !== 'waiting' || playerCount >= maxPlayers ? ' disabled' : '') + '>' +
                    (room.status === 'playing' ? '观战' : '加入') +
                '</button>' +
            '</div>';

        roomList.appendChild(card);
    });

    roomList.querySelectorAll('.btn-join').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var roomId = btn.getAttribute('data-room-id');
            window.MPOSTOR.ach.unlock('social');
            window.MPOSTOR.sound.play('confirm');
            joinRoom(roomId);
        });
    });
}

function joinRoom(roomId) {
    localStorage.setItem('uc_join_room_id', roomId);
    localStorage.setItem('uc_join_from', 'home');
    window.location.href = 'src/pages/game-hall/index.html?action=join&roomId=' + encodeURIComponent(roomId);
}

undercoverBtn.addEventListener('click', function() {
    window.location.href = 'src/pages/game-hall/index.html';
});

guessBtn.addEventListener('click', function() {
    window.location.href = 'src/pages/guess-word/index.html';
});

document.getElementById('turtleBtn').addEventListener('click', function() {
    window.location.href = 'src/pages/turtle-soup/index.html';
});

document.getElementById('quizBtn').addEventListener('click', function() {
    window.location.href = 'src/pages/quiz/index.html';
});

document.getElementById('bombBtn').addEventListener('click', function() {
    window.location.href = 'src/pages/number-bomb/index.html';
});

document.getElementById('idiomBtn').addEventListener('click', function() {
    window.location.href = 'src/pages/idiom-chain/index.html';
});

refreshRoomsBtn.addEventListener('click', function() {
    if (state.connected) {
        sendMessage({ type: 'listRooms' });
    }
});

/* ---- MPOSTOR 趣味钩子 ---- */
if (muteBtn && window.MPOSTOR) {
    function syncMuteBtn() {
        var muted = window.MPOSTOR.sound.isMuted();
        muteBtn.textContent = muted ? 'SND:OFF' : 'SND:ON';
        muteBtn.className = muted ? 'btn btn-sm btn-alert' : 'btn btn-sm';
    }
    muteBtn.addEventListener('click', function() {
        window.MPOSTOR.sound.toggleMute();
        syncMuteBtn();
    });
    syncMuteBtn();
}

/* ---- 全局登录门禁 + 账号 UI ---- */
function updateAccountUI() {
    var acc = window.MPOSTOR.auth.get();
    var chip = document.getElementById('accountChip');
    if (chip && acc) chip.textContent = '账号: ' + acc.username;
}

var logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', function () {
        if (!confirm('确定要退出登录吗？')) return;
        var token = window.MPOSTOR.auth.token();
        if (token) {
            fetch(HTTP_URL + '/api/auth/logout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
            }).catch(function () {});
        }
        window.MPOSTOR.auth.logout();
        window.location.href = 'src/pages/login/index.html?redirect=index.html';
    });
}

if (window.MPOSTOR.auth.get()) {
    updateAccountUI();
    getSavedPlayerInfo();
    savePlayerInfo();
    connectWebSocket();
} else {
    // 未登录：跳登录页（登录后回跳首页）
    window.MPOSTOR.auth.require();
}
