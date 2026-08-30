// ========== AI猜词游戏 - 完整版 ==========

console.log('[PUZZLE] AI猜词游戏已加载');

// ========== DOM引用 ==========
var guessInput = document.getElementById('guessInput');
var guessBtn = document.getElementById('guessBtn');
var newGameBtn = document.getElementById('newGameBtn');
var playAgainBtn = document.getElementById('playAgainBtn');
var aiHintBtn = document.getElementById('aiHintBtn');
var guessHistoryList = document.getElementById('guessHistoryList');
var targetLength = document.getElementById('targetLength');
var attemptCount = document.getElementById('attemptCount');
var hintDisplay = document.getElementById('hintDisplay');
var gameStatus = document.getElementById('gameStatus');
var gameOverPanel = document.getElementById('gameOverPanel');
var resultIcon = document.getElementById('resultIcon');
var resultTitle = document.getElementById('resultTitle');
var resultDesc = document.getElementById('resultDesc');

// ========== 配置 ==========
var BACKEND_URL = 'http://localhost:8080';

// ========== 状态 ==========
var state = {
    targetWord: '',
    targetLength: 0,
    attempts: [],
    maxAttempts: 10,
    gameOver: false,
    isPlaying: false,
    isLoading: false
};

// ========== ✓ 扩展词库 ==========
var WORD_POOL = [
    // 水果
    '苹果', '香蕉', '橘子', '西瓜', '草莓', '葡萄', '芒果', '桃子', '梨子', '樱桃',
    '石榴', '柿子', '猕猴桃', '火龙果', '哈密瓜',
    // 动物
    '老虎', '狮子', '大象', '熊猫', '孔雀', '海豚', '鲸鱼', '企鹅', '骆驼', '长颈鹿',
    '松鼠', '狐狸', '狼', '鹿', '熊', '猴子', '兔子',
    // 电子产品
    '电脑', '手机', '电视', '冰箱', '空调', '洗衣机', '微波炉', '打印机', '路由器', '电风扇',
    '扫地机', '投影仪', '相机',
    // 职业
    '医生', '教师', '律师', '会计', '护士', '工程师', '程序员', '设计师', '摄影师', '飞行员',
    '建筑师', '警察', '消防员',
    // 季节/天气
    '春天', '夏天', '秋天', '冬天', '四季', '雨水', '惊蛰', '谷雨', '小满', '芒种',
    '立春', '立夏', '立秋', '立冬',
    // 心情
    '快乐', '悲伤', '愤怒', '平静', '激动', '温暖', '寒冷', '炎热', '凉爽', '宁静',
    '幸福', '感动', '期待',
    // 城市
    '中国', '北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '南京', '西安',
    '重庆', '天津', '苏州', '长沙', '郑州',
    // 运动
    '篮球', '足球', '网球', '乒乓', '游泳', '跑步', '登山', '瑜伽', '骑行', '滑雪',
    '羽毛球', '排球', '高尔夫',
    // 食物
    '咖啡', '奶茶', '可乐', '酸奶', '蜂蜜', '面包', '蛋糕', '米饭', '面条', '饺子',
    '包子', '馒头', '油条', '豆浆', '披萨', '汉堡',
    // ✓ 新增常用词
    '快递', '外卖', '网购', '微信', '抖音', '小红书', '美团', '饿了么',
    '高铁', '飞机', '地铁', '公交', '出租', '单车',
    '口罩', '酒精', '消毒', '疫苗', '核酸',
    '电影', '音乐', '游戏', '读书', '旅行', '美食', '摄影'
];

