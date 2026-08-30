// 确保DOM加载完成后再执行
document.addEventListener('DOMContentLoaded', function() {
    const DEFAULT_PLAYERS = ["玩家1", "玩家2", "玩家3", "玩家4", "玩家5", "玩家6"];
    const playersGrid = document.getElementById('playersGrid');

    // 渲染玩家输入框
    function renderPlayersGrid() {
        if (!playersGrid) return;
        playersGrid.innerHTML = '';
        DEFAULT_PLAYERS.forEach((playerName, index) => {
            const wrapper = document.createElement('div');
            wrapper.style.display = 'flex';
            wrapper.style.alignItems = 'center';
            wrapper.style.gap = '10px';
            wrapper.style.marginBottom = '8px';
            
            const label = document.createElement('label');
            label.textContent = `角色${index + 1}:`;
            label.style.minWidth = '50px';
            
            const input = document.createElement('input');
            input.type = 'text';
            input.value = playerName;
            input.style.flex = '1';
            input.style.padding = '8px';
            input.style.border = '1px solid #ddd';
            input.style.borderRadius = '20px';
            
            input.addEventListener('change', (e) => {
                DEFAULT_PLAYERS[index] = e.target.value.trim() || DEFAULT_PLAYERS[index];
            });
            
            wrapper.appendChild(label);
            wrapper.appendChild(input);
            playersGrid.appendChild(wrapper);
        });
    }

    const wordContainer = document.getElementById('wordInputArea');
    let currentWordMode = 'ai';
    let currentBaseWord = '咖啡';
    let currentCivilianWord = '咖啡';
    let currentUndercoverWord = '奶茶';

    const aiRadio = document.querySelector('#wordSourceGroup input[value="ai"]');
    const manualRadio = document.querySelector('#wordSourceGroup input[value="manual"]');

    // 相似词库
    const SIMILAR_WORDS = {
        '咖啡': ['奶茶', '可可', '拿铁', '卡布奇诺', '摩卡'],
        '电脑': ['笔记本', '台式机', '平板', '服务器', '工作站'],
        '苹果': ['橘子', '香蕉', '橙子', '梨', '桃子'],
        '火车': ['高铁', '地铁', '轻轨', '动车', '有轨电车'],
        '电影': ['话剧', '电视剧', '舞台剧', '歌剧', '音乐剧'],
        '足球': ['篮球', '排球', '乒乓球', '网球', '羽毛球'],
        '老师': ['教练', '导师', '教授', '讲师', '教师'],
        '披萨': ['汉堡', '三明治', '热狗', '卷饼', '意面'],
        '沙漠': ['绿洲', '戈壁', '荒野', '草原', '丛林'],
        '玫瑰': ['月季', '牡丹', '菊花', '百合', '郁金香']
    };

    function getSimilarWords(baseWord) {
        if (SIMILAR_WORDS[baseWord]) {
            const list = SIMILAR_WORDS[baseWord];
            return { civilian: baseWord, undercover: list[Math.floor(Math.random() * list.length)] };
        }
        return { civilian: baseWord, undercover: baseWord + '2' };
    }

    function updateWordPair(word) {
        const pair = getSimilarWords(word);
        currentCivilianWord = pair.civilian;
        currentUndercoverWord = pair.undercover;
    }

    // AI模式
    function renderAIContent() {
        const container = document.createElement('div');
        container.style.marginTop = '10px';
        
        const inputGroup = document.createElement('div');
        inputGroup.style.display = 'flex';
        inputGroup.style.alignItems = 'center';
        inputGroup.style.gap = '10px';
        
        const label = document.createElement('label');
        label.textContent = '输入词:';
        label.style.fontWeight = 'bold';
        label.style.minWidth = '60px';
        
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentBaseWord;
        input.style.flex = '1';
        input.style.padding = '10px';
        input.style.border = '1px solid #ccc';
        input.style.borderRadius = '8px';
        
        input.addEventListener('focus', () => {
            if (input.value === currentBaseWord) input.value = '';
        });
        
        input.addEventListener('blur', () => {
            let val = input.value.trim();
            if (val === '') {
                input.value = currentBaseWord;
            } else {
                currentBaseWord = val;
                updateWordPair(currentBaseWord);
            }
        });
        
        input.addEventListener('change', () => {
            let val = input.value.trim();
            if (val !== '') {
                currentBaseWord = val;
                updateWordPair(currentBaseWord);
            }
        });
        
        inputGroup.appendChild(label);
        inputGroup.appendChild(input);
        container.appendChild(inputGroup);
        
        wordContainer.innerHTML = '';
        wordContainer.appendChild(container);
    }

    // 手动模式
    function renderManualContent() {
        wordContainer.innerHTML = '';
        
        const civilianDiv = document.createElement('div');
        civilianDiv.style.display = 'flex';
        civilianDiv.style.alignItems = 'center';
        civilianDiv.style.gap = '10px';
        civilianDiv.style.marginBottom = '10px';
        
        const civilianLabel = document.createElement('label');
        civilianLabel.textContent = '平民词:';
        civilianLabel.style.fontWeight = 'bold';
        civilianLabel.style.minWidth = '70px';
        
        const civilianInput = document.createElement('input');
        civilianInput.type = 'text';
        civilianInput.placeholder = '例如: 咖啡';
        civilianInput.id = 'civilianWordInput';
        civilianInput.style.flex = '1';
        civilianInput.style.padding = '10px';
        civilianInput.style.border = '1px solid #ccc';
        civilianInput.style.borderRadius = '8px';
        
        civilianDiv.appendChild(civilianLabel);
        civilianDiv.appendChild(civilianInput);
        
        const undercoverDiv = document.createElement('div');
        undercoverDiv.style.display = 'flex';
        undercoverDiv.style.alignItems = 'center';
        undercoverDiv.style.gap = '10px';
        
        const undercoverLabel = document.createElement('label');
        undercoverLabel.textContent = '卧底词:';
        undercoverLabel.style.fontWeight = 'bold';
        undercoverLabel.style.minWidth = '70px';
        
        const undercoverInput = document.createElement('input');
        undercoverInput.type = 'text';
        undercoverInput.placeholder = '例如: 奶茶';
        undercoverInput.id = 'undercoverWordInput';
        undercoverInput.style.flex = '1';
        undercoverInput.style.padding = '10px';
        undercoverInput.style.border = '1px solid #ccc';
        undercoverInput.style.borderRadius = '8px';
        
        undercoverDiv.appendChild(undercoverLabel);
        undercoverDiv.appendChild(undercoverInput);
        
        wordContainer.appendChild(civilianDiv);
        wordContainer.appendChild(undercoverDiv);
        
        window.manualInputs = { civilian: civilianInput, undercover: undercoverInput };
    }

    function renderDynamicContent() {
        if (!wordContainer) return;
        currentWordMode === 'ai' ? renderAIContent() : renderManualContent();
    }

    // 监听单选框
    function bindRadioEvents() {
        if (aiRadio && manualRadio) {
            aiRadio.addEventListener('change', () => {
                if (aiRadio.checked) {
                    currentWordMode = 'ai';
                    renderDynamicContent();
                    const hint = document.getElementById('dynamicHint');
                    if (hint) hint.innerHTML = '[AI] AI模式: 输入词语，自动生成相似卧底词';
                }
            });
            
            manualRadio.addEventListener('change', () => {
                if (manualRadio.checked) {
                    currentWordMode = 'manual';
                    renderDynamicContent();
                    const hint = document.getElementById('dynamicHint');
                    if (hint) hint.innerHTML = '[EDIT] 手动模式: 直接输入平民词和卧底词';
                }
            });
        }
    }

    function getWordPairForGame() {
        if (currentWordMode === 'ai') {
            return { civilian: currentCivilianWord, undercover: currentUndercoverWord };
        } else {
            let civilian = window.manualInputs?.civilian.value.trim() || '月亮';
            let undercover = window.manualInputs?.undercover.value.trim() || '玉盘';
            return { civilian, undercover };
        }
    }

    function startGame() {
        const inputs = document.querySelectorAll('#playersGrid input');
        const players = [];
        inputs.forEach((input, i) => {
            let name = input.value.trim();
            if (name === '') name = DEFAULT_PLAYERS[i];
            players.push(name);
        });
        
        const pair = getWordPairForGame();
        const underIdx = Math.floor(Math.random() * players.length);
        
        let msg = "[ROLE] 游戏角色分配 [ROLE]\n\n";
        for (let i = 0; i < players.length; i++) {
            const role = i === underIdx ? "卧底" : "平民";
            const word = i === underIdx ? pair.undercover : pair.civilian;
            msg += `【${role}】${players[i]}: 「${word}」\n`;
        }
        msg += `\n平民词: ${pair.civilian} | 卧底词: ${pair.undercover}`;
        alert(msg);
        
        const hint = document.getElementById('dynamicHint');
        if (hint) hint.innerHTML = `✓ 游戏已开始！平民词“${pair.civilian}” | 卧底词“${pair.undercover}”`;
    }

    function bindStartButton() {
        const btn = document.querySelector('.btn-start');
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                startGame();
            });
        }
    }

    function init() {
        renderPlayersGrid();
        bindRadioEvents();
        renderDynamicContent();
        bindStartButton();
    }

    init();
});