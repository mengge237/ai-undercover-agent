var WS_URL = 'ws://localhost:8080/ws/game';
var HTTP_URL = 'http://localhost:8080';

var GAME_TYPE_NAMES = { undercover: '谁是卧底', bomb: '拆弹小队', idiom: '成语接龙', turtle: '海龟汤', quiz: '趣味问答' };
var DIFF_NAMES = { easy: '简单', normal: '普通', hard: '困难' };
var GAME_PAGES = { undercover: 'game-play', bomb: 'bomb-room', idiom: 'idiom-room', turtle: 'turtle-room', quiz: 'quiz-room' };
var GAME_STORAGE = { undercover: 'undercoverGameData', bomb: 'bombGameData', idiom: 'idiomGameData', turtle: 'turtleGameData', quiz: 'quizGameData' };
var GAME_DESC = {
    bomb: '轮流剪线逼近密码，剪断密码线者拆弹获胜，剪线次数耗尽全员阵亡',
    idiom: 'LLM 当裁判轮流接龙，2 次犯规淘汰，可房主跳过',
    turtle: '房主掌握汤底，是/否提问推理，猜中汤底者胜（20 问上限）',
    quiz: '同题竞技共 5 题，全员答完自动揭晓，积分排名'
};

var roomList = document.getElementById('roomList');
var roomNameInput = document.getElementById('roomNameInput');
var playerNameInput = document.getElementById('playerNameInput');
var roomPasswordInput = document.getElementById('roomPasswordInput');
var categorySelect = document.getElementById('categorySelect');
var createRoomBtn = document.getElementById('createRoomBtn');
var refreshRoomsBtn = document.getElementById('refreshRoomsBtn');
var statusDot = document.getElementById('statusDot');
var statusText = document.getElementById('statusText');
var accountChip = document.getElementById('accountChip');
var tabBar = document.getElementById('tabBar');
var undercoverForm = document.getElementById('undercoverForm');
var simpleForm = document.getElementById('simpleForm');
var simpleOperator = document.getElementById('simpleOperator');
var simpleRoomName = document.getElementById('simpleRoomName');
var simplePassword = document.getElementById('simplePassword');
var simpleDesc = document.getElementById('simpleDesc');
var simpleCreateBtn = document.getElementById('simpleCreateBtn');

var passwordModal = document.getElementById('passwordModal');
var passwordInput = document.getElementById('passwordInput');
var passwordRoomName = document.getElementById('passwordRoomName');
var passwordConfirmBtn = document.getElementById('passwordConfirmBtn');
var passwordCancelBtn = document.getElementById('passwordCancelBtn');

var state = {
    ws: null,
    connected: false,
    playerId: null,
    playerName: '玩家1',
    currentRoom: null,
    rooms: [],
    totalPlayers: 6,
    simplePlayers: 4,
    aiEnabled: true,
    difficulty: 'normal',
    tab: 'undercover',
    reconnectAttempts: 0,
    heartbeatTimer: null,
    isCreating: false,
    pendingJoinRoom: null,
    roomIdMap: {}
};

function generatePlayerId() {
    var randomStr = String(Math.random()).substring(2, 6).toUpperCase();
    return 'P' + Date.now().toString(36).toUpperCase() + randomStr;
}

