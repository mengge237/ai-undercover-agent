var HTTP_URL = 'http://localhost:8080';

var params = new URLSearchParams(window.location.search);
var rawRedirect = params.get('redirect') || '';
var REDIRECT = resolveRedirect(rawRedirect);

var usernameInput = document.getElementById('usernameInput');
var passwordInput = document.getElementById('passwordInput');
var submitBtn = document.getElementById('submitBtn');
var feedbackLine = document.getElementById('feedbackLine');
var modeTag = document.getElementById('modeTag');
var modeSelector = document.getElementById('modeSelector');

var mode = 'login';
var busy = false;

/* redirect 由 MPOSTOR.auth.require() 生成：相对 src/ 的路径（如 pages/game-play/index.html?roomId=x）
   登录页位于 src/pages/login/，故回跳为 ../ + redirect；首页特例直接给根路径 */
function resolveRedirect(raw) {
    if (!raw || raw === 'index.html') return '../../../index.html';
    return '../' + raw;
}

function feedback(text, isErr) {
    feedbackLine.textContent = '> ' + text;
    feedbackLine.className = 'feedback-line' + (isErr ? ' err' : ' ok');
}

function syncModeUI() {
    var isLogin = mode === 'login';
    modeTag.textContent = isLogin ? 'LOGIN' : 'REGISTER';
    if (!busy) submitBtn.textContent = isLogin ? '» 进入系统' : '» 注册账号';
    usernameInput.placeholder = isLogin ? '用户名（2-20 字符）' : '新用户名（2-20 字符）';
    var btns = modeSelector.querySelectorAll('.mode-btn');
    for (var i = 0; i < btns.length; i++) {
        btns[i].classList.toggle('active', btns[i].dataset.mode === mode);
    }
}

function submit() {
    if (busy) return;
    var username = usernameInput.value.trim();
    var password = passwordInput.value;
    if (username.length < 2 || username.length > 20) {
        feedback('用户名需 2-20 字符', true);
        MPOSTOR.sound.play('error');
        return;
    }
    if (password.length < 4 || password.length > 32) {
        feedback('密码需 4-32 字符', true);
        MPOSTOR.sound.play('error');
        return;
    }

    busy = true;
    submitBtn.disabled = true;
    submitBtn.textContent = '验证中...';

    var path = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
    fetch(HTTP_URL + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username, password: password })
    })
    .then(function (r) { return r.json(); })
    .then(function (res) {
        if (res.code === 0) {
            MPOSTOR.sound.play('confirm');
            if (mode === 'register') {
                mode = 'login';
                syncModeUI();
                passwordInput.value = '';
                feedback('注册成功，请登录', false);
            } else {
                MPOSTOR.auth.save({ token: res.data.token, username: res.data.username });
                feedback('身份核验通过，正在进入系统...', false);
                setTimeout(function () { location.replace(REDIRECT); }, 450);
            }
        } else {
            feedback(res.message || '操作失败', true);
            MPOSTOR.sound.play('error');
            usernameInput.classList.add('input-error');
            setTimeout(function () { usernameInput.classList.remove('input-error'); }, 400);
        }
    })
    .catch(function () {
        feedback('网络异常，请确认后端已启动（:8080）', true);
        MPOSTOR.sound.play('error');
    })
    .then(function () {
        busy = false;
        submitBtn.disabled = false;
        syncModeUI();
    });
}

document.addEventListener('DOMContentLoaded', function () {
    // 已登录：直接回跳
    if (MPOSTOR.auth.get()) {
        feedback('已登录，正在进入系统...', false);
        setTimeout(function () { location.replace(REDIRECT); }, 300);
        return;
    }

    var btns = modeSelector.querySelectorAll('.mode-btn');
    for (var i = 0; i < btns.length; i++) {
        (function (btn) {
            btn.addEventListener('click', function () {
                mode = btn.dataset.mode;
                syncModeUI();
                feedback(mode === 'login' ? '输入凭证后回车或点击提交' : '新账号注册后需登录', false);
            });
        })(btns[i]);
    }

    submitBtn.addEventListener('click', submit);
    usernameInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
    passwordInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
    setTimeout(function () { usernameInput.focus(); }, 300);
});
