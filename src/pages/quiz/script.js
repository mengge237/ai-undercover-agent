// ========== MPOSTOR 趣味问答 - 答题终端 ==========

console.log('✓ 趣味问答终端已加载');

// ========== DOM引用 ==========
var quizQuestion = document.getElementById('quizQuestion');
var quizOptions = document.getElementById('quizOptions');
var quizFeedback = document.getElementById('quizFeedback');
var progressSegs = document.getElementById('progressSegs');
var scoreDisplay = document.getElementById('scoreDisplay');
var questionNo = document.getElementById('questionNo');
var quizSource = document.getElementById('quizSource');
var gameStatus = document.getElementById('gameStatus');
var quizOverPanel = document.getElementById('quizOverPanel');
var quizResultIcon = document.getElementById('quizResultIcon');
var quizResultTitle = document.getElementById('quizResultTitle');
var quizResultDesc = document.getElementById('quizResultDesc');
var quizAgainBtn = document.getElementById('quizAgainBtn');
var muteBtn = document.getElementById('muteBtn');

// ========== 配置 ==========
var BACKEND_URL = 'http://localhost:8080';
var OPTION_KEYS = ['A', 'B', 'C', 'D'];

// ========== 状态 ==========
var state = {
    gameId: null,
    total: 5,
    score: 0,
    busy: false
};

// ========== 工具 ==========
function setStatus(text, cls) {
    gameStatus.textContent = text;
    gameStatus.className = 'status' + (cls ? ' ' + cls : '');
}