function connectWebSocket() {
    statusDot.className = 'status-dot connecting';
    statusText.textContent = '连接中...';

    try {
        state.ws = new WebSocket(WS_URL);

        state.ws.onopen = function() {
            state.connected = true;
            state.reconnectAttempts = 0;
            statusDot.className = 'status-dot online';
            statusText.textContent = '已连接';

            // 先认证（joinRoom/createRoom 需要账号）
            var token = window.MPOSTOR.auth.token();
            if (token) sendMessage({ type: 'auth', data: { token: token } });

            sendMessage({
                type: 'join',
                playerId: state.playerId,
                data: { playerName: state.playerName }
            });
            sendMessage({ type: 'listRooms' });
            startHeartbeat();

            var action = getQueryParam('action');
            var roomId = getQueryParam('roomId');
            if (action === 'join' && roomId) {
                setTimeout(function() {
                    joinRoom(roomId, null);
                }, 400);
            }
        };

        state.ws.onmessage = function(event) {
            try {
                var message = JSON.parse(event.data);
                handleMessage(message);
            } catch (e) {
                alert('消息解析失败: ' + e.message);
            }
        };

        state.ws.onclose = function() {
            state.connected = false;
            statusDot.className = 'status-dot offline';
            statusText.textContent = '已断开';
            stopHeartbeat();

            if (state.reconnectAttempts < 5) {
                state.reconnectAttempts++;
                setTimeout(connectWebSocket, 3000);
            } else {
                statusText.textContent = '连接失败，刷新重试';
            }
        };

        state.ws.onerror = function() {
            statusDot.className = 'status-dot offline';
            statusText.textContent = '连接异常';
        };

    } catch (error) {
        statusDot.className = 'status-dot offline';
        statusText.textContent = '连接失败';
    }
}

function sendMessage(message) {
    if (state.ws && state.ws.readyState === WebSocket.OPEN) {
        state.ws.send(JSON.stringify(message));
        return true;
    }
    return false;
}

