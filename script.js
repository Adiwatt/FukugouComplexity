// 参数

const BASE_SCORES = {
    'u': 1.3,
    'd': 1.2,
    'k': 1.0
};

const WEIGHT_MAP = {
    'k,k': [1.0, 1.0],
    'k,u': [1.0, 1.0],
    'k,d': [1.0, 1.0],
    'u,k': [1.0, 1.5],
    'd,k': [1.0, 1.5],
    'u,u': [1.4, 1.5],
    'd,d': [1.4, 1.5],
    'u,d': [0.7, 1.0],
    'd,u': [0.7, 1.0]
};

const FATIGUE_C = 1.45;
const C_STRAIN = 0.005;

const REFERENCE_PATTERNS = [
    "oooooooooooooooo",
    "ooxxooxxooxxooxx",
    "oxxooxxooxxooxxo",
    "xxoxxoxxoxxoxxox",
    "xxoxooxoxxoxooxo"
];

// 计算逻辑 

function getTorqueSymbol(prevVal, currVal) {
    if (prevVal === 'x' && currVal === 'o') return 'd';
    else if (prevVal === 'o' && currVal === 'x') return 'u';
    else return 'k';
}

function calculateMemoryWeight(s, cVal) {
    if (s.length < 2) return new Array(s.length).fill(1.0);

    let pairs = [];
    for (let i = 0; i < s.length - 1; i += 2) {
        pairs.push(s.substring(i, i + 2));
    }

    let flop = [];
    let cnotes = [];

    for (let p of pairs) {
        flop.unshift(p);
        let foundIndex = -1;
        for (let j = 1; j < flop.length; j++) {
            if (flop[j] === p) {
                foundIndex = j;
                break;
            }
        }
        if (foundIndex !== -1) {
            flop = flop.slice(0, foundIndex);
        }
        let stackDepth = flop.length;
        cnotes.push(1.0 * Math.pow(cVal, stackDepth - 1));
    }
    return cnotes;
}

function calculateTaikoComplexity(s) {
    const n = s.length;
    // 初始化每个音符的详情
    let noteDetails = [];
    for(let i=0; i<n; i++) {
        noteDetails.push({
            index: i,
            char: s[i],
            totalScore: 0
        });
    }

    if (n < 2) return { diff: 0.0, hand: 0.0, read: 0.0, noteDetails: noteDetails };

    let rSeq = [], lSeq = [];
    for (let i = 0; i < n; i++) {
        if (i % 2 === 0) rSeq.push(s[i]);
        else lSeq.push(s[i]);
    }

    let fl = ['k'];
    for (let i = 1; i < lSeq.length; i++) {
        fl.push(getTorqueSymbol(lSeq[i - 1], lSeq[i]));
    }

    let fr = [];
    for (let i = 0; i < rSeq.length - 1; i++) {
        fr.push(getTorqueSymbol(rSeq[i], rSeq[i + 1]));
    }

    if (n % 2 === 0) fr.push('k');
    if (fr.length > fl.length) fl.push('k');

    const cnotes = calculateMemoryWeight(s, FATIGUE_C);
    const minLen = Math.min(fl.length, fr.length, cnotes.length);

    let totalComplexity = 0.0;
    let totalBaseComplexity = 0.0;

    for (let i = 0; i < minLen; i++) {
        const symL = fl[i];
        const symR = fr[i];
        const noteWeight = cnotes[i];

        const baseL = BASE_SCORES[symL] || 1.0;
        const baseR = BASE_SCORES[symR] || 1.0;

        const handWeights = WEIGHT_MAP[`${symL},${symR}`] || [1.0, 1.0];
        const cli = handWeights[0];
        const cri = handWeights[1];

        const termA = baseL * cli + baseR * cri;

        const weightStrain = 1 + C_STRAIN * i;

        const nodeScore = termA * weightStrain * noteWeight;

        totalBaseComplexity += termA;
        totalComplexity += nodeScore;

        // --- 分配分数到具体音符 ---
        const leftIdx = 2 * i + 1;
        if (leftIdx < n) {
            const leftScore = baseL * cli * weightStrain * noteWeight;
            noteDetails[leftIdx].totalScore = leftScore;
        }

        const rightIdx = 2 * i + 2;
        if (rightIdx < n) {
            const rightScore = baseR * cri * weightStrain * noteWeight;
            noteDetails[rightIdx].totalScore = rightScore;
        }
    }
    
    const avgComplexity = totalComplexity / n;
    const handScore = totalBaseComplexity / n;
    const readScore = avgComplexity - handScore;

    return {
        diff: avgComplexity,
        hand: handScore,
        read: readScore,
        noteDetails: noteDetails
    };
}

