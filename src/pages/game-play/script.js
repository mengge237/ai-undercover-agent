// ========== 游戏进行 - 前端逻辑（完整版） ==========

console.log('[GAME] 游戏进行页面已加载');

// ========== DOM引用 ==========
var roomIdDisplay = document.getElementById('roomIdDisplay');
var roundDisplay = document.getElementById('roundDisplay');
var playerCount = document.getElementById('playerCount');
var statusBadge = document.getElementById('statusBadge');
var playersList = document.getElementById('playersList');
var spokenCount = document.getElementById('spokenCount');
var currentPlayerName = document.getElementById('currentPlayerName');

var phaseSpeak = document.getElementById('phaseSpeak');
var phaseVote = document.getElementById('phaseVote');
var phaseGameOver = document.getElementById('phaseGameOver');
var phaseWait = document.getElementById('phaseWait');
var waitStatusText = document.getElementById('waitStatusText');
var waitRoomInfo = document.getElementById('waitRoomInfo');
var startGameBtn = document.getElementById('startGameBtn');
var closeRoomBtn = document.getElementById('closeRoomBtn');

var speakerName = document.getElementById('speakerName');
var speakerWordHint = document.getElementById('speakerWordHint');
var speakInput = document.getElementById('speakInput');
var charCount = document.getElementById('charCount');
var submitSpeakBtn = document.getElementById('submitSpeakBtn');
var endSpeakBtn = document.getElementById('endSpeakBtn');
var historyList = document.getElementById('historyList');

var voteCandidates = document.getElementById('voteCandidates');
var confirmVoteBtn = document.getElementById('confirmVoteBtn');
var voteResult = document.getElementById('voteResult');
var resultChart = document.getElementById('resultChart');
var eliminateBtn = document.getElementById('eliminateBtn');

var logList = document.getElementById('logList');
var goToResultBtn = document.getElementById('goToResultBtn');

// 聊天记录折叠相关
var chatToggle = document.getElementById('chatToggle');
var chatContent = document.getElementById('chatContent');
var chatList = document.getElementById('chatList');

// ========== 配置 ==========
var WS_URL = 'ws://localhost:8080/ws/game';

// ========== 状态 ==========
var state = {
    roomId: null,
    playerId: null,
    players: [],
    playerNames: {},
    displayNames: {},
    civilianWord: '',
    undercoverWord: '',
    undercoverIndex: -1,
    playerWords: {},
    currentRound: 1,
    currentSpeakerIndex: 0,
    spokenPlayers: new Set(),
    votedPlayers: new Set(),
    votes: {},
    eliminated: [],
    phase: 'waiting',
    gameOver: false,
    myPlayerId: null,
    myDisplayName: null,
    isMyTurn: false,
    allDescriptions: [],
    isHost: false,
    ws: null,
    connected: false,
    isProcessing: false,
    hasRejoined: false,
    chatOpen: false,
    deployShown: false,
    maxPlayers: 6,
    difficulty: 'normal'
};

// ========== 防抖变量 ==========
var _speakLock = false;
var _lastSpeakTime = 0;
var _voteLock = false;
var _lastVoteTime = 0;