function startHeartbeat() {
    stopHeartbeat();
    state.heartbeatTimer = setInterval(function() {
        sendMessage({ type: 'heartbeat' });
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
        case 'joinSuccess':
            // 修复 #7：playerId 在 message.data 下
            state.playerId = (message.data && message.data.playerId) || message.playerId;
            savePlayerInfo();
            break;

        case 'authSuccess':
            break;

        case 'roomList':
            var newRooms = {};
            if (message.rooms) {
                for (var i = 0; i < message.rooms.length; i++) {
                    var r = message.rooms[i];
                    newRooms[r.id] = r;
                }
            }
            state.roomIdMap = newRooms;
            state.rooms = Object.values(newRooms);
            renderRoomList();
            break;

        case 'roomCreated':
            // 修复 #6：房间信息在 message.data 下
            var room = (message.data && message.data.id) ? message.data : (message.room || null);
            if (room && room.id) {
                state.roomIdMap[room.id] = room;
                state.rooms = Object.values(state.roomIdMap);
                renderRoomList();

                state.currentRoom = room.id;
                if (window.MPOSTOR) {
                    window.MPOSTOR.ach.unlock('host');
                    window.MPOSTOR.sound.play('confirm');
                }
                saveAndNavigate(room.id, room, true);
            }
            break;

        case 'roomJoined':
            var roomId = message.roomId || (message.data && message.data.roomId);
            if (roomId) {
                state.currentRoom = roomId;
                if (window.MPOSTOR) {
                    window.MPOSTOR.ach.unlock('social');
                    window.MPOSTOR.sound.play('confirm');
                }
                var room = state.roomIdMap[roomId];
                saveAndNavigate(roomId, room, false);
            }
            if (passwordModal) {
                passwordModal.classList.remove('active');
                passwordInput.value = '';
            }
            break;

        case 'roomUpdated':
            if (message.room) {
                state.roomIdMap[message.room.id] = message.room;
                state.rooms = Object.values(state.roomIdMap);
                renderRoomList();
            }
            break;

        case 'roomRemoved':
            if (message.roomId) {
                delete state.roomIdMap[message.roomId];
                state.rooms = Object.values(state.roomIdMap);
                renderRoomList();
            }
            break;

        case 'playerJoined':
        case 'playerLeft':
            sendMessage({ type: 'listRooms' });
            break;

        case 'playerKicked':
            alert('你已被踢出房间！');
            state.currentRoom = null;
            sendMessage({ type: 'listRooms' });
            break;

        case 'roomClosed':
            alert('房间已关闭');
            state.currentRoom = null;
            sendMessage({ type: 'listRooms' });
            break;

        case 'roomReset':
            alert('房间已重置，可以重新开始');
            sendMessage({ type: 'listRooms' });
            break;

        case 'leaveSuccess':
            state.currentRoom = null;
            sendMessage({ type: 'listRooms' });
            break;

        case 'gameStarted':
            localStorage.removeItem('undercoverGameData');
            if (window.MPOSTOR) {
                window.MPOSTOR.sound.play('confirm');
                window.MPOSTOR.fx.glitch(500);
            }
            saveAndNavigate(message.roomId, message, message.isHost);
            break;

        case 'bombStarted':
        case 'idiomStarted':
        case 'turtleStarted':
        case 'quizStarted':
            // 开局广播到达时仍在大厅：跳对应房间页
            if (window.MPOSTOR) {
                window.MPOSTOR.sound.play('confirm');
                window.MPOSTOR.fx.glitch(500);
            }
            var startedRoom = state.roomIdMap[message.roomId] || {};
            var isHost = startedRoom.host === state.playerId;
            if (message.host) isHost = message.host === state.playerId;
            saveAndNavigate(message.roomId, startedRoom, isHost);
            break;

        case 'rejoinSuccess':
            var rj = message.data || message;
            var rjHost = (rj.host === state.playerId) || !!rj.isHost;
            saveAndNavigate(message.roomId, rj, rjHost);
            break;

        case 'error':
            if (window.MPOSTOR) window.MPOSTOR.sound.play('error');
            if (message.message && message.message.indexOf('token') !== -1) {
                window.MPOSTOR.auth.logout();
                window.MPOSTOR.auth.require();
                return;
            }
            alert(message.message || '操作失败');
            if (message.message && message.message.indexOf('游戏进行中') !== -1) {
                sendMessage({ type: 'listRooms' });
            }
            break;
    }
}

function saveAndNavigate(roomId, roomData, isHost) {
    var gameType = (roomData && roomData.gameType) || 'undercover';
    var page = GAME_PAGES[gameType] || 'game-play';
    var storageKey = GAME_STORAGE[gameType] || 'undercoverGameData';

    var gameData = {
        roomId: roomId,
        gameType: gameType,
        playerId: state.playerId,
        isHost: !!isHost,
        timestamp: Date.now()
    };
    if (gameType === 'undercover') {
        // 游戏页仍按旧字段读取
        gameData.players = (roomData && roomData.players) || [];
        gameData.civilianWord = (roomData && roomData.civilianWord) || '';
        gameData.undercoverWord = (roomData && roomData.undercoverWord) || '';
        gameData.undercoverIndex = (roomData && roomData.undercoverIndex) || 0;
        gameData.playerWords = (roomData && roomData.playerWords) || {};
        gameData.maxPlayers = (roomData && roomData.maxPlayers) || 6;
        gameData.aiCount = (roomData && roomData.aiCount) || 0;
    }
    localStorage.setItem(storageKey, JSON.stringify(gameData));
    window.location.href = '../' + page + '/index.html?roomId=' + roomId;
}

function renderRoomList() {
    roomList.innerHTML = '';
    // 客户端按当前选项卡过滤
    var rooms = Object.values(state.roomIdMap).filter(function(r) {
        return (r.gameType || 'undercover') === state.tab;
    });

    if (rooms.length === 0) {
        roomList.innerHTML = '<div class="empty-state"><p>暂无' + (GAME_TYPE_NAMES[state.tab] || '') + '房间</p><span>点击右侧创建房间</span></div>';
        return;
    }

    rooms.sort(function(a, b) {
        return (a.createdAt || 0) - (b.createdAt || 0);
    });

    for (var i = 0; i < rooms.length; i++) {
        var room = rooms[i];
        var card = document.createElement('div');
        card.className = 'room-card';

        var playerCount = room.players ? room.players.length : 0;
        var maxPlayers = room.maxPlayers || 6;
        var isFull = playerCount >= maxPlayers;
        var isPlaying = room.status === 'playing';
        var isInRoom = room.players && room.players.indexOf(state.playerId) !== -1;
        var isHost = room.host === state.playerId;
        var isGameOver = room.gameOver === true;
        var hasPassword = room.hasPassword === true;
        var isPreset = room.isPreset === true;
        var names = room.displayNames || {};
        var hostName = names[room.host] || room.host || '---';

        var realCount = 0;
        if (room.players) {
            for (var ri = 0; ri < room.players.length; ri++) {
                if (!room.players[ri].startsWith('AI-')) realCount++;
            }
        }

        var statusText2 = '等待中';
        var statusClass = 'waiting';
        if (isPlaying) { statusText2 = '游戏中'; statusClass = 'playing'; }
        else if (isFull) { statusText2 = '已满'; }
        else if (isGameOver) { statusText2 = '已结束'; statusClass = 'ended'; }

        var leftDiv = document.createElement('div');
        leftDiv.className = 'room-left';
        leftDiv.innerHTML =
            '<span class="room-name">' + (room.name || '未命名') + '</span>' +
            '<span class="type-badge">' + (GAME_TYPE_NAMES[room.gameType] || '卧底') + '</span>' +
            '<span class="diff-badge diff-' + (room.difficulty || 'normal') + '">' + (DIFF_NAMES[room.difficulty] || '普通') + '</span>' +
            (hasPassword ? '<span style="font-size:12px;color:#999;">[锁]</span>' : '') +
            (isPreset ? '<span class="preset-badge">系统</span>' : '') +
            '<span class="room-detail">' +
                '<span>◈ ' + playerCount + '/' + maxPlayers + '</span>' +
                '<span class="real-player-badge">真人:' + realCount + '</span>' +
                '<span>◉ ' + hostName + '</span>' +
                (room.category ? '<span>▤ ' + room.category + '</span>' : '') +
                (room.aiCount > 0 ? '<span>[AI] ' + room.aiCount + '</span>' : '') +
            '</span>' +
            '<span class="room-status ' + statusClass + '">' + statusText2 + '</span>' +
            (isInRoom ? '<span style="font-size:12px;color:var(--green);">✓ 已加入</span>' : '');

        var actionsDiv = document.createElement('div');
        actionsDiv.className = 'room-actions';

        if (isHost && !isPlaying && !isGameOver) {
            var startBtn = document.createElement('button');
            startBtn.className = 'btn-start-game';
            startBtn.textContent = playerCount >= 1 ? '» 开始' : '等待';
            startBtn.disabled = playerCount < 1;
            (function(rid) {
                startBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    startGame(rid);
                });
            })(room.id);
            actionsDiv.appendChild(startBtn);
        }

        var joinBtn = document.createElement('button');
        joinBtn.className = 'btn-join';
        if (isInRoom) {
            joinBtn.textContent = '已加入';
            joinBtn.className = 'btn-join joined';
            joinBtn.disabled = true;
        } else if (isFull || isPlaying || isGameOver) {
            if (isPlaying) joinBtn.textContent = '游戏中';
            else if (isGameOver) joinBtn.textContent = '已结束';
            else joinBtn.textContent = '已满';
            joinBtn.disabled = true;
        } else {
            joinBtn.textContent = hasPassword ? '[锁] 加入' : '加入';
            (function(rid, hpwd, rname) {
                joinBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    if (hpwd) {
                        showPasswordModal(rid, rname);
                    } else {
                        joinRoom(rid, null);
                    }
                });
            })(room.id, hasPassword, room.name);
        }
        actionsDiv.appendChild(joinBtn);

        if (isInRoom && !isPreset) {
            var leaveBtn = document.createElement('button');
            leaveBtn.className = 'btn-leave';
            leaveBtn.textContent = '退出';
            (function(rid) {
                leaveBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    leaveRoom(rid);
                });
            })(room.id);
            actionsDiv.appendChild(leaveBtn);
        }

        if (isHost && isGameOver) {
            var resetBtn = document.createElement('button');
            resetBtn.className = 'btn-reset';
            resetBtn.textContent = '重置';
            (function(rid) {
                resetBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    resetRoom(rid);
                });
            })(room.id);
            actionsDiv.appendChild(resetBtn);
        }

        if (isHost && !isPreset && !isPlaying) {
            var closeBtn = document.createElement('button');
            closeBtn.className = 'btn-close';
            closeBtn.textContent = '解散';
            (function(rid) {
                closeBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    closeRoom(rid);
                });
            })(room.id);
            actionsDiv.appendChild(closeBtn);
        }

        if (isHost && !isPlaying && !isGameOver && room.players) {
            for (var pi = 0; pi < room.players.length; pi++) {
                var p = room.players[pi];
                if (p !== state.playerId && !p.startsWith('AI-')) {
                    var kickBtn = document.createElement('button');
                    kickBtn.className = 'btn-kick';
                    kickBtn.textContent = '✕';
                    kickBtn.title = '踢出 ' + (names[p] || p);
                    (function(rid, target) {
                        kickBtn.addEventListener('click', function(e) {
                            e.stopPropagation();
                            if (confirm('确定要踢出 ' + (names[target] || target) + ' 吗？')) {
                                kickPlayer(rid, target);
                            }
                        });
                    })(room.id, p);
                    actionsDiv.appendChild(kickBtn);
                }
            }
        }

        card.appendChild(leftDiv);
        card.appendChild(actionsDiv);
        roomList.appendChild(card);
    }
}