// ========== 类别映射（扩展） ==========
var CATEGORY_MAP = {
    '苹果': '水果', '香蕉': '水果', '橘子': '水果', '西瓜': '水果', '草莓': '水果',
    '葡萄': '水果', '芒果': '水果', '桃子': '水果', '梨子': '水果', '樱桃': '水果',
    '石榴': '水果', '柿子': '水果', '猕猴桃': '水果', '火龙果': '水果', '哈密瓜': '水果',
    '老虎': '动物', '狮子': '动物', '大象': '动物', '熊猫': '动物', '孔雀': '动物',
    '海豚': '动物', '鲸鱼': '动物', '企鹅': '动物', '骆驼': '动物', '长颈鹿': '动物',
    '松鼠': '动物', '狐狸': '动物', '狼': '动物', '鹿': '动物', '熊': '动物', '猴子': '动物', '兔子': '动物',
    '电脑': '电子产品', '手机': '电子产品', '电视': '电子产品', '冰箱': '电子产品', '空调': '电子产品',
    '洗衣机': '电子产品', '微波炉': '电子产品', '打印机': '电子产品', '路由器': '电子产品', '电风扇': '电子产品',
    '扫地机': '电子产品', '投影仪': '电子产品', '相机': '电子产品',
    '医生': '职业', '教师': '职业', '律师': '职业', '会计': '职业', '护士': '职业',
    '工程师': '职业', '程序员': '职业', '设计师': '职业', '摄影师': '职业', '飞行员': '职业',
    '建筑师': '职业', '警察': '职业', '消防员': '职业',
    '春天': '季节', '夏天': '季节', '秋天': '季节', '冬天': '季节', '四季': '季节',
    '立春': '季节', '立夏': '季节', '立秋': '季节', '立冬': '季节',
    '篮球': '运动', '足球': '运动', '网球': '运动', '乒乓': '运动', '游泳': '运动',
    '跑步': '运动', '登山': '运动', '瑜伽': '运动', '骑行': '运动', '滑雪': '运动',
    '羽毛球': '运动', '排球': '运动', '高尔夫': '运动',
    '咖啡': '饮品', '奶茶': '饮品', '可乐': '饮品', '酸奶': '饮品', '蜂蜜': '饮品',
    '面包': '食物', '蛋糕': '食物', '米饭': '食物', '面条': '食物', '饺子': '食物',
    '包子': '食物', '馒头': '食物', '油条': '食物', '豆浆': '食物', '披萨': '食物', '汉堡': '食物',
    '快递': '服务', '外卖': '服务', '网购': '服务', '微信': '应用', '抖音': '应用',
    '小红书': '应用', '美团': '应用', '饿了么': '应用',
    '高铁': '交通', '飞机': '交通', '地铁': '交通', '公交': '交通', '出租': '交通', '单车': '交通',
    '口罩': '用品', '酒精': '用品', '消毒': '用品', '疫苗': '医疗', '核酸': '医疗',
    '电影': '娱乐', '音乐': '娱乐', '游戏': '娱乐', '读书': '娱乐', '旅行': '娱乐',
    '美食': '娱乐', '摄影': '娱乐'
};

// ========== 工具函数 ==========
function getRandomWord() {
    var index = Math.floor(Math.random() * WORD_POOL.length);
    return WORD_POOL[index];
}

// ========== 核心逻辑 ==========

function startNewGame() {
    state.targetWord = getRandomWord();
    state.targetLength = state.targetWord.length;
    state.attempts = [];
    state.gameOver = false;
    state.isPlaying = true;
    state.isLoading = false;

    targetLength.textContent = '[ _ ] '.repeat(state.targetLength).trim();
    attemptCount.textContent = '0';

    var category = CATEGORY_MAP[state.targetWord] || '常见物品';
    hintDisplay.textContent = '▸ 提示：类别「' + category + '」· ' + state.targetLength + ' 字';
    hintDisplay.style.color = 'var(--green-dim)';

    gameStatus.textContent = '运行中';
    gameStatus.className = 'status playing';
    guessInput.disabled = false;
    guessBtn.disabled = false;
    aiHintBtn.disabled = false;
    guessInput.value = '';
    guessInput.focus();

    guessHistoryList.innerHTML = '<div class="empty-hint">还没有猜词记录</div>';
    gameOverPanel.style.display = 'none';

    console.log('[TARGET] 目标词:', state.targetWord, '类别:', category);
}

