const playersGrid = document.getElementById('playersGrid');
const wordInputArea = document.getElementById('wordInputArea');
const startBtn = document.getElementById('startGameBtn');
const loadingOverlay = document.getElementById('loadingOverlay');
const roomInfo = document.getElementById('roomInfo');
const myPlayerName = document.getElementById('myPlayerName');
const aiPlayerCount = document.getElementById('aiPlayerCount');
const refreshPlayersBtn = document.getElementById('refreshPlayersBtn');

const BACKEND_URL = 'http://localhost:8080';

let playerInputs = [];
let currentWordSource = 'ai';
let aiCategory = '水果';
let roomId = null;
let aiCount = 4;
let maxPlayers = 6;

const CHARACTER_POOL = [
    '秦始皇', '汉武帝', '唐太宗', '诸葛亮', '关羽', '张飞',
    '李白', '杜甫', '苏轼', '白居易', '王维', '李清照',
    '马云', '马化腾', '雷军', '周杰伦', '刘德华', '成龙',
    '周星驰', '张学友', '郭富城', '黎明', '梁朝伟', '张曼玉',
    '路飞', '鸣人', '柯南', '皮卡丘', '马里奥', '海绵宝宝',
    '钢铁侠', '蜘蛛侠', '美国队长', '雷神', '黑寡妇', '绿巨人',
    '哈利波特', '福尔摩斯', '白娘子', '梁山伯', '祝英台', '孙悟空',
    '唐僧', '猪八戒', '沙僧', '贾宝玉', '林黛玉', '薛宝钗',
    '女娲', '后羿', '雅典娜', '宙斯', '玉皇大帝', '如来佛祖',
    '观音菩萨', '二郎神', '哪吒', '杨戬', '姜子牙', '妲己',
    '喜羊羊', '灰太狼', '小猪佩奇', '光头强', '熊大', '熊二',
    '哆啦A梦', '大雄', '静香', '胖虎', '小夫'
];

function getRandomCharacters(count) {
    const shuffled = [...CHARACTER_POOL].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
}

function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

function renderPlayers() {
    if (!playersGrid) return;

    const urlPlayers = getQueryParam('players');
    const urlAiCount = getQueryParam('aiCount');
    const urlMaxPlayers = getQueryParam('maxPlayers');

    if (urlPlayers) {
        try {
            const parsed = JSON.parse(decodeURIComponent(urlPlayers));
            if (Array.isArray(parsed) && parsed.length > 0) {
                renderPlayerInputs(parsed);
                return;
            }
        } catch (e) {}
    }

    if (urlAiCount) aiCount = parseInt(urlAiCount) || 4;
    if (urlMaxPlayers) maxPlayers = parseInt(urlMaxPlayers) || 6;

    const allNames = getRandomCharacters(maxPlayers);
    renderPlayerInputs(allNames);
    updatePlayerHint();
}

function renderPlayerInputs(players) {
    playersGrid.innerHTML = '';
    playerInputs = [];

    players.forEach((name, index) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'player-input-wrapper';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'player-input';
        input.placeholder = `玩家 ${index + 1}`;
        input.value = name;
        input.dataset.index = index;

        if (index === 0) {
            input.style.fontWeight = '600';
            input.style.borderRight = '2px solid #1a1a1a';
            input.dataset.isHuman = 'true';
        } else {
            input.disabled = true;
            input.style.color = '#888';
            input.dataset.isHuman = 'false';
            const aiLabel = document.createElement('span');
            aiLabel.style.cssText = `
                position: absolute; right: 8px; top: 50%;
                -webkit-transform: translateY(-50%);
                transform: translateY(-50%);
                font-size: 11px; color: #999;
                background: #f0f0f0; padding: 1px 8px; border-radius: 3px;
            `;
            aiLabel.textContent = 'AI';
            wrapper.style.position = 'relative';
            wrapper.appendChild(aiLabel);
        }

        wrapper.appendChild(input);
        playersGrid.appendChild(wrapper);
        playerInputs.push({ wrapper, input });
    });
}