function showPasswordModal(roomId, roomName) {
    passwordRoomName.textContent = '房间: ' + (roomName || '未命名');
    passwordInput.value = '';
    state.pendingJoinRoom = roomId;
    passwordModal.classList.add('active');
    setTimeout(function() { passwordInput.focus(); }, 100);
}

function closePasswordModal() {
    passwordModal.classList.remove('active');
    passwordInput.value = '';
    state.pendingJoinRoom = null;
}

/* ---- 选项卡 ---- */
function activateTab(tab, silent) {
    if (!GAME_PAGES[tab]) tab = 'undercover';
    state.tab = tab;
    localStorage.setItem('hall_tab', tab);
    if (!silent) {
        var url = new URL(window.location.href);
        url.searchParams.set('tab', tab);
        history.replaceState(null, '', url.toString());
    }

    var btns = tabBar.querySelectorAll('.tab-btn');
    for (var i = 0; i < btns.length; i++) {
        btns[i].classList.toggle('active', btns[i].dataset.tab === tab);
    }

    var isUndercover = tab === 'undercover';
    undercoverForm.style.display = isUndercover ? '' : 'none';
    simpleForm.style.display = isUndercover ? 'none' : '';
    if (!isUndercover) {
        simpleOperator.textContent = '操作员: ' + state.playerName;
        simpleDesc.textContent = '// ' + (GAME_DESC[tab] || '');
    }
    renderRoomList();
}

