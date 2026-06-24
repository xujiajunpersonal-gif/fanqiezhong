// ===== 颜色与标签配置 =====
const COLORS = { work: '#ff6b6b', short: '#51cf66', long: '#4dabf7' };
const LABELS = { work: '工作', short: '短休', long: '长休' };
const STATUS_TEXT = {
    idle:   '准备开始',
    work:   '专注中...',
    short:  '休息一下',
    long:   '好好休息',
    paused: '已暂停',
};

// ===== 状态 =====
let settings  = { work: 25, short: 5, long: 15 };
let mode      = 'work';
let timeLeft  = settings[mode] * 60;
let totalDuration = timeLeft;
let isRunning = false;
let timerId   = null;
let completedPomodoros = 0;
let audioCtx  = null;

// ===== DOM 引用 =====
const timeDisplay  = document.getElementById('time-display');
const timerStatus  = document.getElementById('timer-status');
const progressBar  = document.querySelector('.progress-bar');
const btnStart     = document.getElementById('btn-start');
const btnReset     = document.getElementById('btn-reset');
const btnSkip      = document.getElementById('btn-skip');
const timerEl      = document.getElementById('timer');
const countEl      = document.getElementById('count');
const modeTabs     = document.querySelectorAll('.mode-tab');
const inputs       = {
    work:  document.getElementById('set-work'),
    short: document.getElementById('set-short'),
    long:  document.getElementById('set-long'),
};

// 进度环参数
const RADIUS = 125;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// ===== 初始化 =====
function init() {
    loadState();
    syncInputsToSettings();
    setupProgressRing();
    updateColor();
    updateDisplay();
    updateCountDisplay();
}

// ===== 进度环初始化 =====
function setupProgressRing() {
    progressBar.style.strokeDasharray = `${CIRCUMFERENCE}`;
    progressBar.style.strokeDashoffset = '0';
}

// ===== 持久化 =====
function saveState() {
    const today = new Date().toDateString();
    const state = { date: today, count: completedPomodoros, settings };
    localStorage.setItem('pomodoro', JSON.stringify(state));
}

function loadState() {
    const raw = localStorage.getItem('pomodoro');
    if (!raw) return;
    try {
        const state = JSON.parse(raw);
        const today = new Date().toDateString();

        // 跨天则重置计数
        if (state.date === today && typeof state.count === 'number') {
            completedPomodoros = state.count;
        }

        // 恢复设置
        if (state.settings) {
            if (typeof state.settings.work  === 'number') settings.work  = state.settings.work;
            if (typeof state.settings.short === 'number') settings.short = state.settings.short;
            if (typeof state.settings.long  === 'number') settings.long  = state.settings.long;
        }
    } catch { /* 解析失败则忽略 */ }
}

function syncInputsToSettings() {
    inputs.work.value  = settings.work;
    inputs.short.value = settings.short;
    inputs.long.value  = settings.long;
}

// ===== 音频 =====
function getAudioCtx() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

function playSound() {
    try {
        const ctx = getAudioCtx();
        const now = ctx.currentTime;

        // 三连音，清脆悦耳
        [0, 0.18, 0.36].forEach((delay, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.frequency.value = i === 2 ? 1100 : 800;
            osc.type = 'sine';

            const t = now + delay;
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.25, t + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

            osc.start(t);
            osc.stop(t + 0.3);
        });
    } catch {
        // 音频播放失败静默处理
    }
}

// ===== 浏览器通知 =====
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

function sendNotification(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body, icon: '🍅', tag: 'pomodoro' });
    }
}

function flashTitle(message) {
    const original = document.title;
    let count = 0;
    const interval = setInterval(() => {
        document.title = count % 2 === 0 ? message : original;
        count++;
        if (count >= 6) {
            clearInterval(interval);
            document.title = original;
        }
    }, 700);
}

// ===== 工具函数 =====
function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function updateColor() {
    document.documentElement.style.setProperty('--color-current', COLORS[mode]);
}

function updateDisplay() {
    timeDisplay.textContent = formatTime(timeLeft);
    document.title = `${formatTime(timeLeft)} - 🍅 番茄钟`;

    const fraction = totalDuration > 0 ? timeLeft / totalDuration : 0;
    progressBar.style.strokeDashoffset = CIRCUMFERENCE * (1 - fraction);
}

function updateCountDisplay() {
    countEl.textContent = completedPomodoros;
}

function setModeTabsEnabled(enabled) {
    modeTabs.forEach(tab => {
        if (enabled) {
            tab.removeAttribute('disabled');
        } else {
            tab.setAttribute('disabled', '');
        }
    });
}

// ===== 计时核心 =====
function start() {
    if (isRunning) {
        pause();
        return;
    }

    // 如果计时已经结束，重新开始
    if (timeLeft <= 0) {
        timeLeft = settings[mode] * 60;
        totalDuration = timeLeft;
    }

    isRunning = true;
    btnStart.innerHTML = '<span class="btn-icon">⏸</span> 暂停';
    timerEl.classList.add('running');
    timerStatus.textContent = STATUS_TEXT[mode];
    setModeTabsEnabled(false);
    timerId = setInterval(tick, 1000);

    // 预热 AudioContext（利用用户点击手势）
    getAudioCtx();
    requestNotificationPermission();
}