function updatePlayerHint() {
    const human = playerInputs.filter(p => p.input.dataset.isHuman === 'true');
    const ai = playerInputs.filter(p => p.input.dataset.isHuman === 'false');
    if (human.length > 0) myPlayerName.textContent = human[0].input.value;
    aiPlayerCount.textContent = ai.length;
}

function renderWordSettings() {
    if (!wordInputArea) return;

    wordInputArea.innerHTML = `
        <div class="ai-gen-area" id="aiGenArea">
            <select id="aiCategorySelect">
                <option value="水果">水果</option>
                <option value="家禽">家禽</option>
                <option value="电子产品">电子产品</option>
                <option value="动物">动物</option>
                <option value="交通工具">交通工具</option>
                <option value="颜色">颜色</option>
                <option value="食物">食物</option>
                <option value="职业">职业</option>
                <option value="娱乐">娱乐</option>
                <option value="地点">地点</option>
            </select>
            <span class="hint">AI将生成一对相似词语</span>
        </div>
        <div class="manual-gen-area hidden" id="manualGenArea">
            <input type="text" class="word-input" id="manualCivilian" placeholder="平民词">
            <input type="text" class="word-input" id="manualUndercover" placeholder="卧底词">
            <span class="hint">两个词应相似但不同</span>
        </div>
    `;

    document.getElementById('aiCategorySelect')?.addEventListener('change', function() {
        aiCategory = this.value;
    });

    document.querySelectorAll('.radio-item').forEach(item => {
        item.addEventListener('click', function() {
            document.querySelectorAll('.radio-item').forEach(r => r.classList.remove('active'));
            this.classList.add('active');
            const source = this.dataset.value;
            currentWordSource = source;
            const aiArea = document.getElementById('aiGenArea');
            const manualArea = document.getElementById('manualGenArea');
            if (source === 'ai') {
                aiArea?.classList.remove('hidden');
                manualArea?.classList.add('hidden');
            } else {
                aiArea?.classList.add('hidden');
                manualArea?.classList.remove('hidden');
            }
        });
    });
}

function generateWordPair(category) {
    const wordPairs = {
        '水果': { civilian: '苹果', undercover: '桃子' },
        '家禽': { civilian: '鸡', undercover: '鸭' },
        '电子产品': { civilian: '手机', undercover: '平板电脑' },
        '动物': { civilian: '老虎', undercover: '狮子' },
        '交通工具': { civilian: '汽车', undercover: '火车' },
        '颜色': { civilian: '红色', undercover: '粉色' },
        '食物': { civilian: '汉堡', undercover: '三明治' },
        '职业': { civilian: '医生', undercover: '护士' },
        '娱乐': { civilian: '电影', undercover: '电视剧' },
        '地点': { civilian: '图书馆', undercover: '书店' }
    };
    return wordPairs[category] || { civilian: '牛奶', undercover: '豆浆' };
}