/* ---- 创建房间 ---- */
function createRoom() {
    if (state.isCreating) return;
    if (state.currentRoom) {
        if (!confirm('你已在房间中，确定要创建新房间吗？')) return;
    }

    var name = roomNameInput.value.trim() || '我的房间';
    var playerName = playerNameInput.value.trim() || '玩家';
    state.playerName = playerName;
    var maxPlayers = state.totalPlayers;
    var aiCount = state.aiEnabled ? Math.max(0, maxPlayers - 1) : 0;
    var category = categorySelect.value;
    var password = roomPasswordInput.value.trim();
    var difficulty = state.difficulty;

    state.isCreating = true;
    createRoomBtn.disabled = true;
    createRoomBtn.textContent = '创建中...';

    if (!state.connected || !state.ws || state.ws.readyState !== WebSocket.OPEN) {
        connectWebSocket();
        setTimeout(function() {
            sendCreateRoom(name, playerName, maxPlayers, aiCount, category, password, difficulty, 'undercover');
        }, 1000);
    } else {
        sendCreateRoom(name, playerName, maxPlayers, aiCount, category, password, difficulty, 'undercover');
    }
}

function createSimpleRoom() {
    if (state.isCreating) return;
    if (state.currentRoom) {
        if (!confirm('你已在房间中，确定要创建新房间吗？')) return;
    }

    var name = simpleRoomName.value.trim() || '我的房间';
    var password = simplePassword.value.trim();

    state.isCreating = true;
    simpleCreateBtn.disabled = true;
    simpleCreateBtn.textContent = '创建中...';

    var send = function() {
        var success = sendMessage({
            type: 'createRoom',
            playerId: state.playerId,
            data: {
                name: name,
                playerName: state.playerName,
                maxPlayers: state.simplePlayers,
                password: password || '',
                gameType: state.tab,
                difficulty: state.difficulty
            }
        });
        if (!success) {
            alert('创建失败，请检查连接');
            resetCreateBtns();
            return;
        }
        setTimeout(resetCreateBtns, 3000);
    };

    function resetCreateBtns() {
        state.isCreating = false;
        simpleCreateBtn.disabled = false;
        simpleCreateBtn.textContent = '» 创建房间';
    }

    if (!state.connected || !state.ws || state.ws.readyState !== WebSocket.OPEN) {
        connectWebSocket();
        setTimeout(send, 1000);
    } else {
        send();
    }
}