function handleGuess() {
    if (state.isLoading) {
        console.log('[WAIT] 正在处理，请稍候...');
        return;
    }
    if (state.gameOver || !state.isPlaying) {
        console.log('[!] 游戏已结束');
        return;
    }

    var guess = guessInput.value.trim();
    if (!guess) {
        hintDisplay.textContent = '! 请输入词语';
        hintDisplay.style.color = 'var(--red)';
        if (window.MPOSTOR) window.MPOSTOR.sound.play('error');
        return;
    }

    if (guess.length !== state.targetLength) {
        hintDisplay.textContent = '! 请输入 ' + state.targetLength + ' 个字的词语';
        hintDisplay.style.color = 'var(--red)';
        if (window.MPOSTOR) window.MPOSTOR.sound.play('error');
        return;
    }

    state.isLoading = true;
    guessBtn.disabled = true;
    aiHintBtn.disabled = true;

    var result = checkGuess(guess, state.targetWord);
    state.attempts.push({ guess: guess, result: result });

    renderHistory();
    attemptCount.textContent = state.attempts.length;

    // ✓ 猜对时显示胜利界面
    if (result.isCorrect) {
        if (window.MPOSTOR) window.MPOSTOR.sound.play('chirp');
        endGame(true);
        state.isLoading = false;
        guessBtn.disabled = false;
        aiHintBtn.disabled = false;
        return;
    }

    if (state.attempts.length >= state.maxAttempts) {
        endGame(false);
        state.isLoading = false;
        guessBtn.disabled = false;
        aiHintBtn.disabled = false;
        return;
    }

    if (window.MPOSTOR) window.MPOSTOR.sound.play('buzz');
    hintDisplay.textContent = '▸ ' + result.hint;
    hintDisplay.style.color = 'var(--amber)';
    guessInput.value = '';
    guessInput.focus();
    
    state.isLoading = false;
    guessBtn.disabled = false;
    aiHintBtn.disabled = false;
}

function checkGuess(guess, target) {
    var hint = '';
    var correctCount = 0;
    var positionCount = 0;

    var targetChars = target.split('');
    var guessChars = guess.split('');
    var targetUsed = new Array(targetChars.length).fill(false);
    var guessUsed = new Array(guessChars.length).fill(false);

    for (var i = 0; i < guessChars.length; i++) {
        if (i < targetChars.length && guessChars[i] === targetChars[i]) {
            positionCount++;
            targetUsed[i] = true;
            guessUsed[i] = true;
        }
    }

    for (var i = 0; i < guessChars.length; i++) {
        if (guessUsed[i]) continue;
        for (var j = 0; j < targetChars.length; j++) {
            if (targetUsed[j]) continue;
            if (guessChars[i] === targetChars[j]) {
                correctCount++;
                targetUsed[j] = true;
                guessUsed[i] = true;
                break;
            }
        }
    }

    var isCorrect = guess === target;

    if (isCorrect) {
        hint = '完全正确，目标已锁定！';
    } else if (positionCount > 0 && correctCount > 0) {
        hint = '▣ ' + positionCount + ' 个字位置正确，' + correctCount + ' 个字正确但位置不对';
    } else if (positionCount > 0) {
        hint = '▣ ' + positionCount + ' 个字位置正确';
    } else if (correctCount > 0) {
        hint = '↺ ' + correctCount + ' 个字正确但位置不对';
    } else {
        var category = CATEGORY_MAP[target] || '常见物品';
        var hintChars = target.split('');
        var firstChar = hintChars[0] || '';
        var lastChar = hintChars[hintChars.length - 1] || '';
        hint = '✕ 没有匹配的字符 · 类别「' + category + '」';
        if (firstChar) {
            hint += '，首字可能为「' + firstChar + '」';
        }
    }

    return {
        isCorrect: isCorrect,
        hint: hint,
        positionCount: positionCount,
        correctCount: correctCount
    };
}

