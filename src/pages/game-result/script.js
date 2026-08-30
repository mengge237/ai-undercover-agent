// ========== 游戏结果页面 - 主逻辑 ==========

console.log('[GAME] 游戏结果页面已加载');

// DOM元素
const resultRoomId = document.getElementById('resultRoomId');
const resultIcon = document.getElementById('resultIcon');
const resultTitle = document.getElementById('resultTitle');
const resultSubtitle = document.getElementById('resultSubtitle');
const totalPlayers = document.getElementById('totalPlayers');
const roundsPlayed = document.getElementById('roundsPlayed');
const eliminatedCount = document.getElementById('eliminatedCount');
const winnerDisplay = document.getElementById('winnerDisplay');
const civilianWord = document.getElementById('civilianWord');
const undercoverWord = document.getElementById('undercoverWord');
const playersDetailGrid = document.getElementById('playersDetailGrid');
const reviewList = document.getElementById('reviewList');
const reviewTabs = document.querySelector('.review-tabs');
const replayBtn = document.getElementById('replayBtn');
const homeBtn = document.getElementById('homeBtn');

// ========== 游戏数据 ==========
let gameData = null;
let currentFilter = 'all';

// ========== 工具函数 ==========
function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

// ========== 加载数据 ==========
function loadGameData() {
    // 从 localStorage 读取结果数据
    const savedResult = localStorage.getItem('gameResultData');
    const savedGame = localStorage.getItem('undercoverGameData');
    
    if (savedResult) {
        try {
            gameData = JSON.parse(savedResult);
            console.log('✓ 加载结果数据:', gameData);
            return true;
        } catch (e) {
            console.error('解析结果数据失败:', e);
        }
    }
    
    if (savedGame) {
        try {
            const game = JSON.parse(savedGame);
            // 从游戏数据构建结果数据
            gameData = {
                roomId: game.roomId || 'LOCAL',
                result: 'unknown',
                players: game.players || [],
                undercoverIndex: game.undercoverIndex ?? -1,
                civilianWord: game.civilianWord || '???',
                undercoverWord: game.undercoverWord || '???',
                rounds: 1,
                descriptions: [],
            };
            console.log('✓ 从游戏数据构建结果:', gameData);
            return true;
        } catch (e) {
            console.error('解析游戏数据失败:', e);
        }
    }
    
    // 尝试从URL参数获取
    const roomId = getQueryParam('roomId');
    if (roomId) {
        gameData = {
            roomId: roomId,
            result: 'unknown',
            players: [],
            undercoverIndex: -1,
            civilianWord: '???',
            undercoverWord: '???',
            rounds: 1,
            descriptions: [],
        };
        console.log('✓ 从URL获取房间ID:', roomId);
        return true;
    }
    
    return false;
}

// ========== 渲染函数 ==========

// 渲染结果概览
function renderOverview() {
    if (!gameData) return;
    
    const isCivilianWin = gameData.result === 'civilian';
    const isUndercoverWin = gameData.result === 'undercover';
    const isUnknown = gameData.result === 'unknown';
    
    // 图标和标题
    if (isCivilianWin) {
        resultIcon.textContent = '◎';
        resultTitle.textContent = '平民胜利';
        resultTitle.setAttribute('data-text', '平民胜利');
        resultSubtitle.textContent = '// 所有卧底已被找出 // 正义执行完毕';
        winnerDisplay.textContent = '平民';
        winnerDisplay.style.color = 'var(--green)';
    } else if (isUndercoverWin) {
        resultIcon.textContent = '◈';
        resultTitle.textContent = '卧底胜利';
        resultTitle.setAttribute('data-text', '卧底胜利');
        resultSubtitle.textContent = '// 卧底潜伏至最后 // 完美渗透';
        winnerDisplay.textContent = '卧底';
        winnerDisplay.style.color = 'var(--red)';
    } else {
        resultIcon.textContent = '◆';
        resultTitle.textContent = '游戏结束';
        resultTitle.setAttribute('data-text', '游戏结束');
        resultSubtitle.textContent = '// 感谢参与 // 精彩的对决';
        winnerDisplay.textContent = '---';
        winnerDisplay.style.color = 'var(--amber)';
    }
    
    // 统计数据
    const players = gameData.players || [];
    totalPlayers.textContent = players.length;
    roundsPlayed.textContent = gameData.rounds || 1;
    
    // 淘汰人数（从描述中估算）
    const eliminated = gameData.eliminated || [];
    eliminatedCount.textContent = eliminated.length || 0;
    
    // 词语揭秘
    civilianWord.textContent = gameData.civilianWord || '???';
    undercoverWord.textContent = gameData.undercoverWord || '???';
    
    // 房间号
    resultRoomId.textContent = `房间: ${gameData.roomId || 'LOCAL'}`;
}

// 工业风角色与状态符号
function roleMark(isUndercover) { return isUndercover ? '◈' : '◎'; }
function statusMark(isEliminated) { return isEliminated ? '✕ 已淘汰' : '■ 存活'; }