// DOM 操作 

const inputEl = document.getElementById('patternInput');
const noteTrackEl = document.getElementById('noteTrack');
const noteScrollContainer = document.getElementById('noteScrollContainer');
const chartScrollContainer = document.getElementById('chartScrollContainer');

const diffScoreEl = document.getElementById('diffScore');
const handScoreEl = document.getElementById('handScore');
const readScoreEl = document.getElementById('readScore');
const handPctEl = document.getElementById('handPct');
const readPctEl = document.getElementById('readPct');
const noteCountBoxEl = document.getElementById('noteCountBox');
const refSectionEl = document.getElementById('referenceSection');

const chartCanvas = document.getElementById('complexityChart');
const chartTooltip = document.getElementById('chartTooltip');

// 同步滚动
let isSyncingNote = false;
let isSyncingChart = false;

noteScrollContainer.addEventListener('scroll', function() {
    if (!isSyncingChart) {
        isSyncingNote = true;
        chartScrollContainer.scrollLeft = this.scrollLeft;
    }
    isSyncingChart = false;
});

chartScrollContainer.addEventListener('scroll', function() {
    if (!isSyncingNote) {
        isSyncingChart = true;
        noteScrollContainer.scrollLeft = this.scrollLeft;
    }
    isSyncingNote = false;
});

let currentDetails = [];
let noteWidth = 60; // 默认值，会动态获取
const notePaddingLeft = 20; // .taiko-track padding-left