function renderHistory() {
    guessHistoryList.innerHTML = '';
    if (state.attempts.length === 0) {
        guessHistoryList.innerHTML = '<div class="empty-hint">还没有猜词记录</div>';
        return;
    }
    state.attempts.forEach(function(item, index) {
        var div = document.createElement('div');
        div.className = 'history-item';
        if (item.result.isCorrect) {
            div.classList.add('correct');
        } else if (item.result.positionCount > 0 || item.result.correctCount > 0) {
            div.classList.add('partial');
        }

        var resultText = item.result.isCorrect ? '命中' :
                         item.result.positionCount > 0 || item.result.correctCount > 0 ?
                         '部分' : '脱靶';

        div.innerHTML = '<span class="guess-number">#' + (index + 1) + '</span>' +
            '<span class="guess-word">' + item.guess + '</span>' +
            '<span class="guess-result ' + (item.result.isCorrect ? 'correct' : item.result.positionCount > 0 || item.result.correctCount > 0 ? 'partial' : 'wrong') + '">' +
            resultText + '</span>' +
            '<span class="ai-hint">' + item.result.hint + '</span>';
        guessHistoryList.appendChild(div);
    });
    guessHistoryList.scrollTop = guessHistoryList.scrollHeight;
}

// ✓ 游戏结束 - 显示胜利/失败界面
function endGame(isWin) {
    state.gameOver = true;
    state.isPlaying = false;
    guessInput.disabled = true;
    guessBtn.disabled = true;
    aiHintBtn.disabled = true;

    gameStatus.textContent = isWin ? '任务完成' : '任务失败';
    gameStatus.className = 'status ended';

    // ✓ 显示弹窗
    gameOverPanel.style.display = 'flex';
    resultIcon.textContent = isWin ? '◉' : '✕';
    resultTitle.textContent = isWin ? 'TARGET ACQUIRED' : 'SIGNAL LOST';
    resultTitle.setAttribute('data-text', resultTitle.textContent);

    if (isWin) {
        resultDesc.innerHTML = '耗时 <strong>' + state.attempts.length + '</strong> 次尝试锁定目标「<strong>' + state.targetWord + '</strong>」<br>系统已记录你的战绩';
    } else {
        resultDesc.innerHTML = '目标词为「<strong>' + state.targetWord + '</strong>」<br>重启任务，再来一次';
    }

    hintDisplay.textContent = isWin ? '▸ 你赢了！' : '▸ 正确答案是：' + state.targetWord;
    hintDisplay.style.color = isWin ? 'var(--green)' : 'var(--red)';

    /* ---- MPOSTOR 趣味钩子：音效 + 统计 + 成就 ---- */
    if (window.MPOSTOR) {
        window.MPOSTOR.sound.play(isWin ? 'victory' : 'defeat');
        window.MPOSTOR.stats.add('guessPlayed');
        if (isWin) {
            window.MPOSTOR.stats.add('guessWins');
            if (state.attempts.length <= 3) window.MPOSTOR.ach.unlock('guess_master');
            if (state.attempts.length === 1) window.MPOSTOR.ach.unlock('guess_perfect');
        }
        window.MPOSTOR.voice.speak(isWin
            ? '锁定目标。' + state.targetWord + '，用时 ' + state.attempts.length + ' 次。'
            : '任务失败。目标词是：' + state.targetWord);
    }
}