// ========== 工具函数 ==========
function getQueryParam(param) {
    var urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

function formatTime() {
    return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function getDisplayName(playerId) {
    if (!playerId) return '玩家';
    // 优先账号显示名（服务端 displayNames）
    if (state.displayNames && state.displayNames[playerId]) {
        return state.displayNames[playerId];
    }
    if (state.playerNames && state.playerNames[playerId]) {
        return state.playerNames[playerId];
    }
    if (playerId.startsWith('AI-')) {
        return playerId;
    }
    return playerId;
}

function addLog(message, type) {
    type = type || 'system';
    var entry = document.createElement('div');
    entry.className = 'log-entry ' + type;
    entry.innerHTML = '<span class="time">[' + formatTime() + ']</span> ' + message;
    entry.style.opacity = '0';
    entry.style.transform = 'translateX(-20px)';
    entry.style.transition = 'all 0.3s ease';
    logList.appendChild(entry);
    
    requestAnimationFrame(function() {
        entry.style.opacity = '1';
        entry.style.transform = 'translateX(0)';
    });
    
    logList.scrollTop = logList.scrollHeight;
}

// ========== WebSocket ==========
function connectWebSocket() {
    if (state.ws && state.ws.readyState === WebSocket.OPEN) return;

    try {
        console.log('[WS] 连接WebSocket...');
        console.log('[TX] 当前playerId:', state.playerId);
        console.log('[TX] 当前roomId:', state.roomId);
        
        state.ws = new WebSocket(WS_URL);
        
        state.ws.onopen = function() {
            console.log('✓ WebSocket已连接');
            state.connected = true;

            // 先认证（rejoinRoom 需要账号）
            var token = window.MPOSTOR ? window.MPOSTOR.auth.token() : null;
            if (token) sendWsMessage({ type: 'auth', data: { token: token } });

            var rejoinMsg = {
                type: 'rejoinRoom',
                playerId: state.playerId,
                data: {
                    roomId: state.roomId
                }
            };
            console.log('[TX] 发送rejoinRoom:', rejoinMsg);
            sendWsMessage(rejoinMsg);
        };
        
        state.ws.onmessage = function(event) {
            try {
                var message = JSON.parse(event.data);
                handleServerMessage(message);
            } catch (error) {
                console.error('解析消息失败:', error);
            }
        };
        
        state.ws.onclose = function() {
            console.log('[!] WebSocket已断开');
            state.connected = false;
        };
        
        state.ws.onerror = function(error) {
            console.error('WebSocket错误:', error);
        };

    } catch (error) {
        console.error('WebSocket连接失败:', error);
    }
}

function sendWsMessage(message) {
    if (state.ws && state.ws.readyState === WebSocket.OPEN) {
        state.ws.send(JSON.stringify(message));
        return true;
    }
    console.warn('WebSocket未连接');
    return false;
}

// ========== 处理服务端消息 ==========
function handleServerMessage(message) {
    console.log('[RX] 收到消息:', message.type);

    switch (message.type) {
        case 'rejoinSuccess':
            console.log('> 重连成功，更新游戏状态');
            state.hasRejoined = true;
            if (message.data) {
                var gameData = {
                    roomId: message.data.roomId || state.roomId,
                    players: message.data.players || state.players,
                    civilianWord: message.data.civilianWord || state.civilianWord,
                    undercoverWord: message.data.undercoverWord || state.undercoverWord,
                    undercoverIndex: message.data.undercoverIndex !== undefined ? message.data.undercoverIndex : state.undercoverIndex,
                    playerWords: message.data.playerWords || state.playerWords,
                    maxPlayers: message.data.maxPlayers || 6,
                    aiCount: message.data.aiCount || 0,
                    isHost: message.data.host === state.playerId,
                    playerId: state.playerId,
                    timestamp: Date.now()
                };
                localStorage.setItem('undercoverGameData', JSON.stringify(gameData));
                // 服务端快照的 host 字段为准
                if (message.data.host === state.playerId) state.isHost = true;
                updateGameState(message.data);
                if (message.data.status === 'playing') {
                    // 对局进行中重连：直接进入游戏
                    state.phase = 'speak';
                    showPlaying();
                    if (!state.deployShown) {
                        state.deployShown = true;
                        logDifficulty(message.data.difficulty);
                        if (window.MPOSTOR) window.MPOSTOR.fx.deployTransition('UNDERCOVER // 谁是卧底', null);
                    }
                } else {
                    // 等待开局：待命区
                    state.phase = 'waiting';
                    showWaiting();
                }
            }
            addLog('> 重连成功', 'system');
            break;

        case 'gameState':
            updateGameState(message.data);
            break;

        case 'gameStarted':
            // 开局广播到达（房主在本页点开始 / 其他玩家停留在本页时收到）
            console.log('> 游戏开始，进入对局');
            state.gameOver = false;
            state.eliminated = [];
            state.currentRound = 1;
            state.spokenPlayers = new Set();
            state.votedPlayers = new Set();
            state.votes = {};
            updateGameState(message);
            state.phase = 'speak';
            showPlaying();
            if (!state.deployShown) {
                state.deployShown = true;
                logDifficulty(message.difficulty);
                if (window.MPOSTOR) window.MPOSTOR.fx.deployTransition('UNDERCOVER // 谁是卧底', null);
            }
            addLog('> 游戏开始', 'system');
            var myWord = state.playerWords[state.playerId] || '???';
            addLog('> 你的词: ' + myWord, 'info');
            break;

        case 'speakSubmitted':
            var displayName = getDisplayName(message.playerName);
            addToHistory(displayName, message.content);
            addToChatList(displayName, message.content, state.currentRound, message.playerName);
            addLog('▸ ' + displayName + ': ' + message.content, 'speak');
            state.spokenPlayers.add(message.playerName);
            if (window.MPOSTOR) {
                window.MPOSTOR.sound.play('beep');
                if (message.playerName === state.playerId) window.MPOSTOR.stats.add('speaks');
            }
            renderPlayers();
            break;

        case 'voteSubmitted':
            var displayName = getDisplayName(message.playerName);
            var targetName = getDisplayName(message.target);
            addLog('▸ ' + displayName + ' → ' + targetName, 'vote');
            state.votes[message.playerName] = message.target;
            state.votedPlayers.add(message.playerName);
            if (window.MPOSTOR) {
                window.MPOSTOR.sound.play('tick');
                if (message.playerName === state.playerId) window.MPOSTOR.stats.add('votes');
            }
            renderPlayers();
            updateVoteChart();
            break;

        case 'roundStarted':
            state.currentRound = message.round;
            roundDisplay.textContent = '第 ' + state.currentRound + ' 轮';
            state.spokenPlayers.clear();
            state.votedPlayers.clear();
            state.votes = {};
            state.currentSpeakerIndex = 0;
            state.phase = 'speak';
            showPlaying();
            endSpeakBtn.disabled = true;
            if (window.MPOSTOR) window.MPOSTOR.sound.play('confirm');
            addLog('> 第 ' + state.currentRound + ' 轮开始', 'system');
            renderPlayers();
            updateCurrentSpeaker();
            resultChart.innerHTML = '';
            voteResult.style.display = 'none';
            break;

        case 'playerEliminated':
            var displayName = getDisplayName(message.playerName);
            state.eliminated.push(message.playerName);
            addLog('✕ ' + displayName + ' 被淘汰', 'eliminate');
            if (window.MPOSTOR) {
                window.MPOSTOR.sound.play('powerdown');
                window.MPOSTOR.fx.glitch(700);
                window.MPOSTOR.stats.add('eliminations');
                // 终结者：我的投票淘汰了卧底
                var votedTarget = state.votes[state.playerId];
                var isUndercoverEliminated = state.players.indexOf(message.playerName) === state.undercoverIndex;
                if (votedTarget === message.playerName && isUndercoverEliminated) {
                    window.MPOSTOR.ach.unlock('terminator');
                }
            }
            renderPlayers();
            break;

        case 'voteResult':
            showVoteResult(message.votes);
            break;

        case 'gameEnded':
            showGameOver(message.result);
            break;

        case 'turnChanged':
            state.currentSpeakerIndex = message.index;
            updateCurrentSpeaker();
            renderPlayers();
            break;

        case 'speakPhaseEnded':
            endSpeakBtn.disabled = false;
            addLog('✓ 所有人已发言完毕', 'system');
            break;

        case 'votePhaseStarted':
            state.phase = 'vote';
            phaseSpeak.style.display = 'none';
            phaseVote.style.display = 'block';
            statusBadge.textContent = '投票中';
            statusBadge.className = 'status-badge voting';
            if (window.MPOSTOR) window.MPOSTOR.sound.play('alarm');
            updateChatList();
            renderVoteOptions();
            addLog('▸ 进入投票阶段', 'system');
            break;

        case 'playerRejoined':
            var displayName = getDisplayName(message.playerName);
            addLog('> ' + displayName + ' 重新加入', 'system');
            break;

        case 'playerJoined':
        case 'playerLeft':
            // 待命期间有人员变动：重新拉取房间快照
            if (state.phase === 'waiting') {
                sendWsMessage({
                    type: 'rejoinRoom',
                    playerId: state.playerId,
                    data: { roomId: state.roomId }
                });
            }
            break;

        case 'roomClosed':
            alert('房间已解散');
            window.location.href = '../game-hall/index.html';
            break;

        case 'playerKicked':
            if (message.playerName === state.playerId) {
                alert('你已被移出房间');
                window.location.href = '../game-hall/index.html';
            }
            break;

        case 'error':
            console.error('服务端错误:', message.message);
            // 待命期间出现状态竞争（游戏已在别处开始/房间已不在）：静默重拉快照
            if (state.phase === 'waiting' && message.message &&
                (message.message.indexOf('游戏已开始') !== -1 || message.message.indexOf('游戏进行中') !== -1 ||
                 message.message.indexOf('房间不存在') !== -1 || message.message.indexOf('已解散') !== -1)) {
                sendWsMessage({ type: 'rejoinRoom', playerId: state.playerId, data: { roomId: state.roomId } });
                break;
            }
            if (window.MPOSTOR) {
                window.MPOSTOR.sound.play('error');
                if (message.message && message.message.indexOf('token') !== -1) {
                    window.MPOSTOR.auth.logout();
                    window.MPOSTOR.auth.require();
                    return;
                }
            }
            alert('错误: ' + message.message);
            break;

        default:
            console.log('未知消息:', message.type);
    }
}

// ========== 更新游戏状态 ==========
function updateGameState(data) {
    if (data.players) {
        state.players = data.players;
        state.playerNames = {};
        var realIdx = 0;
        state.players.forEach(function(p) {
            if (p && !p.startsWith('AI-')) {
                realIdx++;
                state.playerNames[p] = '玩家' + realIdx;
            } else if (p && p.startsWith('AI-')) {
                state.playerNames[p] = p;
            }
        });
        if (state.myPlayerId && state.playerNames[state.myPlayerId]) {
            state.playerNames[state.myPlayerId] = '我';
        }
    }
    if (data.civilianWord) state.civilianWord = data.civilianWord;
    if (data.undercoverWord) state.undercoverWord = data.undercoverWord;
    if (data.undercoverIndex !== undefined) state.undercoverIndex = data.undercoverIndex;
    if (data.playerWords) state.playerWords = data.playerWords;
    if (data.displayNames) state.displayNames = data.displayNames;
    if (data.round) state.currentRound = data.round;
    if (data.eliminated) state.eliminated = data.eliminated;
    if (data.spoken) state.spokenPlayers = new Set(data.spoken);
    if (data.voted) state.votedPlayers = new Set(data.voted);
    if (data.votes) state.votes = data.votes;
    if (data.phase) state.phase = data.phase;
    if (data.gameOver !== undefined) state.gameOver = data.gameOver;
    if (data.maxPlayers) state.maxPlayers = data.maxPlayers;
    if (data.difficulty) state.difficulty = data.difficulty;

    renderPlayers();
    updateCurrentSpeaker();
}

/* ========== 阶段切换 ========== */
function showWaiting() {
    if (phaseWait) phaseWait.style.display = '';
    phaseSpeak.style.display = 'none';
    phaseVote.style.display = 'none';
    phaseGameOver.style.display = 'none';
    statusBadge.textContent = '待命中';
    statusBadge.className = 'status-badge waiting';
    speakInput.disabled = true;
    submitSpeakBtn.disabled = true;
    endSpeakBtn.disabled = true;

    var diffTag = state.difficulty === 'easy' ? '简单'
        : (state.difficulty === 'hard' ? '困难' : '普通');
    if (waitRoomInfo) {
        waitRoomInfo.textContent = '房间: ' + state.roomId +
            ' · 玩家 ' + state.players.length + '/' + state.maxPlayers +
            ' · 难度: ' + diffTag;
    }
    if (waitStatusText) {
        waitStatusText.textContent = state.isHost ? '已就绪，点击开始游戏部署行动' : '等待房主开始游戏...';
    }
    if (startGameBtn) {
        startGameBtn.style.display = state.isHost ? '' : 'none';
        startGameBtn.disabled = false;
        startGameBtn.textContent = '» 开始游戏';
    }
    if (closeRoomBtn) {
        closeRoomBtn.style.display = state.isHost ? '' : 'none';
        closeRoomBtn.disabled = false;
        closeRoomBtn.textContent = '解散房间';
    }
}

function showPlaying() {
    if (phaseWait) phaseWait.style.display = 'none';
    phaseSpeak.style.display = 'block';
    phaseVote.style.display = 'none';
    phaseGameOver.style.display = 'none';
    statusBadge.textContent = '发言中';
    statusBadge.className = 'status-badge';
}

function logDifficulty(difficulty) {
    var tag = difficulty === 'easy' ? '简单'
        : (difficulty === 'hard' ? '困难' : '普通');
    addLog('// 任务难度：' + tag + (tag === '困难' ? ' · 形容词强化词对' : ''), 'system');
}

// ========== 渲染 ==========
function renderPlayers() {
    playersList.innerHTML = '';
    state.players.forEach(function(player, index) {
        var item = document.createElement('div');
        item.className = 'player-item';
        item.dataset.index = index;

        var isEliminated = state.eliminated.indexOf(player) !== -1;
        var isAI = player && player.startsWith('AI-');
        var hasSpoken = state.spokenPlayers.has(player);
        var hasVoted = state.votedPlayers.has(player);
        var displayName = getDisplayName(player);

        if (isEliminated) item.classList.add('eliminated');
        if (state.currentSpeakerIndex === index && !isEliminated && state.phase === 'speak') {
            item.classList.add('active');
        }

        var statusText = '';
        if (isEliminated) statusText = '已淘汰';
        else if (hasSpoken && state.phase === 'speak') statusText = '已发言';
        else if (hasVoted && state.phase === 'vote') statusText = '已投票';
        else if (state.currentSpeakerIndex === index && state.phase === 'speak') statusText = '发言中';
        else statusText = '等待';

        var isMyTurn = player === state.myPlayerId;

        var html = '<span>' + displayName + '</span>';
        if (isAI) html += '<span class="ai-tag">AI</span>';
        if (isMyTurn) html += '<span style="font-weight:600;color:var(--amber);">■</span>';
        html += '<span class="status-tag">' + statusText + '</span>';

        item.innerHTML = html;
        playersList.appendChild(item);
    });

    playerCount.textContent = state.players.length + '人';
    var activePlayers = state.players.filter(function(p) { return state.eliminated.indexOf(p) === -1; });
    spokenCount.textContent = state.spokenPlayers.size + '/' + activePlayers.length;
}

function updateCurrentSpeaker() {
    // 待命阶段不显示发言状态
    if (state.phase === 'waiting') {
        currentPlayerName.textContent = '等待开局';
        speakerName.textContent = '---';
        speakerWordHint.textContent = '等待游戏开始...';
        speakInput.disabled = true;
        submitSpeakBtn.disabled = true;
        return;
    }

    var activePlayers = state.players.filter(function(p) { return state.eliminated.indexOf(p) === -1; });
    if (state.currentSpeakerIndex >= activePlayers.length) {
        currentPlayerName.textContent = '所有人已发言';
        speakerName.textContent = '---';
        speakerWordHint.textContent = '';
        speakInput.disabled = true;
        submitSpeakBtn.disabled = true;
        return;
    }

    var player = activePlayers[state.currentSpeakerIndex];
    var displayName = getDisplayName(player);
    currentPlayerName.textContent = displayName;
    speakerName.textContent = displayName;

    var isMyTurn = state.myPlayerId === player;
    state.isMyTurn = isMyTurn;

    if (isMyTurn) {
        var myWord = state.playerWords[player] || '???';
        speakerWordHint.textContent = '你的词: ' + myWord;
        speakInput.disabled = false;
        speakInput.placeholder = '输入你的描述...';
        speakInput.value = '';
        charCount.textContent = '0/200';
        submitSpeakBtn.disabled = true;
        _speakLock = false;
    } else {
        var isAI = player && player.startsWith('AI-');
        speakerWordHint.textContent = isAI ? '[THINK] AI思考中...' : '[WAIT] 等待 ' + displayName;
        speakInput.disabled = true;
        speakInput.placeholder = '等待 ' + displayName + ' 发言...';
        submitSpeakBtn.disabled = true;
    }

    renderPlayers();
}

function addToHistory(player, content) {
    var item = document.createElement('div');
    item.className = 'history-item';
    item.style.opacity = '0';
    item.style.transform = 'translateX(-10px)';
    item.style.transition = 'all 0.3s ease';
    item.innerHTML = '<span class="speaker">' + player + ':</span><span class="content">' + content + '</span>';
    historyList.appendChild(item);
    
    requestAnimationFrame(function() {
        item.style.opacity = '1';
        item.style.transform = 'translateX(0)';
    });
    
    historyList.scrollTop = historyList.scrollHeight;

    var emptyHint = historyList.querySelector('.empty-hint');
    if (emptyHint) emptyHint.remove();
}

// ========== 聊天记录管理 ==========
function addToChatList(displayName, content, round, playerId) {
    var item = document.createElement('div');
    item.className = 'chat-item';
    item.style.opacity = '0';
    item.style.transform = 'translateX(-10px)';
    item.style.transition = 'all 0.3s ease';
    
    var isUndercover = state.players.indexOf(playerId) === state.undercoverIndex;
    item.innerHTML = '<span class="chat-speaker ' + (isUndercover ? 'undercover' : '') + '">' + displayName + '</span>' +
        '<span class="chat-content-text">' + content + '</span>' +
        '<span class="chat-round">第' + (round || state.currentRound) + '轮</span>';
    chatList.appendChild(item);
    
    requestAnimationFrame(function() {
        item.style.opacity = '1';
        item.style.transform = 'translateX(0)';
    });
    
    chatList.scrollTop = chatList.scrollHeight;
}

function updateChatList() {
    chatList.innerHTML = '';
    if (state.allDescriptions.length === 0) {
        chatList.innerHTML = '<div class="chat-empty">暂无发言记录</div>';
        return;
    }
    state.allDescriptions.forEach(function(desc) {
        var item = document.createElement('div');
        item.className = 'chat-item';
        var displayName = getDisplayName(desc.player);
        var isUndercover = state.players.indexOf(desc.player) === state.undercoverIndex;
        item.innerHTML = '<span class="chat-speaker ' + (isUndercover ? 'undercover' : '') + '">' + displayName + '</span>' +
            '<span class="chat-content-text">' + desc.content + '</span>' +
            '<span class="chat-round">第' + (desc.round || 1) + '轮</span>';
        chatList.appendChild(item);
    });
}

// ========== 投票 ==========
function renderVoteOptions() {
    voteCandidates.innerHTML = '';
    var activePlayers = state.players.filter(function(p) { return state.eliminated.indexOf(p) === -1; });

    activePlayers.forEach(function(player) {
        var option = document.createElement('div');
        option.className = 'vote-option';
        option.dataset.player = player;

        var isVoted = state.votedPlayers.has(state.myPlayerId);
        var isSelf = player === state.myPlayerId;
        var isAI = player && player.startsWith('AI-');
        var displayName = getDisplayName(player);

        if (isVoted || isSelf) option.classList.add('disabled');
        if (state.votes[state.myPlayerId] === player) option.classList.add('selected');

        var html = '<span>' + displayName + '</span>';
        if (isAI) html += '<span class="sub">AI</span>';
        if (isSelf) html += '<span class="sub">自己</span>';

        option.innerHTML = html;
        option.addEventListener('click', function() { selectVote(player); });
        voteCandidates.appendChild(option);
    });
}

var selectedVote = null;

function selectVote(player) {
    if (state.votedPlayers.has(state.myPlayerId)) return;
    if (player === state.myPlayerId) return;
    if (state.eliminated.indexOf(player) !== -1) return;

    selectedVote = player;
    document.querySelectorAll('.vote-option').forEach(function(el) {
        el.classList.toggle('selected', el.dataset.player === player);
    });
    confirmVoteBtn.disabled = false;
}

function updateVoteChart() {
    var activePlayers = state.players.filter(function(p) { return state.eliminated.indexOf(p) === -1; });
    var voteCounts = {};
    activePlayers.forEach(function(p) { voteCounts[p] = 0; });

    Object.values(state.votes).forEach(function(target) {
        if (voteCounts[target] !== undefined) voteCounts[target]++;
    });

    var sorted = Object.entries(voteCounts).sort(function(a, b) { return b[1] - a[1]; });
    var maxVotes = sorted.length > 0 ? sorted[0][1] : 0;

    resultChart.innerHTML = '';
    sorted.forEach(function(item) {
        var player = item[0];
        var count = item[1];
        var bar = document.createElement('div');
        bar.className = 'result-bar';
        var isHigh = count === maxVotes && count > 0;
        var displayName = getDisplayName(player);
        var pct = activePlayers.length > 0 ? (count / Math.max(1, activePlayers.length)) * 100 : 0;
        bar.innerHTML = '<span class="name">' + displayName + '</span>' +
            '<div class="track"><div class="fill ' + (isHigh ? 'high' : '') + '" style="width:' + pct + '%"></div></div>' +
            '<span class="count">' + count + '</span>';
        resultChart.appendChild(bar);
    });
}

function showVoteResult(votes) {
    voteResult.style.display = 'block';
    resultChart.innerHTML = '';

    if (votes) {
        state.votes = votes;
        Object.keys(votes).forEach(function(p) { state.votedPlayers.add(p); });
    }

    var activePlayers = state.players.filter(function(p) { return state.eliminated.indexOf(p) === -1; });
    var voteCounts = {};
    activePlayers.forEach(function(p) { voteCounts[p] = 0; });

    Object.values(state.votes).forEach(function(target) {
        if (voteCounts[target] !== undefined) voteCounts[target]++;
    });

    var sorted = Object.entries(voteCounts).sort(function(a, b) { return b[1] - a[1]; });
    var maxVotes = sorted.length > 0 ? sorted[0][1] : 0;

    sorted.forEach(function(item) {
        var player = item[0];
        var count = item[1];
        var bar = document.createElement('div');
        bar.className = 'result-bar';
        var isHigh = count === maxVotes && count > 0;
        var displayName = getDisplayName(player);
        var pct = activePlayers.length > 0 ? (count / Math.max(1, activePlayers.length)) * 100 : 0;
        bar.innerHTML = '<span class="name">' + displayName + '</span>' +
            '<div class="track"><div class="fill ' + (isHigh ? 'high' : '') + '" style="width:' + pct + '%"></div></div>' +
            '<span class="count">' + count + '</span>';
        resultChart.appendChild(bar);
    });

    eliminateBtn.disabled = false;
}

// ========== 游戏结束 ==========
function showGameOver(result) {
    state.phase = 'ended';
    state.gameOver = true;

    phaseSpeak.style.display = 'none';
    phaseVote.style.display = 'none';
    phaseGameOver.style.display = 'block';
    statusBadge.textContent = '已结束';
    statusBadge.className = 'status-badge ended';

    var icon = document.getElementById('gameoverIcon');
    var title = document.getElementById('gameoverTitle');
    var desc = document.getElementById('gameoverDesc');
    var details = document.getElementById('gameoverDetails');

    var isCivilianWin = result === 'civilian';
    icon.textContent = isCivilianWin ? '◆' : '◈';
    title.textContent = isCivilianWin ? '平民胜利' : '卧底胜利';
    desc.textContent = isCivilianWin ? '所有卧底已被找出' : '卧底成功存活';

    var undercoverName = getDisplayName(state.players[state.undercoverIndex] || '???');
    details.innerHTML = '<div class="item"><div class="number">' + state.players.length + '</div><div class="label">总人数</div></div>' +
        '<div class="item"><div class="number">' + state.eliminated.length + '</div><div class="label">淘汰</div></div>' +
        '<div class="item"><div class="number">' + undercoverName + '</div><div class="label">卧底</div></div>' +
        '<div class="item"><div class="number">' + state.civilianWord + '</div><div class="label">平民词</div></div>' +
        '<div class="item"><div class="number">' + state.undercoverWord + '</div><div class="label">卧底词</div></div>';

    addLog('> 游戏结束！' + (isCivilianWin ? '平民' : '卧底') + '胜利', 'system');

    var resultData = {
        roomId: state.roomId,
        result: isCivilianWin ? 'civilian' : 'undercover',
        players: state.players,
        undercoverIndex: state.undercoverIndex,
        civilianWord: state.civilianWord,
        undercoverWord: state.undercoverWord,
        rounds: state.currentRound,
        descriptions: state.allDescriptions
    };
    localStorage.setItem('gameResultData', JSON.stringify(resultData));

    /* ---- MPOSTOR 趣味钩子：战绩 + 成就 ---- */
    if (window.MPOSTOR) {
        var iAmUndercover = state.players.indexOf(state.myPlayerId) === state.undercoverIndex;
        var iWon = (isCivilianWin && !iAmUndercover) || (!isCivilianWin && iAmUndercover);
        var iSurvived = state.eliminated.indexOf(state.myPlayerId) === -1;

        window.MPOSTOR.stats.add('gamesPlayed');
        window.MPOSTOR.ach.unlock('first_game');
        if (iWon) {
            window.MPOSTOR.stats.add('wins');
            window.MPOSTOR.sound.play('victory');
            if (iAmUndercover) {
                window.MPOSTOR.stats.add('undercoverWins');
                window.MPOSTOR.ach.unlock('perfect_hide');
            } else {
                window.MPOSTOR.stats.add('civilianWins');
                window.MPOSTOR.ach.unlock('civilian_hunter');
            }
            if (iSurvived) window.MPOSTOR.ach.unlock('survivor');
        } else {
            window.MPOSTOR.sound.play('defeat');
        }
        if (window.MPOSTOR.stats.get('speaks') >= 20) window.MPOSTOR.ach.unlock('chatterbox');
        if (window.MPOSTOR.stats.get('votes') >= 20) window.MPOSTOR.ach.unlock('voter');
    }
}

// ========== 用户操作 ==========

function handleSubmitSpeak() {
    // 多重锁检查
    if (_speakLock) {
        console.log('[!] 发言被锁定');
        return;
    }
    
    var now = Date.now();
    if (now - _lastSpeakTime < 2000) {
        console.log('[!] 发言过于频繁，请等待2秒');
        return;
    }
    
    if (state.isProcessing) return;
    if (!state.isMyTurn) {
        console.log('[!] 还没轮到你发言');
        return;
    }
    
    var content = speakInput.value.trim();
    if (!content) {
        speakInput.style.borderColor = '#b33c3c';
        setTimeout(function() {
            speakInput.style.borderColor = '';
        }, 500);
        return;
    }

    // 立即锁定
    _speakLock = true;
    _lastSpeakTime = now;
    state.isProcessing = true;
    submitSpeakBtn.disabled = true;
    speakInput.disabled = true;

    var displayName = getDisplayName(state.myPlayerId);
    
    // 乐观更新
    state.spokenPlayers.add(state.myPlayerId);
    state.allDescriptions.push({
        player: state.myPlayerId,
        content: content,
        round: state.currentRound
    });
    addToHistory(displayName, content);
    addToChatList(displayName, content, state.currentRound, state.myPlayerId);
    addLog('▸ ' + displayName + ': ' + content, 'speak');
    renderPlayers();

    // 发送到服务器
    sendWsMessage({
        type: 'speak',
        playerId: state.playerId,
        data: {
            roomId: state.roomId,
            content: content
        }
    });

    speakInput.value = '';
    charCount.textContent = '0/200';

    if (window.MPOSTOR) window.MPOSTOR.sound.play('confirm');

    // 延迟解锁
    setTimeout(function() {
        _speakLock = false;
        state.isProcessing = false;
        submitSpeakBtn.disabled = false;
        speakInput.disabled = false;
        console.log('[UNLOCK] 发言锁已释放');
    }, 2500);
}

function enterVotePhase() {
    sendWsMessage({
        type: 'enterVote',
        playerId: state.playerId,
        data: { roomId: state.roomId }
    });
}

function handleConfirmVote() {
    if (_voteLock) {
        console.log('[!] 投票被锁定');
        return;
    }
    
    var now = Date.now();
    if (now - _lastVoteTime < 1500) {
        console.log('[!] 投票过于频繁');
        return;
    }
    
    if (!selectedVote || state.isProcessing) return;
    
    if (state.votedPlayers.has(state.myPlayerId)) {
        alert('你已经投过票了');
        return;
    }
    
    _voteLock = true;
    _lastVoteTime = now;
    state.isProcessing = true;
    confirmVoteBtn.disabled = true;

    var target = selectedVote;
    selectedVote = null;

    sendWsMessage({
        type: 'vote',
        playerId: state.playerId,
        data: {
            roomId: state.roomId,
            target: target
        }
    });

    state.votedPlayers.add(state.myPlayerId);
    state.votes[state.myPlayerId] = target;

    var displayName = getDisplayName(state.myPlayerId);
    var targetName = getDisplayName(target);
    addLog('▸ ' + displayName + ' → ' + targetName, 'vote');

    renderPlayers();
    updateVoteChart();

    setTimeout(function() {
        _voteLock = false;
        state.isProcessing = false;
        confirmVoteBtn.disabled = false;
    }, 2000);
}

function handleEliminate() {
    sendWsMessage({
        type: 'eliminate',
        playerId: state.playerId,
        data: { roomId: state.roomId }
    });
}

// ========== 聊天记录折叠切换 ==========
function toggleChat() {
    state.chatOpen = !state.chatOpen;
    if (state.chatOpen) {
        chatContent.style.display = 'block';
        chatToggle.querySelector('.toggle-arrow').className = 'toggle-arrow open';
        updateChatList();
    } else {
        chatContent.style.display = 'none';
        chatToggle.querySelector('.toggle-arrow').className = 'toggle-arrow';
    }
}

// ========== 初始化 ==========
function initGame() {
    // 全局登录门禁
    if (window.MPOSTOR && !window.MPOSTOR.auth.require()) return;

    var roomId = getQueryParam('roomId');
    if (!roomId) {
        alert('未找到房间ID');
        window.location.href = '../game-hall/index.html';
        return;
    }

    state.roomId = roomId;
    roomIdDisplay.textContent = '房间: ' + roomId;

    var savedData = localStorage.getItem('undercoverGameData');
    if (!savedData) {
        alert('未找到游戏数据');
        window.location.href = '../game-hall/index.html';
        return;
    }

    try {
        var data = JSON.parse(savedData);
        console.log('[DATA] 读取到游戏数据:', data);
        
        state.players = data.players || [];
        state.civilianWord = data.civilianWord || '';
        state.undercoverWord = data.undercoverWord || '';
        state.undercoverIndex = data.undercoverIndex !== undefined ? data.undercoverIndex : -1;
        state.playerWords = data.playerWords || {};
        state.isHost = data.isHost || false;
        state.maxPlayers = data.maxPlayers || 6;
        state.myPlayerId = state.players[0] || '';

        // ✓ 关键修复：从localStorage获取playerId
        state.playerId = data.playerId || state.myPlayerId;
        
        // ✓ 如果playerId还是null，生成一个临时ID并保存
        if (!state.playerId || state.playerId === 'null' || state.playerId === 'undefined') {
            var randomStr = String(Math.random()).substring(2, 6).toUpperCase();
            state.playerId = 'P' + Date.now().toString(36).toUpperCase() + randomStr;
            // 更新localStorage
            data.playerId = state.playerId;
            localStorage.setItem('undercoverGameData', JSON.stringify(data));
            console.log('[ID] 生成新的playerId:', state.playerId);
        }
        
        console.log('[ID] 当前玩家ID:', state.playerId);
        console.log('[HOME] 当前房间ID:', state.roomId);

        // 构建名称映射
        state.playerNames = {};
        var realIdx = 0;
        state.players.forEach(function(p) {
            if (p && !p.startsWith('AI-')) {
                realIdx++;
                state.playerNames[p] = '玩家' + realIdx;
            } else if (p && p.startsWith('AI-')) {
                state.playerNames[p] = p;
            }
        });
        if (state.myPlayerId && state.playerNames[state.myPlayerId]) {
            state.playerNames[state.myPlayerId] = '我';
        }

        if (Object.keys(state.playerWords).length === 0) {
            state.players.forEach(function(p, i) {
                state.playerWords[p] = i === state.undercoverIndex ? state.undercoverWord : state.civilianWord;
            });
        }

        addLog('[GAME] 游戏加载完成', 'system');
        addLog('◈ ' + state.players.length + '人参与', 'system');

        renderPlayers();
        updateCurrentSpeaker();
        renderVoteOptions();

        // 待命区：开局前不显示发言界面（重连成功后会按房间状态切换）
        showWaiting();

        if (chatToggle) {
            chatToggle.addEventListener('click', toggleChat);
        }

        // ✓ 连接WebSocket
        connectWebSocket();

        var myWord = state.playerWords[state.myPlayerId];
        if (myWord) addLog('> 你的词: ' + myWord, 'info');

    } catch (error) {
        console.error('加载失败:', error);
        alert('游戏数据加载失败');
        window.location.href = '../game-hall/index.html';
    }
}

// ========== 事件绑定 ==========

speakInput.addEventListener('input', function() {
    var count = this.value.length;
    charCount.textContent = count + '/200';
    if (state.isMyTurn && !_speakLock) {
        submitSpeakBtn.disabled = count === 0;
    } else {
        submitSpeakBtn.disabled = true;
    }
    if (count > 0) {
        this.style.borderColor = '';
    }
});

// 按钮点击 - 唯一提交入口
submitSpeakBtn.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    if (_speakLock) {
        console.log('[!] 发言被锁定');
        return;
    }
    if (!state.isMyTurn) {
        console.log('[!] 还没轮到你');
        return;
    }
    if (submitSpeakBtn.disabled) return;
    handleSubmitSpeak();
});