function sendCreateRoom(name, playerName, maxPlayers, aiCount, category, password, difficulty, gameType) {
    var success = sendMessage({
        type: 'createRoom',
        playerId: state.playerId,
        data: {
            name: name,
            playerName: playerName,
            maxPlayers: maxPlayers,
            aiCount: aiCount,
            category: category,
            password: password || '',
            gameType: gameType,
            difficulty: difficulty || 'normal'
        }
    });

    if (!success) {
        alert('创建失败，请检查连接');
        state.isCreating = false;
        createRoomBtn.disabled = false;
        createRoomBtn.textContent = '» 创建房间';
        return;
    }

    setTimeout(function() {
        state.isCreating = false;
        createRoomBtn.disabled = false;
        createRoomBtn.textContent = '» 创建房间';
    }, 3000);
}

function joinRoom(roomId, password) {
    if (state.currentRoom && state.currentRoom !== roomId) {
        if (!confirm('你已在其他房间中，确定要切换吗？')) return;
    }

    var data = { roomId: roomId, playerName: state.playerName };
    if (password) data.password = password;

    if (!state.connected || !state.ws || state.ws.readyState !== WebSocket.OPEN) {
        connectWebSocket();
        setTimeout(function() {
            sendMessage({ type: 'joinRoom', playerId: state.playerId, data: data });
        }, 1000);
    } else {
        sendMessage({ type: 'joinRoom', playerId: state.playerId, data: data });
    }
}

function startGame(roomId) {
    var room = null;
    for (var i = 0; i < state.rooms.length; i++) {
        if (state.rooms[i].id === roomId) { room = state.rooms[i]; break; }
    }

    var msg = '确定要开始游戏吗？\n';
    if (room) {
        var playerCount = room.players ? room.players.length : 0;
        var maxPlayers = room.maxPlayers || 6;
        msg += '当前: ' + playerCount + '/' + maxPlayers + ' 人\n';
        msg += '\n确定开始？';
    }

    if (!confirm(msg)) return;
    sendMessage({ type: 'startGame', playerId: state.playerId, data: { roomId: roomId } });
}

function leaveRoom(roomId) {
    if (!confirm('确定要退出房间吗？')) return;
    sendMessage({ type: 'leaveRoom', playerId: state.playerId, data: { roomId: roomId } });
}

function closeRoom(roomId) {
    if (!confirm('确定要关闭这个房间吗？\n所有玩家将被移出。')) return;
    sendMessage({ type: 'closeRoom', playerId: state.playerId, data: { roomId: roomId } });
}

function resetRoom(roomId) {
    if (!confirm('确定要重置房间吗？\n游戏状态将被清空。')) return;
    sendMessage({ type: 'resetRoom', playerId: state.playerId, data: { roomId: roomId } });
}