function drawChart(details) {
    if (!chartCanvas.getContext || details.length === 0) return;
    const ctx = chartCanvas.getContext('2d');
    const totalWidth = notePaddingLeft * 2 + details.length * noteWidth;
    
    // 设置 Canvas 尺寸
    chartCanvas.width = totalWidth;
    chartCanvas.height = chartCanvas.clientHeight; // 高度保持由 CSS 控制 (150px)

    const width = chartCanvas.width;
    const height = chartCanvas.height;

    ctx.clearRect(0, 0, width, height);

    const padding = { top: 20, bottom: 20 };
    const chartH = height - padding.top - padding.bottom;

    // 找最大值以确定Y轴刻度
    let maxScore = 0;
    details.forEach(d => {
        if (d.totalScore > maxScore) maxScore = d.totalScore;
    });
    maxScore = Math.max(maxScore, 3.0); 

    // 绘制折线
    ctx.beginPath();
    ctx.strokeStyle = '#4facfe';
    ctx.lineWidth = 2;
    details.forEach((d, i) => {
        const x = notePaddingLeft + i * noteWidth + noteWidth / 2;
        const y = (height - padding.bottom) - (d.totalScore / maxScore) * chartH;
        
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // 绘制点
    details.forEach((d, i) => {
        const x = notePaddingLeft + i * noteWidth + noteWidth / 2;
        const y = (height - padding.bottom) - (d.totalScore / maxScore) * chartH;
        
        ctx.fillStyle = '#ffbd45';
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
    });

    // 存储元数据供交互使用
    chartCanvas.chartMeta = {
        maxScore, chartH, padding, details, noteWidth, notePaddingLeft
    };
}

// 交互：点击显示分数
chartCanvas.addEventListener('mousedown', function(e) {
    const meta = chartCanvas.chartMeta;
    if (!meta) return;
    // 鼠标点击位置相对于 Canvas 左上角的坐标:
    const clickX = e.offsetX; // 使用 offsetX 更直接

    // 寻找最近的音符列
    const approxIndex = Math.round((clickX - meta.notePaddingLeft - meta.noteWidth / 2) / meta.noteWidth);
    
    if (approxIndex >= 0 && approxIndex < meta.details.length) {
        const d = meta.details[approxIndex];
        // 校验点击范围是否在点的附近 (X轴)
        const centerX = meta.notePaddingLeft + approxIndex * meta.noteWidth + meta.noteWidth / 2;
        if (Math.abs(clickX - centerX) < meta.noteWidth / 2) {
            // 显示 Tooltip
            const y = (chartCanvas.height - meta.padding.bottom) - (d.totalScore / meta.maxScore) * meta.chartH;
            
            chartTooltip.style.left = centerX + 'px';
            chartTooltip.style.top = y + 'px';
            chartTooltip.innerText = d.totalScore.toFixed(3);
            chartTooltip.style.display = 'block';
            
            // 2秒后自动消失
            if(chartTooltip.hideTimer) clearTimeout(chartTooltip.hideTimer);
            chartTooltip.hideTimer = setTimeout(() => {
                chartTooltip.style.display = 'none';
            }, 2000);
        }
    }
});

// 生成音符 HTML 字符串
function generateNotesHtml(pattern, isMini = false) {
    let html = '';
    const noteClass = isMini ? 'note mini' : 'note';

    for (let char of pattern) {
        if (char === 'o') html += `<div class="${noteClass} don"></div>`;
        else if (char === 'x') html += `<div class="${noteClass} ka"></div>`;
        else if (char === '?') html += `<div class="${noteClass} unknown">?</div>`;
    }
    return html;
}

// 更新主界面
function updateUI() {
    const rawInput = inputEl.value;
    const lowerInput = rawInput.toLowerCase();

    let cleanPattern = '';
    let displayPattern = ''; 

    for (let char of lowerInput) {
        if (char === 'o' || char === 'x') {
            cleanPattern += char;
            displayPattern += char;
        } else if (char.trim() !== '') {
            displayPattern += '?'; 
        }
    }

    noteTrackEl.innerHTML = generateNotesHtml(displayPattern, false);
    const firstNote = noteTrackEl.querySelector('.note');
    if (firstNote) {
        noteWidth = firstNote.offsetWidth; 
    } else {
        // Fallback based on CSS
        noteWidth = window.innerWidth >= 768 ? 80 : 60;
    }

    const res = calculateTaikoComplexity(cleanPattern);
    currentDetails = res.noteDetails;

    diffScoreEl.innerText = res.diff.toFixed(3);
    handScoreEl.innerText = res.hand.toFixed(3);
    readScoreEl.innerText = res.read.toFixed(3);

    let hPct = 0.0;
    let rPct = 0.0;
    if (res.diff > 0.0001) {
        hPct = (res.hand / res.diff) * 100;
        rPct = (res.read / res.diff) * 100;
    }

    handPctEl.innerText = `(${hPct.toFixed(1)}%)`;
    readPctEl.innerText = `(${rPct.toFixed(1)}%)`;
    noteCountBoxEl.innerText = `音符个数: ${cleanPattern.length}`;

    // 绘制图表
    drawChart(res.noteDetails);
    chartTooltip.style.display = 'none';
}

function initReferenceSection() {
    refSectionEl.innerHTML = '';
    REFERENCE_PATTERNS.forEach(pattern => {
        const res = calculateTaikoComplexity(pattern);
        const notesHtml = generateNotesHtml(pattern, true);
        let hPct = 0.0;
        let rPct = 0.0;
        if (res.diff > 0.0001) {
            hPct = (res.hand / res.diff) * 100;
            rPct = (res.read / res.diff) * 100;
        }

        const row = document.createElement('div');
        row.className = 'ref-row';
        row.innerHTML = `
            <div class="ref-visual">
                <div class="taiko-container-wrapper">
                    <div class="taiko-track">
                        ${notesHtml}
                    </div>
                </div>
            </div>
            <div class="ref-scores">
                <div class="ref-score-item">
                    <div class="ref-score-label">难度评分</div>
                    <div class="ref-score-val">${res.diff.toFixed(3)}</div>
                </div>
                <div class="ref-score-item">
                    <div class="ref-score-label">运手配分</div>
                    <div class="ref-score-val">
                        ${res.hand.toFixed(3)}
                        <span class="ref-pct">${hPct.toFixed(1)}%</span>
                    </div>
                </div>
                <div class="ref-score-item">
                    <div class="ref-score-label">读谱配分</div>
                    <div class="ref-score-val">
                        ${res.read.toFixed(3)}
                        <span class="ref-pct">${rPct.toFixed(1)}%</span>
                    </div>
                </div>
            </div>
        `;
        refSectionEl.appendChild(row);
    });
}

inputEl.addEventListener('input', updateUI);
initReferenceSection();

// 延迟一点 update 确保 DOM 渲染完能拿到宽度
setTimeout(updateUI, 100);

// 窗口大小改变重绘 (主要是音符大小可能变了)
window.addEventListener('resize', () => {
    updateUI();
});