function pause() {
    isRunning = false;
    clearInterval(timerId);
    btnStart.innerHTML = '<span class="btn-icon">▶</span> 继续';
    timerEl.classList.remove('running');
    timerStatus.textContent = STATUS_TEXT.paused;
}

function reset() {
    clearInterval(timerId);
    isRunning = false;
    timeLeft = settings[mode] * 60;
    totalDuration = timeLeft;
    btnStart.innerHTML = '<span class="btn-icon">▶</span> 开始';
    timerEl.classList.remove('running');
    timerStatus.textContent = STATUS_TEXT.idle;
    setModeTabsEnabled(true);
    updateDisplay();
}

function skip() {
    clearInterval(timerId);
    isRunning = false;
    timerEl.classList.remove('running');
    setModeTabsEnabled(true);
    btnStart.innerHTML = '<span class="btn-icon">▶</span> 开始';
    timerStatus.textContent = STATUS_TEXT.idle;

    if (mode === 'work') {
        // 跳过工作 → 进入休息（不累计番茄）
        const next = (completedPomodoros > 0 && completedPomodoros % 4 === 0) ? 'long' : 'short';
        switchMode(next);
    } else {
        // 跳过休息 → 回到工作
        switchMode('work');
    }
}

function tick() {
    timeLeft--;
    updateDisplay();

    if (timeLeft <= 0) {
        clearInterval(timerId);
        isRunning = false;
        onComplete();
    }
}

function switchMode(newMode) {
    clearInterval(timerId);
    isRunning = false;
    mode = newMode;
    timeLeft = settings[mode] * 60;
    totalDuration = timeLeft;

    btnStart.innerHTML = '<span class="btn-icon">▶</span> 开始';
    timerEl.classList.remove('running');
    timerStatus.textContent = STATUS_TEXT.idle;
    setModeTabsEnabled(true);

    modeTabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.mode === mode);
    });

    updateColor();
    updateDisplay();
}

function onComplete() {
    // 音效
    playSound();

    // 通知 + 标题闪烁
    const title = mode === 'work' ? '🍅 工作完成！' : '⏰ 休息结束！';
    const body  = mode === 'work' ? '太棒了，休息一下吧～' : '准备开始新的番茄钟！';
    sendNotification(title, body);
    flashTitle(title);

    // 完成动画
    timerEl.classList.add('complete');
    setTimeout(() => timerEl.classList.remove('complete'), 550);

    if (mode === 'work') {
        // 累计番茄
        completedPomodoros++;
        updateCountDisplay();
        saveState();

        // 数字弹跳动画
        countEl.classList.remove('bump');
        void countEl.offsetWidth; // 强制回流以重新触发动画
        countEl.classList.add('bump');

        const nextMode = (completedPomodoros % 4 === 0) ? 'long' : 'short';
        switchMode(nextMode);
    } else {
        switchMode('work');
    }
}

// ===== 时间设置变更 =====
function updateSettings() {
    for (const key of ['work', 'short', 'long']) {
        const val = parseInt(inputs[key].value, 10);
        if (!isNaN(val) && val > 0) {
            const max = key === 'work' ? 120 : 60;
            settings[key] = Math.min(val, max);
            inputs[key].value = settings[key];
        } else {
            // 无效输入则回退到当前有效值
            inputs[key].value = settings[key];
        }
    }

    // 未运行则同步更新显示
    if (!isRunning) {
        timeLeft = settings[mode] * 60;
        totalDuration = timeLeft;
        updateDisplay();
    }

    saveState();
}

// ===== 事件绑定 =====
btnStart.addEventListener('click', start);
btnReset.addEventListener('click', reset);
btnSkip.addEventListener('click', skip);

modeTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        if (!tab.disabled) switchMode(tab.dataset.mode);
    });
});

// 点击圆环开始 / 暂停
timerEl.addEventListener('click', (e) => {
    // 防止点到 SVG 或内部文字时重复触发
    if (e.target === timerEl || e.target.closest('.time-display, .timer-status, .progress-ring')) {
        start();
    }
});

// 时间输入变更
Object.values(inputs).forEach(input => {
    input.addEventListener('change', updateSettings);
    input.addEventListener('input', updateSettings);
});

// 键盘快捷键
document.addEventListener('keydown', (e) => {
    // 如果焦点在输入框中则不处理
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    switch (e.code) {
        case 'Space':
            e.preventDefault();
            start();
            break;
        case 'KeyR':
            e.preventDefault();
            reset();
            break;
        case 'KeyS':
            e.preventDefault();
            skip();
            break;
    }
});

// 页面可见性变化时停止标题闪烁（用户切回标签页）
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !isRunning) {
        document.title = '🍅 番茄钟';
    }
});

// ===== 启动 =====
init();
