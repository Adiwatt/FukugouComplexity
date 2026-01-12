
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
    // 如果长度不够，返回0
    if (n < 2) return { diff: 0.0, hand: 0.0, read: 0.0 };

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
    }
    const avgComplexity = totalComplexity / n;
    const handScore = totalBaseComplexity / n;
    const readScore = avgComplexity - handScore;

    return {
        diff: avgComplexity,
        hand: handScore,
        read: readScore
    };
}

// DOM 操作 

const inputEl = document.getElementById('patternInput');
const noteTrackEl = document.getElementById('noteTrack');
const diffScoreEl = document.getElementById('diffScore');
const handScoreEl = document.getElementById('handScore');
const readScoreEl = document.getElementById('readScore');
const handPctEl = document.getElementById('handPct');
const readPctEl = document.getElementById('readPct');
const noteCountBoxEl = document.getElementById('noteCountBox');
const refSectionEl = document.getElementById('referenceSection');

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
    let displayPattern = ''; // 用于显示问号

    for (let char of lowerInput) {
        if (char === 'o' || char === 'x') {
            cleanPattern += char;
            displayPattern += char;
        } else if (char.trim() !== '') {
            displayPattern += '?'; // 非空格非法字符
        }
    }

    noteTrackEl.innerHTML = generateNotesHtml(displayPattern, false);

    const res = calculateTaikoComplexity(cleanPattern);

    // 更新分数值
    diffScoreEl.innerText = res.diff.toFixed(3);
    handScoreEl.innerText = res.hand.toFixed(3);
    readScoreEl.innerText = res.read.toFixed(3);

    // 更新百分比 ---
    let hPct = 0.0;
    let rPct = 0.0;

    // 防止除以0
    if (res.diff > 0.0001) {
        hPct = (res.hand / res.diff) * 100;
        rPct = (res.read / res.diff) * 100;
    }

    handPctEl.innerText = `(${hPct.toFixed(1)}%)`;
    readPctEl.innerText = `(${rPct.toFixed(1)}%)`;

    noteCountBoxEl.innerText = `音符个数: ${cleanPattern.length}`;
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
updateUI();