function kickPlayer(roomId, targetId) {
    sendMessage({ type: 'kickPlayer', playerId: state.playerId, data: { roomId: roomId, targetId: targetId } });
}

function savePlayerInfo() {
    try {
        localStorage.setItem('uc_player_info', JSON.stringify({
            playerId: state.playerId,
            playerName: state.playerName,
            username: window.MPOSTOR.auth.username()
        }));
    } catch (e) {}
}

function loadSettings() {
    var savedTotal = localStorage.getItem('hall_totalPlayers');
    if (savedTotal) {
        state.totalPlayers = parseInt(savedTotal);
        var btns = document.querySelectorAll('#playerCountSelector .mode-btn');
        for (var i = 0; i < btns.length; i++) {
            btns[i].classList.toggle('active', parseInt(btns[i].dataset.count) === state.totalPlayers);
        }
    }

    var savedAI = localStorage.getItem('hall_aiEnabled');
    if (savedAI) {
        state.aiEnabled = savedAI === 'on';
        var all = document.querySelectorAll('#aiToggleGroup .toggle-btn');
        for (var j = 0; j < all.length; j++) {
            all[j].classList.toggle('active', (all[j].dataset.value === 'on') === state.aiEnabled);
        }
    }

    var savedSimple = localStorage.getItem('hall_simplePlayers');
    if (savedSimple) {
        state.simplePlayers = parseInt(savedSimple);
        var sbtns = document.querySelectorAll('#simpleCountSelector .mode-btn');
        for (var k = 0; k < sbtns.length; k++) {
            sbtns[k].classList.toggle('active', parseInt(sbtns[k].dataset.count) === state.simplePlayers);
        }
    }

    var savedDiff = localStorage.getItem('hall_difficulty');
    if (savedDiff && DIFF_NAMES[savedDiff]) {
        state.difficulty = savedDiff;
        syncDifficultyBtns();
    }
}

function syncDifficultyBtns() {
    var allBtns = document.querySelectorAll('#difficultySelector .mode-btn, #simpleDifficultySelector .mode-btn');
    for (var i = 0; i < allBtns.length; i++) {
        allBtns[i].classList.toggle('active', allBtns[i].dataset.diff === state.difficulty);
    }
}

function getQueryParam(name) {
    var params = new URLSearchParams(window.location.search);
    return params.get(name);
}

function init() {
    // 登录门禁
    if (!window.MPOSTOR.auth.require()) return;

    var username = window.MPOSTOR.auth.username();
    accountChip.textContent = '账号: ' + username;
    state.playerName = username;

    // playerId：与账号绑定；换账号则重新生成（防服务端绑定冲突）
    var savedInfo = null;
    try {
        var saved = localStorage.getItem('uc_player_info');
        if (saved) savedInfo = JSON.parse(saved);
    } catch (e) {}
    if (savedInfo && savedInfo.playerId && savedInfo.username === username) {
        state.playerId = savedInfo.playerId;
        state.playerName = savedInfo.playerName || username;
    } else {
        state.playerId = generatePlayerId();
        savePlayerInfo();
    }

    playerNameInput.value = state.playerName;
    playerNameInput.placeholder = '输入你的名字（默认: ' + username + '）';

    // 选项卡：?tab= 优先，其次上次记忆
    var tab = getQueryParam('tab') || localStorage.getItem('hall_tab') || 'undercover';
    activateTab(tab, true);

    loadSettings();
    connectWebSocket();
}

window.addEventListener('beforeunload', function() {
    if (state.ws) state.ws.close();
    stopHeartbeat();
});