async function post(path, body) {
    var resp = await fetch(BACKEND_URL + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    var data = await resp.json();
    if (data.code !== 0) {
        throw new Error(data.message || '请求失败');
    }
    return data.data;
}

// ========== 渲染 ==========
function renderSegsMark(marks) {
    progressSegs.innerHTML = '';
    for (var i = 0; i < state.total; i++) {
        var seg = document.createElement('div');
        seg.className = 'progress-seg';
        if (i < marks.length) {
            seg.className += marks[i] ? ' done' : ' failed';
        } else if (i === marks.length) {
            seg.className += ' current';
        }
        progressSegs.appendChild(seg);
    }
}

function renderQuestion(q, no) {
    quizQuestion.textContent = q.question;
    questionNo.textContent = no + ' / ' + state.total;
    quizFeedback.textContent = '';
    quizFeedback.className = 'feedback-line';
    quizOptions.innerHTML = '';
    if (window.MPOSTOR) window.MPOSTOR.voice.speak('第' + no + '题。' + q.question);

    (q.options || []).forEach(function (opt, index) {
        var btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerHTML = '<span class="option-key">' + (OPTION_KEYS[index] || index + 1) + '</span><span>' + opt + '</span>';
        btn.addEventListener('click', function () {
            if (!state.busy) handleAnswer(index, btn);
        });
        quizOptions.appendChild(btn);
    });
}

function disableOptions() {
    quizOptions.querySelectorAll('.option-btn').forEach(function (b) { b.disabled = true; });
}

function revealOptions(correctIndex) {
    quizOptions.querySelectorAll('.option-btn').forEach(function (b, index) {
        b.disabled = true;
        if (index === correctIndex) {
            b.classList.add('correct');
        } else if (b.classList.contains('picked')) {
            b.classList.add('wrong');
        }
    });
}

// ========== 核心逻辑 ==========
async function startQuiz() {
    state.score = 0;
    state.busy = false;
    quizOverPanel.style.display = 'none';
    scoreDisplay.textContent = '0';
    setStatus('出题中...', 'playing');
    quizQuestion.textContent = 'AI 正在出题...';
    quizOptions.innerHTML = '';
    window._quizMarks = [];
    renderSegsMark([]);

    try {
        var data = await post('/api/game/quiz/start', {});
        state.gameId = data.gameId;
        state.total = data.total || 5;
        quizSource.textContent = data.source === 'local' ? 'LOCAL BANK' : 'AI GENERATED';

        renderSegsMark([]);
        renderQuestion(data.question, data.questionNo || 1);
        setStatus('答题中');

        if (window.MPOSTOR) {
            window.MPOSTOR.sound.play('confirm');
            window.MPOSTOR.stats.add('quizPlayed');
        }
    } catch (e) {
        quizQuestion.textContent = '// 后端连接失败，请确认 Spring Boot 已启动（localhost:8080）';
        setStatus('离线', 'ended');
        if (window.MPOSTOR) window.MPOSTOR.sound.play('error');
    }
}

async function handleAnswer(index, pickedBtn) {
    if (state.busy || !state.gameId) return;
    state.busy = true;
    pickedBtn.classList.add('picked');

    try {
        var data = await post('/api/game/quiz/answer', { gameId: state.gameId, index: index });

        if (data.correct) {
            state.score = data.score;
            scoreDisplay.textContent = state.score;
            quizFeedback.textContent = '▣ 正确！' + (data.explanation ? ' ' + data.explanation : '');
            quizFeedback.className = 'feedback-line ok';
            if (window.MPOSTOR) {
                window.MPOSTOR.sound.play('chirp');
                window.MPOSTOR.voice.speak('正确。' + (data.explanation || ''));
            }
        } else {
            scoreDisplay.textContent = data.score;
            quizFeedback.textContent = '✕ 错误。' + (data.explanation || '');
            quizFeedback.className = 'feedback-line err';
            if (window.MPOSTOR) {
                window.MPOSTOR.sound.play('buzz');
                window.MPOSTOR.fx.glitch(250);
                window.MPOSTOR.voice.speak('错误。' + (data.explanation || ''));
            }
        }

        revealOptions(data.correctIndex);

        // 记录本轮对错并渲染进度段
        window._quizMarks = window._quizMarks || [];
        window._quizMarks.push(data.correct);
        renderSegsMark(window._quizMarks);

        if (data.finished) {
            finishQuiz(data.score, data.total);
            return;
        }

        // 延迟进入下一题
        setTimeout(function () {
            state.busy = false;
            if (data.question) {
                renderQuestion(data.question, data.questionNo);
                renderSegsMark(window._quizMarks);
            } else {
                // 修复：下一题数据缺失时给提示并恢复可操作，避免页面冻结
                quizFeedback.textContent = '✕ 题目数据缺失，请点击「再来一轮」';
                quizFeedback.className = 'feedback-line err';
                disableOptions();
                if (window.MPOSTOR) window.MPOSTOR.sound.play('error');
            }
        }, 1400);
    } catch (e) {
        quizFeedback.textContent = '✕ ' + e.message;
        quizFeedback.className = 'feedback-line err';
        state.busy = false;
        if (window.MPOSTOR) window.MPOSTOR.sound.play('error');
    }
}

function finishQuiz(score, total) {
    state.busy = true;
    setStatus('阅卷中', 'ended');
    window._quizMarks = [];

    var perfect = score === total;
    setTimeout(function () {
        quizOverPanel.style.display = 'flex';
        quizResultIcon.textContent = perfect ? '✓' : '◈';
        quizResultTitle.textContent = perfect ? 'PERFECT SCORE' : 'ROUND COMPLETE';
        quizResultTitle.setAttribute('data-text', quizResultTitle.textContent);
        quizResultDesc.innerHTML = '得分 <strong>' + score + ' / ' + total + '</strong><br>' +
            (perfect ? '全知者，系统记录在案。' : '继续训练，AI 还会出题。');

        if (window.MPOSTOR) {
            window.MPOSTOR.sound.play(perfect ? 'victory' : 'defeat');
            window.MPOSTOR.stats.add('quizScore', score);
            if (perfect) window.MPOSTOR.ach.unlock('quiz_perfect');
            window.MPOSTOR.voice.speak(perfect ? '满分！全知者。' : '本轮得分 ' + score + ' 分，共 ' + total + ' 题。');
        }
        state.busy = false;
    }, 600);
}

// ========== 事件绑定 ==========
quizAgainBtn.addEventListener('click', startQuiz);

/* ---- MPOSTOR 静音开关 ---- */
if (muteBtn && window.MPOSTOR) {
    muteBtn.textContent = window.MPOSTOR.sound.isMuted() ? 'SOUND: OFF' : 'SOUND: ON';
    muteBtn.addEventListener('click', function () {
        var muted = window.MPOSTOR.sound.toggleMute();
        muteBtn.textContent = muted ? 'SOUND: OFF' : 'SOUND: ON';
    });
}

// ========== 初始化 ==========
// 全局登录门禁
if (window.MPOSTOR && window.MPOSTOR.auth.require()) {
    startQuiz();
}
