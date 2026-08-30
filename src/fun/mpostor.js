/* ============================================================
   MPOSTOR FUN MODULE
   音效 · 特效 · 彩蛋 · 成就 —— 工业终端趣味系统
   挂载 window.MPOSTOR
   ============================================================ */
(function () {
    'use strict';

    var LS_SOUND = 'mpostor_muted';
    var LS_STATS = 'mpostor_stats';
    var LS_ACCOUNT = 'mpostor_account';

    /* ==========================================================
       1. SOUND —— WebAudio 合成机械音效
       ========================================================== */
    var Sound = (function () {
        var ctx = null;
        var muted = localStorage.getItem(LS_SOUND) === '1';

        function ensureCtx() {
            if (!ctx) {
                try {
                    var AC = window.AudioContext || window.webkitAudioContext;
                    if (!AC) return null;
                    ctx = new AC();
                } catch (e) { return null; }
            }
            if (ctx.state === 'suspended') ctx.resume();
            return ctx;
        }

        // 首次用户交互时解锁 AudioContext
        function unlock() {
            ensureCtx();
        }

        function tone(freq, dur, type, vol, delay, slideTo) {
            if (muted) return;
            var c = ensureCtx();
            if (!c) return;
            try {
                var t0 = c.currentTime + (delay || 0);
                var osc = c.createOscillator();
                var gain = c.createGain();
                osc.type = type || 'square';
                osc.frequency.setValueAtTime(freq, t0);
                if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
                gain.gain.setValueAtTime(vol || 0.08, t0);
                gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
                osc.connect(gain);
                gain.connect(c.destination);
                osc.start(t0);
                osc.stop(t0 + dur + 0.02);
            } catch (e) { /* 音频不可用时静默 */ }
        }

        function noise(dur, vol, delay) {
            if (muted) return;
            var c = ensureCtx();
            if (!c) return;
            try {
                var t0 = c.currentTime + (delay || 0);
                var len = Math.max(1, Math.floor(c.sampleRate * dur));
                var buf = c.createBuffer(1, len, c.sampleRate);
                var data = buf.getChannelData(0);
                for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
                var src = c.createBufferSource();
                src.buffer = buf;
                var gain = c.createGain();
                gain.gain.setValueAtTime(vol || 0.05, t0);
                gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
                src.connect(gain);
                gain.connect(c.destination);
                src.start(t0);
            } catch (e) { }
        }

        var sounds = {
            tick:      function () { tone(1400, 0.04, 'square', 0.05); },
            click:     function () { tone(900, 0.05, 'square', 0.05); },
            type:      function () { noise(0.015, 0.02); },
            beep:      function () { tone(880, 0.09, 'sine', 0.08); },
            confirm:   function () { tone(660, 0.07, 'square', 0.07); tone(990, 0.1, 'square', 0.07, 0.08); },
            error:     function () { tone(140, 0.22, 'square', 0.09); },
            buzz:      function () { tone(150, 0.25, 'sawtooth', 0.09); },
            chirp:     function () { tone(700, 0.06, 'square', 0.07); tone(1400, 0.1, 'square', 0.07, 0.07); },
            alarm:     function () {
                tone(480, 0.35, 'triangle', 0.09, 0, 900);
                tone(480, 0.35, 'triangle', 0.09, 0.4, 900);
                tone(480, 0.35, 'triangle', 0.09, 0.8, 900);
            },
            powerdown: function () { tone(1100, 0.9, 'sawtooth', 0.12, 0, 70); noise(0.35, 0.06, 0.1); },
            boot:      function () { tone(55, 0.7, 'sine', 0.14, 0, 240); tone(880, 0.06, 'square', 0.06, 0.72); },
            victory:   function () {
                var seq = [523, 659, 784, 1047];
                for (var i = 0; i < seq.length; i++) tone(seq[i], 0.16, 'square', 0.08, i * 0.14);
                tone(1568, 0.4, 'square', 0.07, seq.length * 0.14);
            },
            defeat:    function () {
                var seq = [392, 330, 262, 196];
                for (var i = 0; i < seq.length; i++) tone(seq[i], 0.2, 'square', 0.07, i * 0.18);
            },
            secret:    function () { tone(1200, 0.5, 'sine', 0.06, 0, 2400); tone(2400, 0.5, 'sine', 0.04, 0.55, 600); },
            achievement: function () { tone(880, 0.08, 'square', 0.07); tone(1174, 0.08, 'square', 0.07, 0.09); tone(1760, 0.25, 'square', 0.08, 0.18); }
        };

        return {
            play: function (name) { if (sounds[name]) sounds[name](); },
            unlock: unlock,
            isMuted: function () { return muted; },
            toggleMute: function () {
                muted = !muted;
                localStorage.setItem(LS_SOUND, muted ? '1' : '0');
                if (!muted) sounds.confirm();
                return muted;
            }
        };
    })();

    /* ==========================================================
       2. EFFECTS —— CRT 特效
       ========================================================== */
    var Effects = {
        /* 开机自检序列 */
        boot: function (onDone) {
            if (document.querySelector('.boot-overlay')) { if (onDone) onDone(); return; }
            var overlay = document.createElement('div');
            overlay.className = 'boot-overlay';
            var screen = document.createElement('div');
            screen.className = 'boot-screen';
            overlay.appendChild(screen);
            document.body.appendChild(overlay);

            var lines = [
                { t: 'MPOSTOR SYSTEM v2.1', dim: false },
                { t: '> PHOSPHOR GUN ............ ARMED', dim: true },
                { t: '> MEMORY 64K .............. OK', dim: true },
                { t: '> IMPOSTOR MODULE ......... LOADED', dim: true },
                { t: '> LINK ws://localhost:8080/ws/game ...', dim: true },
                { t: '> SCANLINE FILTER ......... ONLINE', dim: true },
                { t: '>> SYSTEM ONLINE // WELCOME, HUMAN', dim: false }
            ];

            var i = 0;
            Sound.play('boot');
            function next() {
                if (i >= lines.length) {
                    setTimeout(function () {
                        overlay.classList.add('done');
                        setTimeout(function () { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 600);
                        if (onDone) onDone();
                    }, 450);
                    return;
                }
                var line = lines[i++];
                var div = document.createElement('div');
                div.className = 'boot-line' + (line.dim ? ' dim' : '');
                screen.appendChild(div);
                var chars = line.t;
                var n = 0;
                function typeChar() {
                    if (n < chars.length) {
                        div.textContent = chars.substring(0, ++n);
                        if (chars[n - 1] !== ' ') Sound.play('type');
                        setTimeout(typeChar, 12);
                    } else {
                        setTimeout(next, line.dim ? 120 : 380);
                    }
                }
                typeChar();
            }
            next();
        },

        /* 全屏故障爆发 */
        glitch: function (duration) {
            var el = document.querySelector('.glitch-overlay');
            if (!el) {
                el = document.createElement('div');
                el.className = 'glitch-overlay';
                document.body.appendChild(el);
            }
            el.classList.add('active');
            Sound.play('error');
            setTimeout(function () {
                el.classList.remove('active');
                if (el._pendingRemove) { el._pendingRemove = false; }
            }, duration || 600);
        },

        /* 打字机 */
        typewriter: function (el, text, speed, onDone) {
            if (!el) return;
            el.textContent = '';
            el.classList.add('typewriter');
            var n = 0;
            function step() {
                if (n < text.length) {
                    el.textContent = text.substring(0, ++n);
                    setTimeout(step, speed || 40);
                } else if (onDone) {
                    onDone();
                }
            }
            step();
        },

        /* 危险条纹闪烁 */
        hazardFlash: function (el, times) {
            if (!el) return;
            var count = times || 3;
            var n = 0;
            var timer = setInterval(function () {
                el.style.visibility = (++n % 2 === 0) ? 'hidden' : 'visible';
                if (n >= count * 2) {
                    clearInterval(timer);
                    el.style.visibility = 'visible';
                }
            }, 140);
        },

        /* 开局部署过渡：等待 → 进入游戏的工业风遮罩 */
        deployTransition: function (label, onDone) {
            if (document.querySelector('.deploy-overlay')) { if (onDone) onDone(); return; }
            var overlay = document.createElement('div');
            overlay.className = 'deploy-overlay';
            overlay.innerHTML =
                '<div class="deploy-stripe top"></div>' +
                '<div class="deploy-screen">' +
                    '<div class="deploy-title">DEPLOY</div>' +
                    '<div class="deploy-label">' + (label || 'MISSION START') + '</div>' +
                    '<div class="deploy-lines"></div>' +
                '</div>' +
                '<div class="deploy-stripe bottom"></div>';
            document.body.appendChild(overlay);

            var lines = [
                { t: '> DEPLOYING OPERATIVES ........', dim: true },
                { t: '> SYNCING ROUND CLOCK .........', dim: true },
                { t: '> ARMING GAME MODULES .........', dim: true },
                { t: '>> MISSION START // GOOD LUCK', dim: false }
            ];
            var box = overlay.querySelector('.deploy-lines');

            Sound.play('boot');
            var i = 0;
            function next() {
                if (i >= lines.length) {
                    setTimeout(function () {
                        Sound.play('confirm');
                        overlay.classList.add('done');
                        setTimeout(function () {
                            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                            if (onDone) onDone();
                        }, 500);
                    }, 320);
                    return;
                }
                var line = lines[i++];
                var div = document.createElement('div');
                div.className = 'deploy-line' + (line.dim ? ' dim' : '');
                box.appendChild(div);
                var chars = line.t;
                var n = 0;
                function typeChar() {
                    if (n < chars.length) {
                        div.textContent = chars.substring(0, ++n);
                        if (chars[n - 1] !== ' ') Sound.play('type');
                        setTimeout(typeChar, 10);
                    } else {
                        setTimeout(next, line.dim ? 110 : 300);
                    }
                }
                typeChar();
            }
            next();
        }
    };

    /* ==========================================================
       2.5 AUTH —— 全局账号（token 存 localStorage）
       ========================================================== */
    var Auth = {
        get: function () {
            try {
                var a = JSON.parse(localStorage.getItem(LS_ACCOUNT));
                return (a && a.token && a.username) ? a : null;
            } catch (e) { return null; }
        },
        save: function (acc) {
            try { localStorage.setItem(LS_ACCOUNT, JSON.stringify(acc)); } catch (e) { }
        },
        clear: function () {
            localStorage.removeItem(LS_ACCOUNT);
        },
        username: function () {
            var a = this.get();
            return a ? a.username : null;
        },
        token: function () {
            var a = this.get();
            return a ? a.token : null;
        },
        /* 未登录 → 跳登录页，登录成功后回跳本页（含 ?roomId= 等参数） */
        require: function () {
            if (this.get()) return true;
            var path = location.pathname;
            var idx = path.indexOf('/src/');
            var back = idx >= 0 ? path.substring(idx + 5) + location.search : 'index.html';
            location.replace('/src/pages/login/index.html?redirect=' + encodeURIComponent(back));
            return false;
        },
        logout: function () {
            this.clear();
        }
    };

    /* ==========================================================
       2.6 VOICE —— TTS 播报 + 语音输入（Web Speech API）
       ========================================================== */
    var Voice = (function () {
        var unlocked = false;
        var queue = [];

        function speakNow(text, opts) {
            try {
                window.speechSynthesis.cancel();
                var u = new SpeechSynthesisUtterance(text);
                u.lang = (opts && opts.lang) || 'zh-CN';
                u.rate = (opts && opts.rate) || 1;
                u.pitch = (opts && opts.pitch) || 1;
                var vs = window.speechSynthesis.getVoices();
                for (var i = 0; i < vs.length; i++) {
                    if (vs[i].lang && vs[i].lang.indexOf('zh') === 0) { u.voice = vs[i]; break; }
                }
                window.speechSynthesis.speak(u);
                return u;
            } catch (e) { return null; }
        }

        /* 首次用户交互解锁（浏览器可能吞掉无手势的 speak） */
        document.addEventListener('pointerdown', function () {
            if (unlocked) return;
            unlocked = true;
            while (queue.length) {
                var item = queue.shift();
                speakNow(item[0], item[1]);
            }
        }, { passive: true });

        function speak(text, opts) {
            if (!text) return null;
            if (Sound.isMuted()) return null;               // 静音联动
            if (!('speechSynthesis' in window)) return null;
            if (!unlocked) { queue.push([text, opts]); return null; }
            return speakNow(text, opts);
        }

        function listen(onResult) {
            var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SR) return null;
            try {
                var rec = new SR();
                rec.lang = 'zh-CN';
                rec.interimResults = false;
                rec.maxAlternatives = 1;
                var done = false;
                var finish = function (txt) {
                    if (done) return;
                    done = true;
                    if (onResult) onResult(txt);
                };
                rec.onresult = function (ev) {
                    var txt = '';
                    if (ev.results && ev.results.length && ev.results[0].length) {
                        txt = ev.results[0][0].transcript;
                    }
                    finish(txt);
                };
                rec.onerror = function () { finish(null); };
                rec.onend = function () { finish(null); };
                rec.start();
                return rec;
            } catch (e) { return null; }
        }

        /* 给输入框挂麦克风按钮：自动找同容器内 .mic-btn，不支持则隐藏 */
        function attachMic(inputEl, onResult) {
            if (!inputEl) return null;
            var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
            var btn = null;
            var p = inputEl.parentElement;
            for (var i = 0; i < 3 && p; i++) {
                btn = p.querySelector('.mic-btn');
                if (btn) break;
                p = p.parentElement;
            }
            if (!btn) return null;
            if (!SR) { btn.style.display = 'none'; return null; }
            btn.addEventListener('click', function () {
                if (btn.classList.contains('listening')) {
                    try { if (btn._rec) btn._rec.stop(); } catch (e) { }
                    return;
                }
                var rec = listen(function (txt) {
                    btn.classList.remove('listening');
                    btn._rec = null;
                    if (txt) {
                        inputEl.value = txt;
                        if (onResult) onResult(txt);
                    }
                });
                if (rec) {
                    btn._rec = rec;
                    btn.classList.add('listening');
                    Sound.play('beep');
                }
            });
            return btn;
        }

        return {
            supported: function () { return 'speechSynthesis' in window; },
            speak: speak,
            listen: listen,
            attachMic: attachMic
        };
    })();

    /* ==========================================================
       3. STATS + ACHIEVEMENTS —— 战绩与成就
       ========================================================== */
    var ACHIEVEMENTS = [
        { id: 'first_boot',      name: '首次通电',   desc: '启动 MPOSTOR 系统', icon: '■' },
        { id: 'first_game',      name: '初入战场',   desc: '完成第一局谁是卧底', icon: '◆' },
        { id: 'civilian_hunter', name: '卧底猎人',   desc: '以平民身份获胜', icon: '◎' },
        { id: 'perfect_hide',    name: '完美潜伏',   desc: '以卧底身份获胜', icon: '◈' },
        { id: 'survivor',        name: '幸存者',     desc: '整局未被淘汰并获胜', icon: '▣' },
        { id: 'terminator',      name: '终结者',     desc: '亲手投票淘汰卧底', icon: '☒' },
        { id: 'chatterbox',      name: '话痨',       desc: '累计发言 20 次', icon: '»' },
        { id: 'voter',           name: '投票狂',     desc: '累计投票 20 次', icon: '✗' },
        { id: 'host',            name: '房主',       desc: '创建第一个房间', icon: '⌂' },
        { id: 'social',          name: '社交达人',   desc: '加入其他玩家的房间', icon: '⇄' },
        { id: 'guess_master',    name: '猜词大师',   desc: '3 次以内猜出目标词', icon: '?' },
        { id: 'guess_perfect',   name: '完美命中',   desc: '第一次就猜中目标词', icon: '!' },
        { id: 'turtle_solver',   name: '汤底侦探',   desc: '猜中一次海龟汤汤底', icon: '◍' },
        { id: 'quiz_perfect',    name: '全知者',     desc: '趣味问答全部答对', icon: '✓' },
        { id: 'bomb_survivor',   name: '拆弹专家',   desc: '成功拆除一颗炸弹', icon: '✂' },
        { id: 'idiom_chain',     name: '成语大师',   desc: '成语接龙连对 5 次', icon: '→' },
        { id: 'konami_believer', name: 'KONAMI 信徒', desc: '输入经典秘技', icon: '↑' },
        { id: 'archaeologist',   name: '考古学家',   desc: '在隐藏终端输入指令', icon: '#' },
        { id: 'logo_clicker',    name: '执着的信徒', desc: '连点 LOGO 5 次', icon: '◇' }
    ];

    var Stats = {
        _cache: null,
        _cacheKey: null,
        /* 战绩按账号隔离：mpostor_stats_<username>，未登录用 guest */
        _key: function () {
            var a = Auth.get();
            return LS_STATS + '_' + (a ? a.username : 'guest');
        },
        load: function () {
            var k = this._key();
            if (this._cache && this._cacheKey === k) return this._cache;
            try {
                this._cache = JSON.parse(localStorage.getItem(k)) || {};
            } catch (e) { this._cache = {}; }
            if (!this._cache.achievements) this._cache.achievements = {};
            this._cacheKey = k;
            return this._cache;
        },
        save: function () {
            try { localStorage.setItem(this._key(), JSON.stringify(this.load())); } catch (e) { }
        },
        add: function (field, n) {
            var s = this.load();
            s[field] = (s[field] || 0) + (n || 1);
            this.save();
        },
        get: function (field) {
            return this.load()[field] || 0;
        },
        /* 渲染统计面板（若页面存在 #statsPanel） */
        renderPanel: function () {
            var el = document.getElementById('statsPanel');
            if (!el) return;
            var s = this.load();
            var unlocked = Object.keys(s.achievements).length;
            el.innerHTML =
                '<div class="panel-header"><span class="panel-title">Operation Record</span>' +
                '<span class="tag">' + unlocked + '/' + ACHIEVEMENTS.length + ' ACHIEVED</span></div>' +
                '<div class="stats-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">' +
                statCell('局数', s.gamesPlayed || 0) +
                statCell('胜利', s.wins || 0) +
                statCell('发言', s.speaks || 0) +
                statCell('投票', s.votes || 0) +
                statCell('淘汰', s.eliminations || 0) +
                statCell('猜词胜', s.guessWins || 0) +
                '</div>';
            function statCell(label, val) {
                return '<div style="border:1px solid var(--line);background:var(--panel-2);padding:8px;text-align:center;">' +
                    '<div style="font-family:var(--mono);font-size:18px;color:var(--green);text-shadow:var(--glow);">' + val + '</div>' +
                    '<div style="font-size:11px;color:var(--text-dim);letter-spacing:.1em;">' + label + '</div></div>';
            }
            Ach.renderPanel();   // 成就栏与统计面板同步刷新
        }
    };

    var Ach = {
        /* 渲染成就栏（若页面存在 #achPanel）：未解锁灰暗 LOCKED，已解锁绿色+解锁日期 */
        renderPanel: function () {
            var el = document.getElementById('achPanel');
            if (!el) return;
            var s = Stats.load();
            var unlockedCount = Object.keys(s.achievements).length;
            var html =
                '<div class="panel-header"><span class="panel-title">Achievement Wall</span>' +
                '<span class="tag">' + unlockedCount + '/' + ACHIEVEMENTS.length + ' UNLOCKED</span></div>' +
                '<div class="ach-grid">';
            for (var i = 0; i < ACHIEVEMENTS.length; i++) {
                var def = ACHIEVEMENTS[i];
                var t = s.achievements[def.id];
                html += '<div class="ach-cell' + (t ? ' unlocked' : ' locked') + '" title="' + def.desc + '">' +
                    '<span class="ach-icon">' + def.icon + '</span>' +
                    '<span class="ach-name">' + def.name + '</span>' +
                    '<span class="ach-state">' + (t ? '✓ ' + new Date(t).toISOString().slice(0, 10) : 'LOCKED') + '</span>' +
                    '</div>';
            }
            el.innerHTML = html + '</div>';
        },
        unlock: function (id) {
            var def = null;
            for (var i = 0; i < ACHIEVEMENTS.length; i++) {
                if (ACHIEVEMENTS[i].id === id) { def = ACHIEVEMENTS[i]; break; }
            }
            if (!def) return;
            var s = Stats.load();
            if (s.achievements[id]) return;   // 已解锁
            s.achievements[id] = Date.now();
            Stats.save();
            Sound.play('achievement');
            toast(def);
            this.renderPanel();   // 成就栏即时刷新
        },
        unlocked: function (id) {
            var s = Stats.load();
            return !!s.achievements[id];
        }
    };

    function toast(def) {
        var el = document.createElement('div');
        el.className = 'ach-toast';
        el.innerHTML =
            '<div class="ach-stamp">Achievement Unlocked</div>' +
            '<div class="ach-body">' +
            '  <div class="ach-name">' + def.icon + ' ' + def.name + '</div>' +
            '  <div class="ach-desc">' + def.desc + '</div>' +
            '</div>' +
            '<div class="ach-scan"></div>';
        document.body.appendChild(el);
        setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 5100);
    }

    /* ==========================================================
       4. EASTER EGGS —— 彩蛋与隐藏指令
       ========================================================== */
    var EasterEggs = {
        konamiSeq: ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'],
        _pos: 0,
        _logoClicks: 0,
        _logoTimer: null,

        init: function () {
            var self = this;
            document.addEventListener('keydown', function (e) {
                self._onKey(e);
            });
            document.addEventListener('click', function (e) {
                var logo = e.target.closest('[data-mpostor-logo]');
                if (logo) self._onLogoClick();
            });
            this._initTerminal();
        },

        _onKey: function (e) {
            var expect = this.konamiSeq[this._pos];
            if (e.key === expect) {
                this._pos++;
                if (this._pos === this.konamiSeq.length) {
                    this._pos = 0;
                    this.fireKonami();
                }
            } else if (e.key === this.konamiSeq[0]) {
                this._pos = 1;
            } else {
                this._pos = 0;
            }
        },

        fireKonami: function () {
            Effects.glitch(900);
            Sound.play('secret');
            setTimeout(function () { Effects.glitch(700); }, 450);
            setTimeout(function () { Effects.glitch(600); }, 1000);
            Ach.unlock('konami_believer');
            showAsciiModal(
                'SECRET CODE ACCEPTED',
                '╔══════════════════════════╗\n' +
                '║   ^^vv<><>BA             ║\n' +
                '╚══════════════════════════╝\n' +
                '\nIMPOSSIBLE MODE: NOT FOUND\n' +
                '你什么都没得到，除了这个成就。'
            );
        },

        _onLogoClick: function () {
            this._logoClicks++;
            if (this._logoTimer) clearTimeout(this._logoTimer);
            var self = this;
            this._logoTimer = setTimeout(function () { self._logoClicks = 0; }, 2500);
            if (this._logoClicks >= 5) {
                this._logoClicks = 0;
                clearTimeout(this._logoTimer);
                Sound.play('secret');
                Effects.boot();
                Ach.unlock('logo_clicker');
            }
        },

        /* 隐藏终端（首页页脚） */
        _initTerminal: function () {
            var term = document.getElementById('hiddenTerminal');
            if (!term) return;
            var input = term.querySelector('.term-input');
            var output = term.querySelector('.term-output');
            if (!input || !output) return;

            function print(text, cls) {
                var div = document.createElement('div');
                div.className = 'term-line' + (cls ? ' ' + cls : '');
                div.innerHTML = text;
                output.appendChild(div);
                output.scrollTop = output.scrollHeight;
            }

            var commands = {
                help: function () {
                    print('可用指令: <span style="color:var(--green)">help whoami impostor mpostor status ach 42 coffee sudo&nbsp;rm&nbsp;-rf&nbsp;/</span>');
                },
                ach: function () {
                    // 定位到成就栏：滚动 + 故障闪烁提示
                    var panel = document.getElementById('achPanel');
                    print('成就档案：' + Object.keys(Stats.load().achievements || {}).length + '/' + ACHIEVEMENTS.length + ' 已解锁', 'ok');
                    if (panel) {
                        panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        Effects.glitch(500);
                        Sound.play('confirm');
                        setTimeout(function () { Effects.hazardFlash(panel.querySelector('.panel-header .tag'), 3); }, 550);
                    } else {
                        print('本页无成就栏，回首页查看。', 'err');
                    }
                },
                whoami: function () {
                    var role = Math.random() < 0.5 ? '卧底' : '平民';
                    print('身份: ' + role + '（大概）');
                    if (role === '卧底') { Sound.play('secret'); print('嘘……别告诉别人。', 'err'); }
                },
                impostor: function () {
                    print('IMP OSTOR MODE: ON — 主题反转 5 秒', 'ok');
                    Sound.play('secret');
                    document.body.classList.add('inverted');
                    setTimeout(function () { document.body.classList.remove('inverted'); }, 5000);
                },
                mpostor: function () {
                    Sound.play('confirm');
                    print('<pre style="color:var(--green);line-height:1.3">' +
                        ' ███╗ ██╗██████╗  ██████╗ ███████╗████████╗ ██████╗ ██████╗\n' +
                        ' ████║ ██║██╔══██╗██╔═══██╗██╔════╝╚══██╔══╝██╔═══██╗██╔══██╗\n' +
                        ' ██╔██║ ██║██████╔╝██║   ██║███████╗   ██║   ██║   ██║██████╔╝\n' +
                        ' ██║╚██╗██║██╔═══╝ ██║   ██║╚════██║   ██║   ██║   ██║██╔══██╗\n' +
                        ' ██║ ╚████║██║     ╚██████╔╝███████║   ██║   ╚██████╔╝██║  ██║\n' +
                        ' ╚═╝  ╚═══╝╚═╝      ╚═════╝ ╚══════╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝</pre>', 'ok');
                },
                status: function () {
                    var s = Stats.load();
                    print('局数: ' + (s.gamesPlayed || 0) + ' | 胜利: ' + (s.wins || 0) +
                          ' | 发言: ' + (s.speaks || 0) + ' | 投票: ' + (s.votes || 0) +
                          ' | 成就: ' + Object.keys(s.achievements || {}).length + '/' + ACHIEVEMENTS.length);
                },
                '42': function () {
                    print('生命、宇宙以及一切问题的答案。', 'ok');
                    print('但谁是卧底，仍无人知晓。');
                },
                coffee: function () {
                    print('注入咖啡因…… 能量 +100', 'ok');
                    print('警惕心 +50 // 手抖 +10');
                    Sound.play('beep');
                },
                'sudo rm -rf /': function () {
                    print('正在删除系统文件... 5%', 'err');
                    print('正在删除系统文件... 42%', 'err');
                    print('正在删除系统文件... 99%', 'err');
                    Sound.play('error');
                    setTimeout(function () {
                        print('开玩笑的。你差点把自己删了。', 'ok');
                    }, 700);
                },
                konami: function () {
                    EasterEggs.fireKonami();
                }
            };

            input.addEventListener('keydown', function (e) {
                if (e.key !== 'Enter') return;
                var cmd = input.value.trim();
                input.value = '';
                print('<span class="term-prompt">&gt;</span> ' + cmd);
                if (cmd) {
                    Ach.unlock('archaeologist');
                    Sound.play('tick');
                    if (commands[cmd]) commands[cmd]();
                    else print('COMMAND NOT FOUND: ' + cmd + ' // 输入 help 查看可用指令', 'err');
                }
            });
        }
    };

    function showAsciiModal(title, body) {
        var overlay = document.createElement('div');
        overlay.className = 'modal-overlay active';
        overlay.innerHTML =
            '<div class="modal">' +
            '  <div class="panel-header"><span class="panel-title">' + title + '</span></div>' +
            '  <pre style="font-family:var(--mono);font-size:12px;color:var(--green);text-shadow:var(--glow);overflow:auto;">' + body + '</pre>' +
            '  <div style="margin-top:12px;text-align:right;"><button class="btn btn-sm">关闭</button></div>' +
            '</div>';
        document.body.appendChild(overlay);
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay || e.target.closest('.btn')) {
                if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            }
        });
    }

    /* ==========================================================
       5. INIT —— 页面统一初始化
       ========================================================== */
    function init() {
        // 首次交互解锁音频
        ['pointerdown', 'keydown', 'touchstart'].forEach(function (evt) {
            document.addEventListener(evt, Sound.unlock, { once: true, passive: true });
        });

        // 全局按钮点击音
        document.addEventListener('click', function (e) {
            var btn = e.target.closest('button, .btn');
            if (btn && !btn.disabled) Sound.play('tick');
        });

        EasterEggs.init();

        // 旧版统一战绩一次性迁移到 guest 账号
        try {
            if (!localStorage.getItem(LS_STATS + '_guest') && localStorage.getItem(LS_STATS)) {
                localStorage.setItem(LS_STATS + '_guest', localStorage.getItem(LS_STATS));
            }
        } catch (e) { }

        // 开机自检（body 可加 data-mpostor-boot="off" 关闭）
        if (document.body.getAttribute('data-mpostor-boot') !== 'off') {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', function () { Effects.boot(); });
            } else {
                Effects.boot();
            }
        }

        // 首次通电成就 + 统计面板
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function () {
                Ach.unlock('first_boot');
                Stats.renderPanel();
            });
        } else {
            Ach.unlock('first_boot');
            Stats.renderPanel();
        }
    }

    /* ==========================================================
       EXPORT
       ========================================================== */
    window.MPOSTOR = {
        sound: Sound,
        fx: Effects,
        stats: Stats,
        ach: Ach,
        auth: Auth,
        voice: Voice,
        eggs: EasterEggs,
        init: init,
        VERSION: 'v2.1'
    };

    // 自动初始化（页面引脚本即生效）
    init();
})();