// 键盘事件 - 只触发按钮点击
speakInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault();
        e.stopPropagation();
        if (!submitSpeakBtn.disabled && !_speakLock && state.isMyTurn) {
            submitSpeakBtn.click();
        }
    }
    // 单独Enter不提交
    if (e.key === 'Enter' && !e.ctrlKey) {
        e.preventDefault();
    }
});

endSpeakBtn.addEventListener('click', function(e) {
    e.preventDefault();
    enterVotePhase();
});

// 投票按钮防抖
confirmVoteBtn.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    if (_voteLock) {
        console.log('[!] 投票被锁定');
        return;
    }
    if (state.votedPlayers.has(state.myPlayerId)) {
        alert('你已经投过票了');
        return;
    }
    handleConfirmVote();
});

eliminateBtn.addEventListener('click', function(e) {
    e.preventDefault();
    handleEliminate();
});

goToResultBtn.addEventListener('click', function(e) {
    e.preventDefault();
    window.location.href = '../game-result/index.html';
});

// 待命区：房主开始游戏
startGameBtn.addEventListener('click', function(e) {
    e.preventDefault();
    if (!state.isHost) return;
    if (state.players.length < 1) return;
    startGameBtn.disabled = true;
    startGameBtn.textContent = '部署中...';
    sendWsMessage({
        type: 'startGame',
        playerId: state.playerId,
        data: { roomId: state.roomId }
    });
    // 3 秒后未收到 gameStarted 则恢复按钮（如服务端拒绝）
    setTimeout(function() {
        if (state.phase === 'waiting') {
            startGameBtn.disabled = false;
            startGameBtn.textContent = '» 开始游戏';
        }
    }, 3000);
});

// 待命区：房主解散房间
closeRoomBtn.addEventListener('click', function(e) {
    e.preventDefault();
    if (!state.isHost) return;
    if (!confirm('确定要解散房间吗？\n所有玩家将被移出。')) return;
    closeRoomBtn.disabled = true;
    closeRoomBtn.textContent = '解散中...';
    sendWsMessage({
        type: 'closeRoom',
        playerId: state.playerId,
        data: { roomId: state.roomId }
    });
});

// ========== 启动 ==========
document.addEventListener('DOMContentLoaded', initGame);

/* ---- MPOSTOR 趣味钩子：静音按钮 ---- */
document.addEventListener('DOMContentLoaded', function() {
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