async function createRoomAPI(players, category, wordSource, manualWords) {
    const payload = {
        players: players,
        category: category,
        wordSource: wordSource,
        maxPlayers: maxPlayers,
        aiCount: aiCount
    };
    if (wordSource === 'manual' && manualWords) {
        payload.customWords = manualWords;
    }
    try {
        const response = await fetch(`${BACKEND_URL}/api/game/undercover/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (response.ok) {
            const result = await response.json();
            if (result.code === 0 || result.status === 'success') return result.data;
            throw new Error(result.message || '创建失败');
        }
        throw new Error(`HTTP ${response.status}`);
    } catch (error) {
        return null;
    }
}

async function onStartGame() {
    const players = playerInputs.map(p => p.input.value.trim());

    if (players.some(p => !p)) {
        alert('请填写所有玩家名称');
        return;
    }
    if (new Set(players).size < players.length) {
        alert('玩家名称不能重复');
        return;
    }

    let category = aiCategory;
    let wordSource = currentWordSource;
    let manualWords = null;

    if (wordSource === 'manual') {
        const civilian = document.getElementById('manualCivilian')?.value.trim();
        const undercover = document.getElementById('manualUndercover')?.value.trim();
        if (!civilian || !undercover) {
            alert('请填写平民词和卧底词');
            return;
        }
        if (civilian === undercover) {
            alert('平民词和卧底词不能相同');
            return;
        }
        manualWords = { civilian, undercover };
        category = '自定义';
    }

    loadingOverlay?.classList.add('active');
    startBtn.disabled = true;
    if (window.MPOSTOR) window.MPOSTOR.sound.play('boot');

    try {
        const roomData = await createRoomAPI(players, category, wordSource, manualWords);

        if (roomData) {
            if (window.MPOSTOR) {
                window.MPOSTOR.sound.play('confirm');
                window.MPOSTOR.ach.unlock('host');
            }
            roomId = roomData.roomId || roomData.id;
            const words = roomData.civilianWord && roomData.undercoverWord
                ? { civilian: roomData.civilianWord, undercover: roomData.undercoverWord }
                : generateWordPair(category);

            localStorage.setItem('undercoverGameData', JSON.stringify({
                roomId: roomId,
                players: players,
                civilianWord: words.civilian,
                undercoverWord: words.undercover,
                undercoverIndex: roomData.undercoverIndex ?? Math.floor(Math.random() * players.length),
                playerWords: roomData.playerWords || {},
                maxPlayers: maxPlayers,
                aiCount: aiCount,
                isHost: true,
                timestamp: Date.now()
            }));
            window.location.href = `../game-play/index.html?roomId=${roomId}`;
        } else {
            const words = generateWordPair(category);
            roomId = 'LOCAL-' + Date.now().toString(36).toUpperCase();
            const undercoverIndex = Math.floor(Math.random() * players.length);

            localStorage.setItem('undercoverGameData', JSON.stringify({
                roomId: roomId,
                players: players,
                civilianWord: words.civilian,
                undercoverWord: words.undercover,
                undercoverIndex: undercoverIndex,
                playerWords: players.reduce((acc, p, i) => {
                    acc[p] = i === undercoverIndex ? words.undercover : words.civilian;
                    return acc;
                }, {}),
                maxPlayers: maxPlayers,
                aiCount: aiCount,
                isHost: true,
                isLocal: true,
                timestamp: Date.now()
            }));
            window.location.href = `../game-play/index.html?roomId=${roomId}`;
        }
    } catch (error) {
        alert('创建游戏失败，请重试');
    } finally {
        loadingOverlay?.classList.remove('active');
        startBtn.disabled = false;
    }
}

function loadFromHall() {
    const urlRoomId = getQueryParam('roomId');
    const urlPlayerId = getQueryParam('playerId');
    const urlPlayers = getQueryParam('players');
    const urlAiCount = getQueryParam('aiCount');

    if (urlRoomId) {
        roomId = urlRoomId;
        roomInfo.textContent = `房间: ${roomId}`;
    }
    if (urlAiCount) aiCount = parseInt(urlAiCount) || 4;

    if (urlPlayers) {
        try {
            const parsed = JSON.parse(decodeURIComponent(urlPlayers));
            if (Array.isArray(parsed) && parsed.length > 0) {
                renderPlayerInputs(parsed);
                updatePlayerHint();
                return true;
            }
        } catch (e) {}
    }
    return false;
}

function init() {
    // 全局登录门禁
    if (window.MPOSTOR && !window.MPOSTOR.auth.require()) return;

    const hasParams = loadFromHall();
    if (!hasParams) renderPlayers();
    renderWordSettings();

    startBtn?.addEventListener('click', onStartGame);
    refreshPlayersBtn?.addEventListener('click', () => {
        const currentPlayers = playerInputs.map(p => p.input.value.trim());
        const newNames = getRandomCharacters(currentPlayers.length);
        playerInputs.forEach((p, i) => {
            p.input.value = newNames[i] || p.input.value;
        });
        updatePlayerHint();
    });

    fetch(`${BACKEND_URL}/api/game/undercover/room/test`, { method: 'GET' })
        .then(r => { if (r.ok) console.log('Backend connected'); })
        .catch(() => console.log('Backend not connected, using local mode'));
}

document.addEventListener('DOMContentLoaded', init);
