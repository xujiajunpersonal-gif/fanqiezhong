// ===== 配置 =====
const COLORS = {
    work: '#e74c3c',
    short: '#27ae60',
    long: '#3498db'
};
const LABELS = { work: '工作', short: '短休', long: '长休' };

// ===== 状态 =====
let settings = { work: 10, short: 5, long: 15 };
let mode = 'work';
let timeLeft = settings[mode] * 60;
let totalDuration = timeLeft;
let isRunning = false;
let timerId = null;
let completedPomodoros = 0;

// ===== DOM =====
const timeDisplay = document.getElementById('time-display');
const progressBar = document.querySelector('.progress-bar');
const btnStart = document.getElementById('btn-start');
const btnReset = document.getElementById('btn-reset');
const timerEl = document.getElementById('timer');
const countEl = document.getElementById('count');
const modeTabs = document.querySelectorAll('.mode-tab');
const inputs = {
    work: document.getElementById('set-work'),
    short: document.getElementById('set-short'),
    long: document.getElementById('set-long')
};

// 圆环周长
const RADIUS = 120;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
progressBar.style.strokeDasharray = CIRCUMFERENCE;
progressBar.style.strokeDashoffset = 0;

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
    const progress = totalDuration > 0 ? timeLeft / totalDuration : 0;
    progressBar.style.strokeDashoffset = CIRCUMFERENCE * (1 - progress);
}

// ===== 计时核心 =====
function start() {
    if (isRunning) {
        pause();
        return;
    }
    isRunning = true;
    btnStart.textContent = '暂停';
    timerId = setInterval(tick, 1000);
}

function pause() {
    isRunning = false;
    btnStart.textContent = '继续';
    clearInterval(timerId);
}

function reset() {
    clearInterval(timerId);
    isRunning = false;
    btnStart.textContent = '开始';
    timeLeft = settings[mode] * 60;
    totalDuration = timeLeft;
    updateDisplay();
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
    btnStart.textContent = '开始';

    // 更新标签状态
    modeTabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.mode === mode);
    });
    updateColor();
    updateDisplay();
}

function onComplete() {
    playSound();

    if (mode === 'work') {
        completedPomodoros++;
        countEl.textContent = completedPomodoros;
        // 每4个番茄进入长休
        const nextMode = (completedPomodoros % 4 === 0) ? 'long' : 'short';
        switchMode(nextMode);
    } else {
        // 休息结束回到工作
        switchMode('work');
    }
}

// ===== 声音提醒 =====
function playSound() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.3, 0.6].forEach(delay => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0, ctx.currentTime + delay);
        gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + delay + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.25);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.25);
    });
}

// ===== 时间设置 =====
function updateSettings() {
    for (const key of ['work', 'short', 'long']) {
        const val = parseInt(inputs[key].value, 10);
        if (val && val > 0) {
            settings[key] = val;
        }
    }
    // 如果当前未运行，同步更新显示
    if (!isRunning) {
        timeLeft = settings[mode] * 60;
        totalDuration = timeLeft;
        updateDisplay();
    }
}

// ===== 事件绑定 =====
btnStart.addEventListener('click', start);
btnReset.addEventListener('click', reset);

modeTabs.forEach(tab => {
    tab.addEventListener('click', () => switchMode(tab.dataset.mode));
});

// 点击圆环也可开始/暂停
timerEl.addEventListener('click', start);

// 时间设置变化
Object.values(inputs).forEach(input => {
    input.addEventListener('change', updateSettings);
    input.addEventListener('input', updateSettings);
});

// ===== 初始化 =====
updateColor();
updateDisplay();