// ========== AI提示功能 ==========
async function getAIHint() {
    if (state.gameOver || !state.isPlaying) {
        console.log('[!] 游戏已结束');
        return;
    }

    if (state.isLoading) {
        console.log('[WAIT] 正在处理，请稍候...');
        return;
    }

    state.isLoading = true;
    aiHintBtn.disabled = true;
    hintDisplay.textContent = 'AI> 分析中...';
    hintDisplay.style.color = 'var(--text-dim)';

    try {
        var lastGuess = state.attempts.length > 0 ? state.attempts[state.attempts.length - 1].guess : '';
        var response = await fetch(BACKEND_URL + '/api/game/guess/hint', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                guess: lastGuess,
                target: state.targetWord
            })
        });

        if (response.ok) {
            var data = await response.json();
            if (data.code === 0 && data.data && data.data.hint) {
                hintDisplay.textContent = 'AI> ' + data.data.hint;
                hintDisplay.style.color = 'var(--green)';
                hintDisplay.classList.remove('hint-popup');
                void hintDisplay.offsetWidth;
                hintDisplay.classList.add('hint-popup');
                state.isLoading = false;
                aiHintBtn.disabled = false;
                return;
            }
        }

        var localHint = generateSmartHint(state.targetWord, state.attempts);
        hintDisplay.textContent = '▸ ' + localHint;
        hintDisplay.style.color = 'var(--amber)';
        hintDisplay.classList.remove('hint-popup');
        void hintDisplay.offsetWidth;
        hintDisplay.classList.add('hint-popup');

    } catch (error) {
        console.warn('AI提示失败，使用本地提示:', error);
        var localHint2 = generateSmartHint(state.targetWord, state.attempts);
        hintDisplay.textContent = '▸ ' + localHint2;
        hintDisplay.style.color = 'var(--amber)';
    }

    state.isLoading = false;
    aiHintBtn.disabled = false;
}

// ✓ 智能本地提示生成
function generateSmartHint(targetWord, attempts) {
    var category = CATEGORY_MAP[targetWord] || '常见物品';
    var length = targetWord.length;
    
    if (attempts.length > 0) {
        var lastAttempt = attempts[attempts.length - 1];
        var lastResult = lastAttempt.result;
        
        if (lastResult.isCorrect) return '你已经猜对了！';
        
        if (lastResult.positionCount > 0) {
            return '有 ' + lastResult.positionCount + ' 个字位置正确，继续！类别：「' + category + '」';
        }
        
        if (lastResult.correctCount > 0) {
            return '有 ' + lastResult.correctCount + ' 个字是对的但位置不对，换换顺序。类别：「' + category + '」';
        }
        
        var targetChars = targetWord.split('');
        var firstChar = targetChars[0] || '';
        var lastChar = targetChars[targetChars.length - 1] || '';
        var hint = '完全不对，试试其他「' + category + '」相关的词';
        if (firstChar) {
            hint += '，比如以「' + firstChar + '」开头';
        }
        if (lastChar && lastChar !== firstChar) {
            hint += '或「' + lastChar + '」结尾的';
        }
        return hint;
    }
    
    return '这个词属于「' + category + '」类别，共 ' + length + ' 个字，试试看！';
}

// ========== 事件绑定 ==========

guessBtn.addEventListener('click', function(e) {
    e.preventDefault();
    handleGuess();
});

guessInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        if (!guessBtn.disabled) {
            handleGuess();
        }
    }
});

newGameBtn.addEventListener('click', startNewGame);

playAgainBtn.addEventListener('click', function() {
    gameOverPanel.style.display = 'none';
    startNewGame();
});

aiHintBtn.addEventListener('click', function(e) {
    e.preventDefault();
    getAIHint();
});

// ========== 初始化 ==========

/* ---- MPOSTOR 静音开关 ---- */
var muteBtn = document.getElementById('muteBtn');
if (muteBtn && window.MPOSTOR) {
    muteBtn.textContent = window.MPOSTOR.sound.isMuted() ? 'SOUND: OFF' : 'SOUND: ON';
    muteBtn.addEventListener('click', function () {
        var muted = window.MPOSTOR.sound.toggleMute();
        muteBtn.textContent = muted ? 'SOUND: OFF' : 'SOUND: ON';
    });
}

// ========== 初始化 ==========
// 全局登录门禁 + 语音输入挂载
if (window.MPOSTOR && window.MPOSTOR.auth.require()) {
    window.MPOSTOR.voice.attachMic(guessInput);
    startNewGame();
}