// 渲染玩家详情
function renderPlayerDetails() {
    if (!gameData) return;
    
    playersDetailGrid.innerHTML = '';
    const players = gameData.players || [];
    const undercoverIndex = gameData.undercoverIndex ?? -1;
    
    players.forEach((player, index) => {
        const isUndercover = index === undercoverIndex;
        const isEliminated = gameData.eliminated?.includes(player) || false;
        
        const card = document.createElement('div');
        card.className = `player-detail-card ${isUndercover ? 'undercover' : 'civilian'} ${isEliminated ? 'eliminated' : ''}`;
        
        card.innerHTML = `
            <div class="player-detail-avatar">
                ${roleMark(isUndercover)}
                ${isEliminated ? '<span class="eliminated-badge">✕</span>' : ''}
            </div>
            <div class="player-detail-info">
                <div class="player-detail-name">${player}</div>
                <div class="player-detail-role">
                    ${isUndercover ? '◈ 卧底' : '◎ 平民'}
                </div>
                <div class="player-detail-word">
                    词: ${gameData.playerWords?.[player] || (isUndercover ? gameData.undercoverWord : gameData.civilianWord) || '???'}
                </div>
            </div>
            <div class="player-detail-status">
                ${statusMark(isEliminated)}
            </div>
        `;
        
        playersDetailGrid.appendChild(card);
    });
}

// 渲染发言回顾
function renderSpeechReview() {
    if (!gameData) return;
    
    const descriptions = gameData.descriptions || [];
    
    // 生成轮次标签
    const rounds = new Set();
    descriptions.forEach(d => rounds.add(d.round || 1));
    const sortedRounds = Array.from(rounds).sort((a, b) => a - b);
    
    // 清空标签（保留"全部"）
    const existingTabs = reviewTabs.querySelectorAll('.review-tab:not([data-round="all"])');
    existingTabs.forEach(tab => tab.remove());
    
    sortedRounds.forEach(round => {
        const tab = document.createElement('button');
        tab.className = 'review-tab';
        tab.dataset.round = round;
        tab.textContent = `第 ${round} 轮`;
        tab.addEventListener('click', () => {
            document.querySelectorAll('.review-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentFilter = round;
            renderReviewItems();
        });
        reviewTabs.appendChild(tab);
    });
    
    // 渲染条目
    renderReviewItems();
}

function renderReviewItems() {
    reviewList.innerHTML = '';
    const descriptions = gameData.descriptions || [];
    
    let filtered = descriptions;
    if (currentFilter !== 'all') {
        filtered = descriptions.filter(d => (d.round || 1) === currentFilter);
    }
    
    if (filtered.length === 0) {
        reviewList.innerHTML = '<div class="empty-review">暂无发言记录</div>';
        return;
    }
    
    filtered.forEach((item, index) => {
        const entry = document.createElement('div');
        entry.className = 'review-item';
        entry.style.animationDelay = `${index * 0.05}s`;
        
        const isUndercover = gameData.undercoverIndex >= 0 && 
            gameData.players?.indexOf(item.player) === gameData.undercoverIndex;
        
        entry.innerHTML = `
            <div class="review-item-header">
                <span class="review-speaker ${isUndercover ? 'undercover' : ''}">
                    ${roleMark(isUndercover)} ${item.player}
                </span>
                <span class="review-round">第 ${item.round || 1} 轮</span>
            </div>
            <div class="review-content">${item.content || '（未发言）'}</div>
        `;
        
        reviewList.appendChild(entry);
    });
}

// ========== 操作函数 ==========

// 再来一局
function replayGame() {
    // 清除旧数据
    localStorage.removeItem('gameResultData');
    // 保留游戏设置数据，跳转到设置页
    window.location.href = '../game-setup/index.html';
}

// 返回首页
function goHome() {
    localStorage.removeItem('gameResultData');
    window.location.href = '../../../index.html';
}

// ========== 初始化 ==========
function init() {
    // 全局登录门禁
    if (window.MPOSTOR && !window.MPOSTOR.auth.require()) return;

    console.log('[INIT] 初始化结果页面...');
    
    const hasData = loadGameData();
    
    if (!hasData) {
        // 无数据，显示错误
        resultTitle.textContent = '[!] 数据加载失败';
        resultSubtitle.textContent = '请从游戏页面进入';
        return;
    }
    
    renderOverview();
    renderPlayerDetails();
    renderSpeechReview();

    /* ---- MPOSTOR 趣味钩子：结算音效 + 全部标签 ---- */
    if (window.MPOSTOR) {
        if (gameData.result === 'unknown') {
            window.MPOSTOR.sound.play('confirm');
        } else {
            const isCivilianWin = gameData.result === 'civilian';
            const undercoverIndex = gameData.undercoverIndex ?? -1;
            const localPlayerIndex = 0;   // 本地玩家为 players[0]
            const iAmUndercover = localPlayerIndex === undercoverIndex;
            const iWon = (isCivilianWin && !iAmUndercover) || (!isCivilianWin && iAmUndercover);
            if (iWon) window.MPOSTOR.sound.play('victory');
            else window.MPOSTOR.sound.play('defeat');
        }
    }
    const allTab = document.querySelector('.review-tab[data-round="all"]');
    if (allTab) {
        allTab.addEventListener('click', () => {
            document.querySelectorAll('.review-tab').forEach(t => t.classList.remove('active'));
            allTab.classList.add('active');
            currentFilter = 'all';
            renderReviewItems();
        });
    }

    // 绑定事件
    replayBtn?.addEventListener('click', replayGame);
    homeBtn?.addEventListener('click', goHome);
    
    // 键盘快捷键
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            replayGame();
        }
        if (e.key === 'Escape') {
            goHome();
        }
    });
    
    console.log('✓ 结果页面初始化完成');
}

// ========== 启动 ==========
document.addEventListener('DOMContentLoaded', init);