document.addEventListener('DOMContentLoaded', function() {
    init();

    var tabBtns = tabBar.querySelectorAll('.tab-btn');
    for (var ti = 0; ti < tabBtns.length; ti++) {
        (function(btn) {
            btn.addEventListener('click', function() {
                activateTab(btn.dataset.tab, false);
                window.MPOSTOR.sound.play('click');
            });
        })(tabBtns[ti]);
    }

    var countBtns = document.querySelectorAll('#playerCountSelector .mode-btn');
    for (var ci = 0; ci < countBtns.length; ci++) {
        (function(btn) {
            btn.addEventListener('click', function() {
                var allBtns = document.querySelectorAll('#playerCountSelector .mode-btn');
                for (var i = 0; i < allBtns.length; i++) {
                    allBtns[i].classList.remove('active');
                }
                this.classList.add('active');
                state.totalPlayers = parseInt(this.dataset.count);
                localStorage.setItem('hall_totalPlayers', state.totalPlayers);
            });
        })(countBtns[ci]);
    }

    var simpleBtns = document.querySelectorAll('#simpleCountSelector .mode-btn');
    for (var si = 0; si < simpleBtns.length; si++) {
        (function(btn) {
            btn.addEventListener('click', function() {
                var allBtns = document.querySelectorAll('#simpleCountSelector .mode-btn');
                for (var i = 0; i < allBtns.length; i++) {
                    allBtns[i].classList.remove('active');
                }
                this.classList.add('active');
                state.simplePlayers = parseInt(this.dataset.count);
                localStorage.setItem('hall_simplePlayers', state.simplePlayers);
            });
        })(simpleBtns[si]);
    }

    // 难度选择：两个表单共用 state.difficulty，切换时双向同步
    var diffBtns = document.querySelectorAll('#difficultySelector .mode-btn, #simpleDifficultySelector .mode-btn');
    for (var di = 0; di < diffBtns.length; di++) {
        (function(btn) {
            btn.addEventListener('click', function() {
                state.difficulty = this.dataset.diff;
                syncDifficultyBtns();
                localStorage.setItem('hall_difficulty', state.difficulty);
            });
        })(diffBtns[di]);
    }

    var toggleBtns = document.querySelectorAll('#aiToggleGroup .toggle-btn');
    for (var ti2 = 0; ti2 < toggleBtns.length; ti2++) {
        (function(btn) {
            btn.addEventListener('click', function() {
                var all = document.querySelectorAll('#aiToggleGroup .toggle-btn');
                for (var i = 0; i < all.length; i++) {
                    all[i].classList.remove('active');
                }
                this.classList.add('active');
                state.aiEnabled = this.dataset.value === 'on';
                localStorage.setItem('hall_aiEnabled', state.aiEnabled ? 'on' : 'off');
            });
        })(toggleBtns[ti2]);
    }

    createRoomBtn.addEventListener('click', createRoom);
    roomNameInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') createRoom(); });
    playerNameInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') createRoom(); });

    simpleCreateBtn.addEventListener('click', createSimpleRoom);
    simpleRoomName.addEventListener('keydown', function(e) { if (e.key === 'Enter') createSimpleRoom(); });
    simplePassword.addEventListener('keydown', function(e) { if (e.key === 'Enter') createSimpleRoom(); });

    refreshRoomsBtn.addEventListener('click', function() {
        if (state.connected) sendMessage({ type: 'listRooms' });
        else connectWebSocket();
    });

    passwordConfirmBtn.addEventListener('click', function() {
        var pwd = passwordInput.value.trim();
        if (state.pendingJoinRoom) joinRoom(state.pendingJoinRoom, pwd || null);
    });

    passwordCancelBtn.addEventListener('click', closePasswordModal);
    passwordInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') passwordConfirmBtn.click();
    });
    passwordModal.addEventListener('click', function(e) {
        if (e.target === this) closePasswordModal();
    });

    /* ---- 账号 UI ---- */
    var logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            if (!confirm('确定要退出登录吗？')) return;
            var token = window.MPOSTOR.auth.token();
            if (token) {
                fetch(HTTP_URL + '/api/auth/logout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
                }).catch(function() {});
            }
            window.MPOSTOR.auth.logout();
            window.location.href = '../login/index.html?redirect=pages/game-hall/index.html';
        });
    }

    /* ---- MPOSTOR 趣味钩子 ---- */
    var muteBtn = document.getElementById('muteBtn');
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
});
