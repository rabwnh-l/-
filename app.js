// ===== DATA =====
const MONTHS = ['مانگی 1','مانگی 2','مانگی 3','مانگی 4','مانگی 5','مانگی 6','مانگی 7','مانگی 8','مانگی 9','مانگی 10','مانگی 11','مانگی 12'];
const DEFAULT_NAMES = ['Player 1','Player 2','Player 3','Player 4','Player 5','Player 6','Player 7','Player 8'];
const AVATAR_COLORS = [
    ['#6c5ce7','#a29bfe'],['#00cec9','#55efc4'],['#e17055','#fab1a0'],['#fdcb6e','#ffeaa7'],
    ['#4a7dff','#74b9ff'],['#00b894','#55efc4'],['#ff5c72','#ff8a9a'],['#636e72','#b2bec3']
];

let playerPhotos = {}; // THE VAULT: Keeps heavy images out of the main logic

function getDefaultData() {
    const now = new Date();
    return {
        players: DEFAULT_NAMES.map((name, i) => ({ id: i, name, points: 0, wins: 0, losses: 0, gamesPlayed: 0, isHidden: false })),
        currentMonth: now.getMonth(),
        currentYear: now.getFullYear(),
        monthlyResults: [],
        annualStats: {},
        yesterdayRanks: {},
        yesterdayState: null,
        viewYear: now.getFullYear()
    };
}
function loadData() {
    try { 
        const r = localStorage.getItem('competitionData'); 
        const p = localStorage.getItem('playerPhotos');
        if (p) playerPhotos = JSON.parse(p);
        if (r) return JSON.parse(r); 
    } catch(e) {}
    return getDefaultData();
}
// ===== FIREBASE INIT =====
let database = null;
let dbRef = null;
let photoRef = null; 
let chatRef = null; // Node for anonymous chat

try {
    if (typeof firebase !== 'undefined' && firebase.database) {
        database = firebase.database();
        dbRef = database.ref('competitionData');
        photoRef = database.ref('playerPhotos');
        chatRef = database.ref('chatMessages');
        chatStatusRef = database.ref('chatStatus'); // Node for lock status
        console.log("Firebase initialized successfully.");
    } else {
        console.warn("Firebase SDK not loaded. Running in offline/localStorage mode.");
    }
} catch (e) {
    console.error("Firebase init failed:", e);
    database = null;
    dbRef = null;
}

// Ensure data arrays are real JS arrays (Firebase converts arrays to objects)
function normalizeData(d) {
    if (!d) return d;
    if (d.players && !Array.isArray(d.players)) {
        d.players = Object.values(d.players);
    }
    if (d.monthlyResults && !Array.isArray(d.monthlyResults)) {
        d.monthlyResults = Object.values(d.monthlyResults);
    }
    // Normalize nested arrays inside monthlyResults
    if (Array.isArray(d.monthlyResults)) {
        d.monthlyResults.forEach(r => {
            if (r.winners && !Array.isArray(r.winners)) r.winners = Object.values(r.winners);
            if (r.second && !Array.isArray(r.second)) r.second = Object.values(r.second);
            if (r.third && !Array.isArray(r.third)) r.third = Object.values(r.third);
            if (r.fourth && !Array.isArray(r.fourth)) r.fourth = Object.values(r.fourth);
            if (r.fifth && !Array.isArray(r.fifth)) r.fifth = Object.values(r.fifth);
            if (r.sixth && !Array.isArray(r.sixth)) r.sixth = Object.values(r.sixth);
            if (r.seventh && !Array.isArray(r.seventh)) r.seventh = Object.values(r.seventh);
            if (r.eighth && !Array.isArray(r.eighth)) r.eighth = Object.values(r.eighth);
            if (r.ninth && !Array.isArray(r.ninth)) r.ninth = Object.values(r.ninth);
            if (r.players && !Array.isArray(r.players)) r.players = Object.values(r.players);
        });
    }
    // Ensure monthlyResults is always an array
    if (!d.monthlyResults) d.monthlyResults = [];
    if (!d.players) d.players = [];
    return d;
}

let isInitialLoadDone = false;
let saveTimeout = null;
function saveData(immediate = false) { 
    localStorage.setItem('competitionData', JSON.stringify(data)); 
    if (immediate) performFirebaseSave();
    else {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(performFirebaseSave, 1000);
    }
}

function performFirebaseSave() {
    // SECURITY: Only admins can push data to Firebase
    if (sessionStorage.getItem('userRole') !== 'admin') {
        console.log("Firebase sync skipped: User is not admin.");
        return;
    }
    
    // DATA PROTECTION: Don't overwrite the server until we've received the latest data from it
    if (!isInitialLoadDone) {
        console.warn("Firebase sync skipped: Initial server load not yet complete.");
        return;
    }

    // Priority 1: Firebase Server
    if (dbRef) {
        dbRef.set(data)
            .then(() => console.log("Server Sync Success ✅"))
            .catch(e => {
                console.error("Server Sync Failed ❌:", e);
                // Fallback: Local device only if server fails
                localStorage.setItem('competitionData', JSON.stringify(data));
            });
    } else {
        // Fallback if offline
        localStorage.setItem('competitionData', JSON.stringify(data));
    }
}

function savePhotos() {
    localStorage.setItem('playerPhotos', JSON.stringify(playerPhotos));
    if (photoRef && sessionStorage.getItem('userRole') === 'admin') {
        photoRef.set(playerPhotos).catch(e => console.error("Photo Sync Error:", e));
    }
}

let data = normalizeData(loadData());

// Listener for real-time updates - Server is the Master
if (dbRef) {
    dbRef.on('value', (snapshot) => {
        const remoteData = snapshot.val();
        isInitialLoadDone = true; // Mark that we've heard from the server
        if (remoteData) {
            console.log("Remote Update Received from Server");
            data = normalizeData(remoteData);
            
            // Sync local storage to match server
            localStorage.setItem('competitionData', JSON.stringify(data));
            
            const activeTab = document.querySelector('.tab-item.active');
            const currentTab = activeTab ? activeTab.dataset.tab : '';
            if (currentTab !== 'settings' && currentTab !== 'record') {
                renderCurrentPage();
            }
        }
    });
}

if (photoRef) {
    photoRef.on('value', (snapshot) => {
        const photos = snapshot.val();
        if (photos) {
            playerPhotos = photos;
            const activeTab = document.querySelector('.tab-item.active');
            const currentTab = activeTab ? activeTab.dataset.tab : '';
            // Only re-render if NOT on an input page
            if (currentTab !== 'settings' && currentTab !== 'record' && (['leaderboard'].includes(currentTab))) {
                renderCurrentPage();
            }
        }
    });
}

if (chatRef) {
    chatRef.on('value', (snapshot) => {
        chatMessages = snapshot.val() || {};
        const activeTab = document.querySelector('.tab-item.active');
        if (activeTab && activeTab.dataset.tab === 'chat') renderChatPage();
    });
}

let chatStatus = { isLocked: false };
if (chatStatusRef) {
    chatStatusRef.on('value', (snapshot) => {
        chatStatus = snapshot.val() || { isLocked: false };
        updateChatUIStatus();
    });
}

function renderCurrentPage() {
    const activeTab = document.querySelector('.tab-item.active');
    if (!activeTab) return;
    const target = activeTab.dataset.tab;
    if (target === 'leaderboard') renderLeaderboard();
    if (target === 'record') renderRecordPage();
    if (target === 'annual') renderAnnualPage();
    if (target === 'rankings') renderRankingsPage();
    if (target === 'chat') { renderChatPage(); updateChatUIStatus(); }
    if (target === 'settings') renderSettings();
}
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function getInitial(name) { return name.charAt(0).toUpperCase(); }

// ===== TABS =====
document.querySelectorAll('.tab-item').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const target = tab.dataset.tab;
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const map = { 
            leaderboard:'pageLeaderboard', 
            record:'pageRecord', 
            annual:'pageAnnual', 
            rankings:'pageRankings',
            chat:'pageChat',
            settings:'pageSettings' 
        };
        document.getElementById(map[target]).classList.add('active');
        if (target === 'leaderboard') renderLeaderboard();
        if (target === 'record') renderRecordPage();
        if (target === 'annual') renderAnnualPage();
        if (target === 'rankings') renderRankingsPage();
        if (target === 'chat') renderChatPage();
        if (target === 'settings') renderSettings();
    });
});

// Chat Enter Key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && document.activeElement.id === 'chatInput') {
        sendChatMessage();
    }
});

function switchTab(tabName) {
    const tab = document.querySelector(`.tab-item[data-tab="${tabName}"]`);
    if (tab) tab.click();
}

// ===== TOAST & MODAL =====
let toastTimer;
function showToast(msg) {
    const t = document.getElementById('toast');
    document.getElementById('toastText').textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2000);
}
function showModal(title, message, buttons) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalMessage').textContent = message;
    const actions = document.getElementById('modalActions');
    actions.innerHTML = '';
    buttons.forEach(b => {
        const btn = document.createElement('button');
        btn.className = 'modal-btn ' + (b.class || 'cancel');
        btn.textContent = b.text;
        btn.onclick = () => { hideModal(); if (b.action) b.action(); };
        actions.appendChild(btn);
    });
    document.getElementById('modalOverlay').classList.add('active');
}
function hideModal() { document.getElementById('modalOverlay').classList.remove('active'); }
document.getElementById('modalOverlay').addEventListener('click', e => { if (e.target === e.currentTarget) hideModal(); });

// ===== AVATAR HELPER =====
function getAvatarHTML(p, sizeClass, extraStyle = '') {
    const origIdx = data.players.findIndex(dp => dp.id === p.id);
    const col = AVATAR_COLORS[origIdx % AVATAR_COLORS.length];
    const photo = playerPhotos[p.id];
    const bg = photo ? `background-image:url(${photo})` : `background:linear-gradient(135deg,${col[0]},${col[1]})`;
    const content = photo ? '' : getInitial(p.name);
    return `<div class="${sizeClass}" style="${bg};${extraStyle}">${content}</div>`;
}

// ===== RANK TREND HELPER =====
function getRankTrendHTML(playerId, currentRank) {
    if (!data.yesterdayRanks || data.yesterdayRanks[playerId] === undefined) return '';
    const prevRank = data.yesterdayRanks[playerId];
    if (currentRank < prevRank) {
        return `<span class="rank-trend up">▲</span>`;
    } else if (currentRank > prevRank) {
        return `<span class="rank-trend down">▼</span>`;
    }
    return '';
}

// ===== LEADERBOARD (Podium + List) =====
function getSortedPlayers() {
    return [...data.players].filter(p => !p.isHidden).sort((a, b) => {
        // Move players with 0 games to the bottom
        if (a.gamesPlayed === 0 && b.gamesPlayed > 0) return 1;
        if (a.gamesPlayed > 0 && b.gamesPlayed === 0) return -1;
        
        if (b.points !== a.points) return b.points - a.points;
        if (b.wins !== a.wins) return b.wins - a.wins;
        return a.name.localeCompare(b.name);
    });
}

function renderLeaderboard() {
    document.getElementById('currentMonthBadge').textContent = MONTHS[data.currentMonth] + ' ' + data.currentYear;
    const sorted = getSortedPlayers();
    const ranks = sorted.map((_, i) => i + 1);

    const podium = document.getElementById('podiumSection');
    const top3 = sorted.slice(0, 3);
    const podiumOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3;
    const podiumRanks = top3.length >= 3 ? [2, 1, 3] : top3.map((_, i) => i + 1);
    const podiumClasses = { 1: 'podium-first', 2: 'podium-second', 3: 'podium-third' };

    let podiumHTML = '';
    podiumOrder.forEach((p, i) => {
        const rank = podiumRanks[i];
        const cls = podiumClasses[rank] || '';
        const pointStr = p.points > 0 ? '+' + p.points : '' + p.points;
        const crown = rank === 1 ? '<div class="podium-crown">👑</div>' : '';
        const trend = getRankTrendHTML(p.id, rank);

        podiumHTML += `<div class="podium-player ${cls}">
            <div class="podium-avatar">
                ${crown}
                ${getAvatarHTML(p, 'avatar-ring')}
                <div class="podium-badge">${rank}</div>
            </div>
            <div class="podium-name">${esc(p.name)} ${trend}</div>
            <div class="podium-points">${pointStr}</div>
            <div class="podium-stats">${p.wins} بردنەوە · ${p.losses} دۆڕان</div>
        </div>`;
    });
    podium.innerHTML = podiumHTML;

    const rest = document.getElementById('restList');
    if (sorted.length <= 3) { rest.innerHTML = ''; return; }
    let restHTML = '';
    const lowestPoints = sorted[sorted.length - 1].points;
    
    for (let i = 3; i < sorted.length; i++) {
        const p = sorted[i];
        const rank = ranks[i];
        const pointStr = p.points > 0 ? '+' + p.points : '' + p.points;
        const pointClass = p.points > 0 ? 'positive' : p.points < 0 ? 'negative' : 'zero';
        
        const isLastPlace = p.points === lowestPoints;
        const lastClass = isLastPlace ? 'last-place' : '';
        const sleepingIcon = isLastPlace ? '<span class="sleep-icon">zzz</span>' : '';
        const trend = getRankTrendHTML(p.id, rank);
        
        restHTML += `<div class="rest-item ${lastClass}" style="animation-delay:${(i-3)*0.06}s">
            <div class="rest-rank">${rank}</div>
            ${getAvatarHTML(p, 'rest-avatar')}
            <div class="rest-info">
                <div class="rest-name">${esc(p.name)} ${trend} ${sleepingIcon}</div>
                <div class="rest-detail">${p.wins} بردنەوە - ${p.losses} دۆڕان · ${p.gamesPlayed} یاری</div>
            </div>
            <div class="rest-points ${pointClass}">${pointStr}</div>
        </div>`;
    }
    rest.innerHTML = restHTML;
}

function renderRecordPage() {
    const grid = document.getElementById('playersGrid');
    if (!grid) return;
    
    // Use a DocumentFragment for high performance rendering
    const fragment = document.createDocumentFragment();
    
    const sorted = [...data.players].filter(p => !p.isHidden);
    
    sorted.forEach((p) => {
        const pointStr = p.points > 0 ? '+' + p.points : '' + p.points;
        const colorClass = p.points > 0 ? 'pos' : (p.points < 0 ? 'neg' : '');
        
        const card = document.createElement('div');
        card.className = 'record-card premium-glass';
        card.id = `prc-${p.id}`;
        card.innerHTML = `
            <div class="record-avatar-box">
                ${getAvatarHTML(p, 'record-avatar-large')}
            </div>
            <div class="record-main-info">
                <div class="record-name">${esc(p.name)}</div>
                <div class="record-stats">${p.wins} W · ${p.losses} L · ${p.gamesPlayed} G</div>
            </div>
            <div class="record-actions">
                <button class="record-btn btn-minus" data-id="${p.id}" data-type="lose">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="3"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                </button>
                <div class="record-score ${colorClass}" id="score-val-${p.id}">${pointStr}</div>
                <button class="record-btn btn-plus" data-id="${p.id}" data-type="win">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                </button>
            </div>
        `;
        
        // Add event listeners directly to bypass onclick delays
        card.querySelectorAll('.record-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                recordResultById(parseInt(btn.dataset.id), btn.dataset.type);
            });
        });
        
        fragment.appendChild(card);
    });
    
    grid.innerHTML = '';
    grid.appendChild(fragment);

    // Bind Manual Save button if on this page
    const saveBtn = document.getElementById('btnManualSave');
    if (saveBtn) {
        saveBtn.onclick = null; // Remove old listener
        saveBtn.addEventListener('click', (e) => {
            e.preventDefault();
            manualSync();
            
            // Visual Feedback
            saveBtn.style.transform = 'scale(0.95)';
            saveBtn.style.filter = 'brightness(1.2)';
            setTimeout(() => {
                saveBtn.style.transform = '';
                saveBtn.style.filter = '';
            }, 150);
        });
    }
}

function recordResultById(playerId, type) {
    const p = data.players.find(x => x.id === playerId);
    if (!p) return;
    
    if (type === 'win') { p.points++; p.wins++; } else { p.points--; p.losses++; }
    p.gamesPlayed++;
    saveData();

    // Instant Update UI
    const scoreEl = document.getElementById(`score-val-${playerId}`);
    const card = document.getElementById(`prc-${playerId}`);
    if (scoreEl) {
        const pointStr = p.points > 0 ? '+' + p.points : '' + p.points;
        scoreEl.textContent = pointStr;
        scoreEl.className = `record-score ${p.points > 0 ? 'pos' : (p.points < 0 ? 'neg' : '')}`;
        
        // Animated Flash
        const flash = document.createElement('div');
        flash.className = 'point-flash-new ' + type;
        flash.textContent = type === 'win' ? '+1' : '-1';
        card.appendChild(flash);
        setTimeout(() => flash.remove(), 600);
    }
    
    showToast(p.name + (type === 'win' ? ' +1 Win' : ' -1 Loss'));
}

function recordResult(index, type) {
    const p = data.players[index];
    if (type === 'win') { p.points++; p.wins++; } else { p.points--; p.losses++; }
    p.gamesPlayed++;
    saveData();
    
    // Update individual elements for speed
    const card = document.getElementById('prc-' + index);
    if (card) {
        const pointStr = p.points > 0 ? '+' + p.points : '' + p.points;
        const ptsEl = card.querySelector('.player-record-points');
        const countEls = card.querySelectorAll('div[style*="font-weight:900"]');
        
        if (ptsEl) ptsEl.textContent = `Pts: ${pointStr} · ${p.gamesPlayed} games`;
        if (countEls && countEls[0]) countEls[0].textContent = pointStr;

        const flash = document.createElement('div');
        flash.className = 'point-flash ' + type;
        flash.textContent = type === 'win' ? '+1' : '-1';
        card.appendChild(flash);
        setTimeout(() => flash.remove(), 800);
    }
    showToast(p.name + (type === 'win' ? ' +1 بردنەوە' : ' -1 دۆڕان'));
}

function resetToday() {
    if (!data.yesterdayState) {
        showToast("No locked ranks found. End Today first!");
        return;
    }
    showModal('Reset Today?', 'Revert points and stats to the state they were in when ranks were last locked.', [
        { text: 'Cancel', class: 'cancel' },
        { text: 'Reset', class: 'danger', action: () => {
            // Restore players from yesterdayState
            data.players = JSON.parse(JSON.stringify(data.yesterdayState));
            saveData();
            showToast('Stats reverted to last lock! ↩️');
            renderRecordPage();
        }}
    ]);
}

// ===== ANNUAL =====
function renderAnnualPage() {
    const champ = document.getElementById('annualChampions');
    const tally = {};
    
    // Aggregate ALL winners from ALL years
    data.monthlyResults.forEach(r => {
        r.winners.forEach(w => { tally[w.name] = (tally[w.name] || 0) + 1; });
    });
    
    const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) {
        champ.innerHTML = `<div class="annual-title">زۆرترین براوەی مانگانە</div><div class="no-data">No completed months yet.</div>`;
    } else {
        const medals = ['🥇','🥈','🥉'];
        let html = `<div class="annual-title">زۆرترین براوەی مانگانە</div>`;
        let lastVal = null, lastRank = 0;
        sorted.forEach(([name, count], i) => {
            const rank = (count === lastVal) ? lastRank : i + 1;
            lastVal = count; lastRank = rank;
            html += `<div class="champion-card" onclick="showPlayerAnnualStats('${esc(name)}')" style="cursor:pointer">
                <div class="champion-rank">${medals[rank-1] || rank}</div>
                <div class="champion-info"><div class="champion-name">${esc(name)}</div></div>
                <div class="champion-wins">${count} براوەی مانگانە</div>
            </div>`;
        });
        champ.innerHTML = html;
    }

    // --- YEARLY CHAMPIONS SECTION ---
    const yearlyDiv = document.getElementById('yearlyChampions');
    if (data.monthlyResults.length === 0) {
        yearlyDiv.innerHTML = '';
    } else {
        // Group results by year
        const yearsData = {};
        data.monthlyResults.forEach(r => {
            if (!yearsData[r.year]) yearsData[r.year] = {};
            r.winners.forEach(w => {
                yearsData[r.year][w.name] = (yearsData[r.year][w.name] || 0) + 1;
            });
        });

        let yHtml = `<div class="annual-title" style="margin-top:32px">پاڵەوانەکانی ساڵ</div>`;
        const sortedYears = Object.keys(yearsData).sort((a, b) => b - a);

        sortedYears.forEach(year => {
            const yearTally = Object.entries(yearsData[year]).sort((a, b) => b[1] - a[1]);
            if (yearTally.length > 0) {
                const maxWins = yearTally[0][1];
                const yearWinners = yearTally.filter(t => t[1] === maxWins).map(t => `<span style="color:#000; font-weight:800;">${esc(t[0])}</span>`);
                
                yHtml += `
                    <div class="champion-card" style="border-left: 4px solid var(--accent);">
                        <div class="champion-rank">🏆</div>
                        <div class="champion-info">
                            <div class="champion-name">پاڵەوانی ساڵی ${year}</div>
                            <div class="champion-detail">${yearWinners.join(' & ')}</div>
                        </div>
                        <div class="champion-wins">${maxWins} براوەی مانگانە</div>
                    </div>
                `;
            }
        });
        yearlyDiv.innerHTML = yHtml;
    }

    // --- YEAR BUTTONS SECTION ---
    const btnGrid = document.getElementById('yearlyButtonsGrid');
    if (data.monthlyResults.length === 0) {
        btnGrid.innerHTML = '';
    } else {
        const grouped = {};
        data.monthlyResults.forEach(r => {
            if (!grouped[r.year]) grouped[r.year] = [];
            grouped[r.year].push(r);
        });

        let bHtml = `<div class="annual-title" style="grid-column: 1 / -1;">ئەرشیفی ساڵانە</div>`;
        const sortedYears = Object.keys(grouped).sort((a, b) => b - a);
        sortedYears.forEach(year => {
            bHtml += `
                <button class="action-btn" onclick="openYearDetail(${year})" style="background:var(--glass); border:1px solid var(--glass-border); color:var(--text); backdrop-filter:blur(10px); height:60px; margin-bottom:0;">
                    تۆمارەکانی ساڵی ${year}
                </button>
            `;
        });
        btnGrid.innerHTML = bHtml;
    }

    const hist = document.getElementById('monthlyHistory');
    hist.innerHTML = ''; // Keep hidden as we use overlays now
}

function openYearDetail(year) {
    document.getElementById('yearDetailTitle').textContent = `ساڵی ${year}`;
    const container = document.getElementById('yearDetailContent');
    
    const results = data.monthlyResults.filter(r => r.year === year).sort((a,b) => b.month - a.month);
    
    let hHtml = '';
    results.forEach(r => {
        const fmtList = (arr) => arr && arr.length ? arr.map(w => `<span class="winner-name" style="color:#000; font-weight:800;">${esc(w.name)}</span>`).join(', ') : '—';
        
        let detail = `<div style="display:grid; grid-template-columns: 24px 1fr; gap:8px; font-size:12px; line-height:1.6;">`;
        detail += `<span>🥇</span> <span>${fmtList(r.winners)}</span>`;
        if (r.second && r.second.length) detail += `<span>🥈</span> <span>${fmtList(r.second)}</span>`;
        if (r.third && r.third.length) detail += `<span>🥉</span> <span>${fmtList(r.third)}</span>`;
        if (r.fourth && r.fourth.length) detail += `<span>4️⃣</span> <span>${fmtList(r.fourth)}</span>`;
        if (r.fifth && r.fifth.length) detail += `<span>5️⃣</span> <span>${fmtList(r.fifth)}</span>`;
        if (r.sixth && r.sixth.length) detail += `<span>6️⃣</span> <span>${fmtList(r.sixth)}</span>`;
        if (r.seventh && r.seventh.length) detail += `<span>7️⃣</span> <span>${fmtList(r.seventh)}</span>`;
        if (r.eighth && r.eighth.length) detail += `<span>8️⃣</span> <span>${fmtList(r.eighth)}</span>`;
        if (r.ninth && r.ninth.length) detail += `<span>9️⃣</span> <span>${fmtList(r.ninth)}</span>`;
        detail += `</div>`;
        
        hHtml += `<div class="month-history-card" style="margin-bottom:16px;">
            <div class="month-history-header" style="font-size:16px; margin-bottom:12px; border-bottom:1px solid var(--glass-border); padding-bottom:8px;">${MONTHS[r.month]}</div>
            ${detail}
        </div>`;
    });
    
    container.innerHTML = hHtml;
    document.getElementById('pageYearDetail').classList.add('active');
}

function closeYearDetail() {
    document.getElementById('pageYearDetail').classList.remove('active');
}

function calculateAllTimeScores() {
    const scores = {};
    // Initialize with all current players to ensure they appear
    data.players.forEach(p => { scores[p.name] = 0; });

    data.monthlyResults.forEach(res => {
        const addPts = (list, pts) => {
            if (list) list.forEach(w => { scores[w.name] = (scores[w.name] || 0) + pts; });
        };
        addPts(res.winners, 15);
        addPts(res.second, 10);
        addPts(res.third, 8);
        addPts(res.fourth, 6);
        addPts(res.fifth, 4);
        addPts(res.sixth, 3);
        addPts(res.seventh, 2);
        addPts(res.eighth, 1);
        addPts(res.ninth, 0);
    });
    return Object.entries(scores).sort((a, b) => b[1] - a[1]);
}

function renderRankingsPage() {
    const sorted = calculateAllTimeScores();
    const activePlayers = sorted.filter(s => s[1] > 0);
    
    const container = document.getElementById('rankingsListContent');
    if (activePlayers.length === 0) {
        container.innerHTML = `<div class="no-data">هیچ زانیارییەکی مێژوویی نییە بۆ ڕیزبەندی!</div>`;
        return;
    }

    let html = `<div style="display: flex; flex-direction: column; gap: 8px; margin-top: 20px;">`;
    
    activePlayers.forEach((s, i) => {
        const medals = ['🥇', '🥈', '🥉'];
        const isTop3 = i < 3;
        const isLast = i === activePlayers.length - 1 && activePlayers.length > 1;
        
        let cardBg = 'var(--glass)';
        let borderColor = 'var(--glass-border)';
        let textColor = 'var(--text)';
        let winColor = 'var(--text)';

        if (isLast) {
            cardBg = 'rgba(255,59,48,0.12)';
            borderColor = 'rgba(255,59,48,0.4)';
            textColor = 'var(--red)';
            winColor = 'var(--red)';
        } else if (isTop3) {
            cardBg = 'rgba(52,199,89,0.08)';
            borderColor = 'rgba(52,199,89,0.2)';
        }

        let glowClass = '';
        let fireworkHTML = '';
        if (i === 0) {
            glowClass = 'glow-rank-1';
            fireworkHTML = `<div style="position:absolute; inset:0; pointer-events:none; overflow:hidden; border-radius:inherit;">
                <div class="firework-particle" style="top:10%; left:20%; animation-delay:0s;"></div>
                <div class="firework-particle" style="top:70%; left:80%; animation-delay:0.5s; background:#fff;"></div>
                <div class="firework-particle" style="top:40%; left:50%; animation-delay:1s; background:#FFD700;"></div>
            </div>`;
        } else if (i === 1) {
            glowClass = 'glow-rank-2';
            fireworkHTML = `<div style="position:absolute; inset:0; pointer-events:none; overflow:hidden; border-radius:inherit;">
                <div class="firework-particle" style="top:20%; left:70%; animation-delay:0.3s; background:#C0C0C0;"></div>
                <div class="firework-particle" style="top:80%; left:10%; animation-delay:0.8s; background:#fff;"></div>
            </div>`;
        } else if (i === 2) {
            glowClass = 'glow-rank-3';
            fireworkHTML = `<div style="position:absolute; inset:0; pointer-events:none; overflow:hidden; border-radius:inherit;">
                <div class="firework-particle" style="top:15%; left:15%; animation-delay:0.6s; background:#CD7F32;"></div>
            </div>`;
        }

        html += `<div class="champion-card ${glowClass}" style="margin-bottom:0; background:${cardBg}; border:1px solid ${borderColor}; padding:18px; border-radius:var(--radius); display:flex; align-items:center; gap:16px; backdrop-filter:blur(15px); -webkit-backdrop-filter:blur(15px); position:relative; overflow:hidden;">
            ${fireworkHTML}
            <div class="champion-rank" style="font-size:20px; width:34px; text-align:center; font-weight:900; color:${textColor}; position:relative; z-index:1;">
                ${isTop3 ? medals[i] : (i + 1)}
            </div>
            <div class="champion-info" style="flex:1; text-align:right; position:relative; z-index:1;">
                <div class="champion-name" style="font-size:16px; font-weight:700; color:${textColor}">${esc(s[0])}</div>
            </div>
            <div class="champion-wins" style="color:${winColor}; font-size:18px; font-weight:900; margin-right:auto; margin-left:0; position:relative; z-index:1;">${s[1]}</div>
        </div>`;
    });
    
    html += `</div>`;
    container.innerHTML = html;
}

function showAllTimeRankings() {
    switchTab('rankings');
}

function showPlayerAnnualStats(playerName) {
    const stats = {
        '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7': 0, '8': 0, '9': 0
    };
    
    data.monthlyResults.forEach(res => {
        if (res.winners.some(w => w.name === playerName)) stats['1']++;
        if (res.second && res.second.some(w => w.name === playerName)) stats['2']++;
        if (res.third && res.third.some(w => w.name === playerName)) stats['3']++;
        if (res.fourth && res.fourth.some(w => w.name === playerName)) stats['4']++;
        if (res.fifth && res.fifth.some(w => w.name === playerName)) stats['5']++;
        if (res.sixth && res.sixth.some(w => w.name === playerName)) stats['6']++;
        if (res.seventh && res.seventh.some(w => w.name === playerName)) stats['7']++;
        if (res.eighth && res.eighth.some(w => w.name === playerName)) stats['8']++;
        if (res.ninth && res.ninth.some(w => w.name === playerName)) stats['9']++;
    });

    let html = `
        <h3 style="margin-bottom:16px; color:var(--accent); font-weight:900; font-size:20px;">${esc(playerName)}</h3>
        <p style="font-size:12px; color:var(--text3); margin-bottom:16px;">دابەشبوونی پلە مێژووییەکان</p>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
    `;

    const labels = {
        '1': '🥇 یەکەم', '2': '🥈 دووەم', '3': '🥉 سێیەم',
        '4': '4️⃣ چوارەم', '5': '5️⃣ پێنجەم', '6': '6️⃣ شەشەم',
        '7': '7️⃣ حەوتەم', '8': '8️⃣ هەشتەم', '9': '9️⃣ نۆیەم'
    };

    Object.keys(labels).forEach(key => {
        const count = stats[key];
        const opacity = count > 0 ? '1' : '0.3';
        html += `
            <div style="background:var(--surface2); padding:10px; border-radius:12px; display:flex; justify-content:space-between; align-items:center; opacity:${opacity}">
                <span style="font-size:13px; font-weight:600;">${labels[key]}</span>
                <span style="font-size:17px; font-weight:900; color: #000000;">${count}</span>
            </div>
        `;
    });

    html += `</div>`;
    
    document.getElementById('playerStatsContent').innerHTML = html;
    document.getElementById('playerStatsOverlay').classList.add('active');
}

function changeAnnualYear(dir) {
    // Logic removed as per user request
}

// ===== SETTINGS =====
let photoTargetId = null;

function renderSettings() {
    const list = document.getElementById('playerNamesList');
    let html = '';
    data.players.forEach((p, i) => {
        const hasPhoto = !!playerPhotos[p.id];
        const deletePhotoBtn = `<button class="btn-photo btn-delete-photo" 
            onclick="${hasPhoto ? `deletePlayerPhoto(${p.id})` : ''}" 
            style="${!hasPhoto ? 'opacity:0.2; cursor:default' : ''}" 
            title="Delete Photo">🗑️</button>`;
        html += `<div class="player-name-input">
            <label>${i+1}.</label>
            <input type="text" value="${esc(p.name)}" id="nameInput${i}" placeholder="Player ${i+1}" maxlength="20">
            <button class="btn-photo" onclick="triggerPhotoUpload(${p.id})" title="Change Photo">📷</button>
            <div style="display:flex; gap:6px; flex-shrink:0;">
                ${deletePhotoBtn}
                <button class="btn-delete-player" onclick="deletePlayer(${p.id})" title="Remove">✕</button>
            </div>
            <div style="flex: 1;"></div>
            <label class="toggle-switch" title="Toggle Visibility">
                <input type="checkbox" ${!p.isHidden ? 'checked' : ''} onchange="togglePlayerVisibility(${p.id})">
                <span class="slider"></span>
            </label>
        </div>`;
    });
    list.innerHTML = html;
    
    renderHistoricalSettings();
}

function renderHistoricalSettings() {
    const yearSelect = document.getElementById('histYear');
    if (!yearSelect) return;
    
    const currY = new Date().getFullYear();
    let yearOptions = '';
    // Offer years from 2020 up to 3 years in the future
    for (let y = currY + 3; y >= 2020; y--) {
        yearOptions += `<option value="${y}" ${y === currY ? 'selected' : ''}>${y}</option>`;
    }
    yearSelect.innerHTML = yearOptions;
    
    highlightExistingMonth(); // Initial check
    
    const container = document.getElementById('historicalRanksContainer');
    const ranks = [
        { label: '🥇 1st Place (Required)', key: '1' },
        { label: '🥈 2nd Place', key: '2' },
        { label: '🥉 3rd Place', key: '3' },
        { label: '4️⃣ 4th Place', key: '4' },
        { label: '5️⃣ 5th Place', key: '5' },
        { label: '6️⃣ 6th Place', key: '6' },
        { label: '7️⃣ 7th Place', key: '7' },
        { label: '8️⃣ 8th Place', key: '8' },
        { label: '9️⃣ 9th Place', key: '9' }
    ];

    let html = '';
    ranks.forEach(rank => {
        html += `<div class="hist-rank-group">
            <label style="font-size:12px;color:var(--text3);display:block;margin-bottom:8px;font-weight:700;">${rank.label}</label>
            <div class="hist-player-chips" id="histChips${rank.key}" style="display:flex; flex-wrap:wrap; gap:6px;">`;
        
        data.players.forEach(p => {
            html += `
                <label class="hist-chip">
                    <input type="checkbox" name="rank${rank.key}" value="${p.id}" style="display:none" onchange="toggleChip(this)">
                    <span class="chip-label">${esc(p.name)}</span>
                </label>`;
        });

        html += `</div></div>`;
    });
    container.innerHTML = html;
}

function toggleChip(input) {
    const span = input.nextElementSibling;
    if (input.checked) {
        span.classList.add('active');
    } else {
        span.classList.remove('active');
    }
}

function highlightExistingMonth() {
    const yStr = document.getElementById('histYear').value;
    const mStr = document.getElementById('histMonth').value;
    if (!yStr || !mStr) return;
    
    const y = parseInt(yStr);
    const m = parseInt(mStr);
    const select = document.getElementById('histMonth');
    const warning = document.getElementById('histWarning');
    
    const exists = data.monthlyResults.some(r => r.month === m && r.year === y);
    
    if (exists) {
        select.style.borderColor = 'var(--red)';
        select.style.color = 'var(--red)';
        if (warning) {
            warning.style.opacity = '1';
            warning.style.display = 'block';
        }
    } else {
        select.style.borderColor = 'rgba(0,0,0,0.1)';
        select.style.color = 'var(--text)';
        if (warning) {
            warning.style.opacity = '0';
            setTimeout(() => { if (warning.style.opacity === '0') warning.style.display = 'none'; }, 200);
        }
    }
}

function addHistoricalRecord() {
    try {
        const yearEl = document.getElementById('histYear');
        const monthEl = document.getElementById('histMonth');
        if (!yearEl || !monthEl) throw new Error("Missing year/month selection elements.");

        const y = parseInt(yearEl.value);
        const m = parseInt(monthEl.value);
        
        if (isNaN(y) || isNaN(m)) {
            showToast("تکایە ساڵ و مانگ هەڵبژێرە");
            return;
        }
        
        const getSelected = (rankNum) => {
            const checked = document.querySelectorAll(`input[name="rank${rankNum}"]:checked`);
            return Array.from(checked).map(cb => {
                const p = data.players.find(pl => pl.id == cb.value);
                if (!p) return null;
                return { name: p.name, points: 0 };
            }).filter(p => p !== null);
        };

        const first = getSelected('1');
        if (first.length === 0) {
            showToast("تکایە بەلایەنی کەم یەک براوەی یەکەم دیاری بکە!");
            return;
        }

        const record = {
            month: m,
            year: y,
            winners: first,
            second: getSelected('2'),
            third: getSelected('3'),
            fourth: getSelected('4'),
            fifth: getSelected('5'),
            sixth: getSelected('6'),
            seventh: getSelected('7'),
            eighth: getSelected('8'),
            ninth: getSelected('9'),
            // Only save active players to keep the record light
            players: data.players.filter(p => !p.isHidden).map(p => ({ name: p.name, points: 0, wins: 0, losses: 0 }))
        };
        
        // Ensure monthlyResults exists
        if (!data.monthlyResults) data.monthlyResults = [];
        
        // Remove existing record for this month/year if any
        data.monthlyResults = data.monthlyResults.filter(r => !(r.year === y && r.month === m));
        data.monthlyResults.push(record);
        
        // Sort: Latest first
        data.monthlyResults.sort((a, b) => (a.year !== b.year) ? b.year - a.year : b.month - a.month);
        
        saveData(true); // Force immediate save
        
        // Refresh all relevant pages
        renderAnnualPage();
        renderRankingsPage();
        
        closeHistoricalPage();
        showToast(`تۆمارەکە پاشەکەوت کرا بۆ ${MONTHS[m]} ${y}`);
    } catch (err) {
        console.error("Historical Record Error:", err);
        showToast("هەڵەیەک ڕوویدا لە کاتی پاشەکەوتکردن");
    }
}

function triggerPhotoUpload(playerId) {
    photoTargetId = playerId;
    document.getElementById('playerPhotoInput').click();
}

function compressAndSavePhoto(playerId, base64) {
    const img = new Image();
    img.src = base64;
    img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 180; // Small size for performance
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        // Square crop logic
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
        const compressed = canvas.toDataURL('image/jpeg', 0.5); // Low quality to save space
        
        playerPhotos[playerId] = compressed;
        savePhotos();
        renderSettings();
        renderLeaderboard();
        showToast("وێنەکە بچووک کرایەوە و پاشەکەوت کرا");
    };
}

document.getElementById('playerPhotoInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file || photoTargetId === null) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        compressAndSavePhoto(photoTargetId, event.target.result);
        photoTargetId = null; 
        e.target.value = '';
    };
    reader.readAsDataURL(file);
});

document.getElementById('btnSaveNames').addEventListener('click', () => {
    data.players.forEach((p, i) => {
        const inp = document.getElementById('nameInput' + i);
        if (inp && inp.value.trim()) p.name = inp.value.trim();
    });
    saveData(); showToast('Names saved!'); renderSettings();
});

document.getElementById('btnEndToday').addEventListener('click', () => {
    showModal('کۆتایی هێنان بە ئەمڕۆ؟', 'ڕیزبەندییەکانی ئێستا جێگیر دەکرێن بۆ بینینی گۆڕانکارییەکانی بەرزبوونەوە/دابەزین.', [
        { text: 'پاشگەزبوونەوە', class: 'cancel' },
        { text: 'کۆتایی ئەمڕۆ', class: 'confirm', action: endToday }
    ]);
});

function endToday() {
    try {
        const sorted = getSortedPlayers();
        data.yesterdayRanks = {};
        sorted.forEach((p, i) => {
            data.yesterdayRanks[p.id] = i + 1;
        });
        // Save full state for "Reset Today"
        data.yesterdayState = JSON.parse(JSON.stringify(data.players));
        saveData();
        showToast('ڕیزبەندی ڕۆژانە جێگیر کرا! 🔒');
        renderLeaderboard();
    } catch (err) {
        console.error(err);
        showToast('هەڵەیەک ڕوویدا');
    }
}

document.getElementById('btnNewCompetition').addEventListener('click', () => {
    showModal('کۆتایی مانگ؟', 'ئەنجامەکان پاشەکەوت دەکرێن و مانگێکی نوێ دەست پێدەکات.', [
        { text: 'پاشگەزبوونەوە', class: 'cancel' },
        { text: 'کۆتایی مانگ', class: 'confirm', action: endMonth }
    ]);
});

function endMonth() {
    try {
        const sorted = getSortedPlayers().filter(p => p.gamesPlayed > 0);
        const uniquePts = [...new Set(sorted.map(p => p.points))].sort((a, b) => b - a);
        const first = sorted.filter(p => p.points === uniquePts[0]).map(p => ({ name: p.name, points: p.points }));
        const second = uniquePts.length > 1 ? sorted.filter(p => p.points === uniquePts[1]).map(p => ({ name: p.name, points: p.points })) : [];
        const third = uniquePts.length > 2 ? sorted.filter(p => p.points === uniquePts[2]).map(p => ({ name: p.name, points: p.points })) : [];
        const fourth = uniquePts.length > 3 ? sorted.filter(p => p.points === uniquePts[3]).map(p => ({ name: p.name, points: p.points })) : [];
        const fifth = uniquePts.length > 4 ? sorted.filter(p => p.points === uniquePts[4]).map(p => ({ name: p.name, points: p.points })) : [];
        const sixth = uniquePts.length > 5 ? sorted.filter(p => p.points === uniquePts[5]).map(p => ({ name: p.name, points: p.points })) : [];
        const seventh = uniquePts.length > 6 ? sorted.filter(p => p.points === uniquePts[6]).map(p => ({ name: p.name, points: p.points })) : [];
        const eighth = uniquePts.length > 7 ? sorted.filter(p => p.points === uniquePts[7]).map(p => ({ name: p.name, points: p.points })) : [];
        const ninth = uniquePts.length > 8 ? sorted.filter(p => p.points === uniquePts[8]).map(p => ({ name: p.name, points: p.points })) : [];
        data.monthlyResults.push({
            month: data.currentMonth, year: data.currentYear,
            winners: first, second, third, fourth, fifth, sixth, seventh, eighth, ninth,
            players: data.players.map(p => ({ name: p.name, points: p.points, wins: p.wins, losses: p.losses }))
        });
        data.players.forEach(p => { p.points = 0; p.wins = 0; p.losses = 0; p.gamesPlayed = 0; });
        data.yesterdayRanks = {};
        data.yesterdayState = null;
        data.currentMonth++;
        if (data.currentMonth > 11) { data.currentMonth = 0; data.currentYear++; }
        saveData(); showToast('مانگی نوێ دەستی پێکرد! 🎉'); renderLeaderboard();
    } catch(err) {
        console.error(err);
        showToast('هەڵەیەک ڕوویدا');
    }
}

document.getElementById('btnResetCurrent').addEventListener('click', () => {
    showModal('سفرکردنەوەی مانگ؟', 'هەموو خاڵەکانی ئەم مانگە سفر دەکرێنەوە.', [
        { text: 'پاشگەزبوونەوە', class: 'cancel' },
        { text: 'سفرکردنەوە', class: 'danger', action: () => {
            data.players.forEach(p => { p.points = 0; p.wins = 0; p.losses = 0; p.gamesPlayed = 0; });
            data.yesterdayRanks = {};
            data.yesterdayState = null;
            saveData(); showToast('مانگ سفرکرایەوە!'); renderLeaderboard();
        }}
    ]);
});

document.getElementById('btnResetAll').addEventListener('click', () => {
    showModal('سفرکردنەوەی هەموو شتێک؟', 'هەموو ئامار و مێژووەکان دەسڕێنەوە.', [
        { text: 'پاشگەزبوونەوە', class: 'cancel' },
        { text: 'سفرکردنەوە', class: 'danger', action: () => {
            const playersMeta = data.players.map(p => ({ id: p.id, name: p.name, isHidden: p.isHidden }));
            data = getDefaultData();
            data.players = playersMeta.map((m, i) => ({ ...m, points: 0, wins: 0, losses: 0, gamesPlayed: 0 }));
            saveData(true); showToast('هەموو شتێک سفرکرایەوە!'); renderLeaderboard(); renderSettings();
        }}
    ]);
});

document.getElementById('btnResetAnnual').addEventListener('click', () => {
    showModal('سفرکردنەوەی ئامارەکان؟', 'هەموو مێژووی مانگەکانی پێشوو دەسڕێنەوە.', [
        { text: 'پاشگەزبوونەوە', class: 'cancel' },
        { text: 'سفرکردنەوە', class: 'danger', action: () => {
            data.monthlyResults = []; data.annualStats = {};
            saveData(); showToast('ئامارەکان سفرکرانەوە!'); renderAnnualPage();
        }}
    ]);
});

document.getElementById('btnAddPlayer').addEventListener('click', () => {
    const nextId = data.players.length > 0 ? Math.max(...data.players.map(p => p.id)) + 1 : 0;
    const num = data.players.length + 1;
    data.players.push({ id: nextId, name: 'Player ' + num, points: 0, wins: 0, losses: 0, gamesPlayed: 0, isHidden: false });
    saveData(true); showToast('Player added!'); renderSettings(); renderLeaderboard();
});

function togglePlayerVisibility(playerId) {
    const player = data.players.find(p => p.id === playerId);
    if (player) {
        player.isHidden = !player.isHidden;
        saveData();
        renderSettings();
        renderLeaderboard();
        if (typeof renderRecordPage === 'function') renderRecordPage();
    }
}

function deletePlayerPhoto(playerId) {
    const player = data.players.find(p => p.id === playerId);
    if (!player || !playerPhotos[player.id]) return;

    showModal('وێنەکە دەسڕیتەوە؟', 'وێنەی "' + player.name + '" دەسڕێتەوە؟', [
        { text: 'پاشگەزبوونەوە', class: 'cancel' },
        { text: 'سڕینەوە', class: 'danger', action: () => {
            delete playerPhotos[player.id];
            
            renderSettings();
            renderLeaderboard();
            if (typeof renderRecordPage === 'function') renderRecordPage();
            
            savePhotos(); 
            showToast('وێنەکە بەسەرکەوتوویی سڕایەوە!');
        }}
    ]);
}

function deletePlayer(playerId) {
    if (data.players.length <= 2) { showToast('Minimum 2 players required'); return; }
    const player = data.players.find(p => p.id === playerId);
    if (!player) return;
    showModal('Remove Player?', 'Remove "' + player.name + '"?', [
        { text: 'Cancel', class: 'cancel' },
        { text: 'Remove', class: 'danger', action: () => {
            data.players = data.players.filter(p => p.id !== playerId);
            saveData(); showToast(player.name + ' removed!'); renderSettings(); renderLeaderboard();
        }}
    ]);
}

// ===== LOGIN LOGIC =====
const AUTH_USER = "16188";
const AUTH_PASS = "16188";

function checkAuth() {
    if (sessionStorage.getItem('isLoggedIn') === 'true') {
        const loginScreen = document.getElementById('loginScreen');
        if (loginScreen) {
            loginScreen.style.opacity = '0';
            loginScreen.style.pointerEvents = 'none';
            loginScreen.style.zIndex = '-1'; // Send to back
            setTimeout(() => { loginScreen.style.display = 'none'; }, 500);
        }
        document.getElementById('btnLogout').style.display = 'flex';
        applyPermissions();
    }
}

function showAdminLogin() {
    document.getElementById('loginOptions').style.display = 'none';
    document.getElementById('adminLoginForm').style.display = 'flex';
    document.querySelector('.login-title').textContent = "زانیارییەکانی ئەدمین بنووسە";
}

function showLoginOptions() {
    document.getElementById('loginOptions').style.display = 'flex';
    document.getElementById('adminLoginForm').style.display = 'none';
    document.querySelector('.login-title').textContent = "چوونە ناو کێبڕکێ";
    document.querySelector('.login-subtitle').textContent = "ئاستی چوونە ناو دیاری بکە بۆ بەردەوامبوون";
}

function handleAdminLogin() {
    const user = document.getElementById('loginUser').value;
    const pass = document.getElementById('loginPass').value;
    const error = document.getElementById('loginError');

    if (user === AUTH_USER && pass === AUTH_PASS) {
        sessionStorage.setItem('isLoggedIn', 'true');
        sessionStorage.setItem('userRole', 'admin');
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('btnLogout').style.display = 'flex';
        applyPermissions();
        showToast("بەخێربێی، ئەدمین!");
    } else {
        error.textContent = "ناوی بەکارهێنەر یان وشەی نهێنی هەڵەیە";
        setTimeout(() => { error.textContent = ""; }, 3000);
    }
}

function handleViewerLogin() {
    sessionStorage.setItem('isLoggedIn', 'true');
    sessionStorage.setItem('userRole', 'viewer');
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('btnLogout').style.display = 'flex';
    applyPermissions();
    showToast("چوویتە ناو وەک بینەر");
}

function handleLogout() {
    sessionStorage.removeItem('isLoggedIn');
    sessionStorage.removeItem('userRole');
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('btnLogout').style.display = 'none';
    showLoginOptions();
    showToast("Logged out successfully");
}

function applyPermissions() {
    const role = sessionStorage.getItem('userRole');
    const tabs = document.querySelectorAll('.tab-item');
    
    if (role === 'viewer') {
        tabs.forEach(tab => {
            const t = tab.dataset.tab;
            if (t === 'record' || t === 'settings') {
                tab.style.display = 'none';
            }
        });
        // Hide admin-only buttons on visible pages
        const btnResetAnnual = document.getElementById('btnResetAnnual');
        if (btnResetAnnual) btnResetAnnual.style.display = 'none';
        
        // Hide historical record button
        const histBtn = document.querySelector('[onclick="openHistoricalPage()"]');
        if (histBtn) histBtn.parentElement.style.display = 'none';
        
        // If current page is forbidden, switch to leaderboard
        const activeTab = document.querySelector('.tab-item.active');
        if (activeTab && (activeTab.dataset.tab === 'record' || activeTab.dataset.tab === 'settings')) {
            document.querySelector('.tab-item[data-tab="leaderboard"]').click();
        }
    } else {
        tabs.forEach(tab => tab.style.display = 'flex');
        const btnResetAnnual = document.getElementById('btnResetAnnual');
        if (btnResetAnnual) btnResetAnnual.style.display = 'flex';
        
        const histBtn = document.querySelector('[onclick="openHistoricalPage()"]');
        if (histBtn) histBtn.parentElement.style.display = 'block';
    }
}

function openHistoricalPage() {
    document.getElementById('pageHistorical').classList.add('active');
    renderHistoricalSettings();
}

function closeHistoricalPage() {
    document.getElementById('pageHistorical').classList.remove('active');
    // Clear chips when closing
    document.querySelectorAll('.hist-chip input').forEach(cb => {
        cb.checked = false;
        cb.nextElementSibling.classList.remove('active');
    });
    // Reset highlight
    const select = document.getElementById('histMonth');
    const warning = document.getElementById('histWarning');
    if (select) {
        select.style.borderColor = 'rgba(0,0,0,0.1)';
        select.style.color = 'var(--text)';
    }
    if (warning) warning.style.opacity = '0';
}

function openManageMonthsPage() {
    document.getElementById('pageManageMonths').classList.add('active');
    renderManageMonths();
}

function closeManageMonthsPage() {
    document.getElementById('pageManageMonths').classList.remove('active');
}

function renderManageMonths() {
    const container = document.getElementById('monthsManagementList');
    if (data.monthlyResults.length === 0) {
        container.innerHTML = '<div class="no-data">No records found.</div>';
        return;
    }

    // Group by year
    const grouped = {};
    data.monthlyResults.forEach(res => {
        if (!grouped[res.year]) grouped[res.year] = [];
        grouped[res.year].push(res);
    });

    let html = '';
    // Show newest years first
    const years = Object.keys(grouped).sort((a, b) => b - a);
    
    years.forEach(year => {
        html += `<div class="year-group-section" style="margin-bottom: 24px;">
            <div style="font-size: 18px; font-weight: 800; color: var(--accent2); margin-bottom: 12px; padding-left: 4px; border-left: 4px solid var(--accent);">${year}</div>
            <div style="display: flex; flex-direction: column; gap: 8px;">`;
        
        // Show months in year (newest first)
        grouped[year].sort((a, b) => b.month - a.month).forEach(res => {
            const winners = res.winners.map(w => w.name).join(', ');
            html += `<div class="month-history-card" style="display:flex; justify-content:space-between; align-items:center; gap:12px; background: rgba(255,255,255,0.7); border: 1px solid rgba(0,0,0,0.05);">
                <div style="flex:1">
                    <div class="month-history-header" style="font-size: 13px;">${MONTHS[res.month]}</div>
                    <div class="month-history-winners" style="font-size:11px; color: var(--text3);">🥇 ${esc(winners)}</div>
                </div>
                <div style="display:flex; gap:8px;">
                    <button class="btn-photo" onclick="editMonth(${res.month}, ${res.year})" title="Edit" style="background:var(--accent); color:white; width: 34px; height: 34px;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button class="btn-delete-player" onclick="deleteMonth(${res.month}, ${res.year})" title="Delete" style="width: 34px; height: 34px;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                    </button>
                </div>
            </div>`;
        });
        
        html += `</div></div>`;
    });
    container.innerHTML = html;
}

function deleteMonth(m, y) {
    showModal('Delete Record?', `Permanently delete the record for ${MONTHS[m]} ${y}?`, [
        { text: 'Cancel', class: 'cancel' },
        { text: 'Delete', class: 'danger', action: () => {
            data.monthlyResults = data.monthlyResults.filter(r => !(r.month === m && r.year === y));
            saveData();
            showToast('Month deleted!');
            renderManageMonths();
            renderAnnualPage();
        }}
    ]);
}

function editMonth(m, y) {
    const res = data.monthlyResults.find(r => r.month === m && r.year === y);
    if (!res) return;

    // Open historical page
    openHistoricalPage();
    
    // Set year and month
    document.getElementById('histYear').value = y;
    document.getElementById('histMonth').value = m;

    // Reset all chips first
    document.querySelectorAll('.hist-chip input').forEach(cb => {
        cb.checked = false;
        cb.nextElementSibling.classList.remove('active');
    });

    // Helper to check chips for a rank
    const checkChips = (rankKey, winnerList) => {
        if (!winnerList) return;
        winnerList.forEach(w => {
            const player = data.players.find(p => p.name === w.name);
            if (player) {
                const cb = document.querySelector(`input[name="rank${rankKey}"][value="${player.id}"]`);
                if (cb) {
                    cb.checked = true;
                    cb.nextElementSibling.classList.add('active');
                }
            }
        });
    };

    checkChips('1', res.winners);
    checkChips('2', res.second);
    checkChips('3', res.third);
    checkChips('4', res.fourth);
    checkChips('5', res.fifth);
    checkChips('6', res.sixth);
    checkChips('7', res.seventh);
    checkChips('8', res.eighth);
    checkChips('9', res.ninth);
}

// ===== INIT =====
checkAuth();
renderLeaderboard();
renderSettings();

async function generateWinnerImage() {
    const sorted = getSortedPlayers().filter(p => p.gamesPlayed > 0);
    if (sorted.length === 0) { showToast("No players found!"); return; }
    
    document.getElementById('winnerMonthLabel').textContent = MONTHS[data.currentMonth] + ' ' + data.currentYear;
    
    const podium = document.getElementById('winnerPodium');
    const top3 = sorted.slice(0, 3);
    const podiumOrder = top3.length >= 2 ? (top3.length >= 3 ? [top3[1], top3[0], top3[2]] : [top3[1], top3[0]]) : top3;
    const podiumRanks = top3.length >= 2 ? (top3.length >= 3 ? [2, 1, 3] : [2, 1]) : [1];
    
    let pHTML = '';
    podiumOrder.forEach((p, i) => {
        const rank = podiumRanks[i];
        const size = rank === 1 ? 120 : 95;
        const color = rank === 1 ? '#FFD700' : rank === 2 ? '#C0C0C0' : '#CD7F32';
        const playerPhoto = playerPhotos[p.id];
        const img = playerPhoto ? `background-image:url(${playerPhoto})` : `background:linear-gradient(135deg, ${color}, #fff)`;
        
        pHTML += `
            <div style="display:flex; flex-direction:column; align-items:center; gap:10px; width:110px;">
                <div style="width:${size}px; height:${size}px; border-radius:50%; border:5px solid ${color}; ${img}; background-size:cover; background-position:center; box-shadow:0 10px 30px rgba(0,0,0,0.5); position:relative;">
                    <div style="position:absolute; bottom:-12px; left:50%; transform:translateX(-50%); background:${color}; color:#000; padding:2px 12px; border-radius:12px; font-weight:900; font-size:16px; border:2px solid #0d1127;">${rank}</div>
                </div>
                <div style="font-weight:900; font-size:18px; margin-top:15px; text-shadow: 0 2px 4px rgba(0,0,0,0.5);">${esc(p.name)}</div>
                <div style="font-size:28px; font-weight:900; color:${color}; text-shadow: 0 2px 10px rgba(0,0,0,0.3);">${p.points}+</div>
            </div>
        `;
    });
    podium.innerHTML = pHTML;
    
    const rest = document.getElementById('winnerRestList');
    let rHTML = '';
    sorted.slice(3).forEach((p, i) => {
        rHTML += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 20px; background:rgba(255,255,255,0.08); border-radius:15px; border:1px solid rgba(255,255,255,0.1); margin-bottom:5px;">
                <span style="font-weight:900; color:#FFD700; font-size:18px;">${p.points} خاڵ</span>
                <span style="font-weight:700; font-size:16px;">${esc(p.name)}</span>
            </div>
        `;
    });
    rest.innerHTML = rHTML;
    
    const fw = document.getElementById('winnerFireworks');
    fw.innerHTML = '';
    for(let i=0; i<30; i++) {
        const dot = document.createElement('div');
        const x = Math.random() * 100;
        const y = Math.random() * 100;
        const c = ['#FFD700', '#FF4500', '#00FF00', '#00BFFF', '#FF00FF'][Math.floor(Math.random()*5)];
        dot.style.position = 'absolute';
        dot.style.left = x + '%';
        dot.style.top = y + '%';
        dot.style.width = '3px';
        dot.style.height = '3px';
        dot.style.background = c;
        dot.style.borderRadius = '50%';
        dot.style.boxShadow = `0 0 10px ${c}, 0 0 20px ${c}`;
        fw.appendChild(dot);
    }

    const container = document.getElementById('winnerShareContainer');
    showToast("دیزاین کردنی وێنەکە...");
    
    setTimeout(async () => {
        try {
            const canvas = await html2canvas(container, {
                backgroundColor: '#0d1127',
                scale: 3,
                useCORS: true,
                logging: false
            });
            const imgData = canvas.toDataURL('image/png');
            document.getElementById('sharePreview').innerHTML = `<img src="${imgData}" style="width:100%; display:block;">`;
            document.getElementById('shareOverlay').classList.add('active');
        } catch(e) {
            console.error(e);
            showToast("Error generating image.");
        }
    }, 600);
}
// ===== ANONYMOUS CHAT =====
const myChatId = () => {
    let id = localStorage.getItem('myChatId');
    if (!id) {
        id = 'anon_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('myChatId', id);
    }
    return id;
};

function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text || !chatRef) return;

    const msg = {
        sender: myChatId(),
        text: text,
        timestamp: Date.now()
    };

    chatRef.push(msg);
    input.value = '';
}

let selectedChatIds = new Set();

function renderChatPage() {
    const container = document.getElementById('chatContainer');
    if (!container) return;
    const isAdmin = sessionStorage.getItem('userRole') === 'admin';
    const deleteBtn = document.getElementById('btnDeleteSelectedChat');
    const adminActionsBtn = document.getElementById('btnAdminChatActions');
    
    if (deleteBtn) deleteBtn.style.display = (isAdmin && selectedChatIds.size > 0) ? 'block' : 'none';
    if (adminActionsBtn) adminActionsBtn.style.display = isAdmin ? 'block' : 'none';

    const now = Date.now();
    const limit = 24 * 60 * 60 * 1000; 

    // Get messages as entries so we have the Firebase IDs
    const entries = Object.entries(chatMessages)
        .filter(([id, m]) => (now - m.timestamp) < limit)
        .sort((a, b) => a[1].timestamp - b[1].timestamp);

    let html = '';
    const myId = myChatId();

    entries.forEach(([id, m]) => {
        const isMine = m.sender === myId;
        const isSelected = selectedChatIds.has(id);
        const timeStr = new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const adminCheckbox = isAdmin ? `
            <div style="margin-left: 8px; display:flex; align-items:center;">
                <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleChatMessageSelection('${id}')" style="width:16px; height:16px;">
            </div>
        ` : '';

        html += `
            <div style="display:flex; align-items:center; ${isMine ? 'flex-direction:row-reverse' : ''}">
                <div class="chat-bubble ${isMine ? 'mine' : ''}" onclick="${isAdmin ? `toggleChatMessageSelection('${id}')` : ''}" style="cursor:${isAdmin ? 'pointer' : 'default'}">
                    <div style="font-size: 14px;">${esc(m.text)}</div>
                    <div class="chat-time">${timeStr}</div>
                </div>
                ${adminCheckbox}
            </div>
        `;
    });

    if (entries.length === 0) {
        html = `<div class="no-data">هیچ نامەیەک نییە لێرە...<br>یەکەم نامە بنووسە!</div>`;
    }

    container.innerHTML = html;
    // Only scroll to bottom if user is not selecting or if it's the first render
    if (selectedChatIds.size === 0) {
        container.scrollTop = container.scrollHeight;
    }
}

function toggleChatMessageSelection(id) {
    if (selectedChatIds.has(id)) selectedChatIds.delete(id);
    else selectedChatIds.add(id);
    renderChatPage();
}

function deleteSelectedMessages() {
    if (!chatRef || selectedChatIds.size === 0) return;
    
    selectedChatIds.forEach(id => {
        chatRef.child(id).remove();
    });
    
    selectedChatIds.clear();
    showToast('نامەکان سڕانەوە');
}

function toggleAdminChatMenu() {
    const menu = document.getElementById('adminChatMenu');
    if (menu) menu.style.display = (menu.style.display === 'none') ? 'block' : 'none';
}

function setChatLock(locked) {
    if (!chatStatusRef) return;
    chatStatusRef.set({ isLocked: locked });
    showToast(locked ? "چات داخرا" : "چات کرایەوە");
    toggleAdminChatMenu();
}

function clearAllChat() {
    if (!chatRef) return;
    showModal('سڕینەوەی هەموو نامەکان؟', 'هەموو مێژووی چاتەکە دەسڕێتەوە و ناگەڕێتەوە.', [
        { text: 'پاشگەزبوونەوە', class: 'cancel' },
        { text: 'سڕینەوەی هەموو', class: 'danger', action: () => {
            chatRef.set(null);
            showToast('چاتەکە پاککرایەوە');
            toggleAdminChatMenu();
        }}
    ]);
}

function updateChatUIStatus() {
    const isAdmin = sessionStorage.getItem('userRole') === 'admin';
    const input = document.getElementById('chatInput');
    const adminBtn = document.getElementById('btnAdminChatActions');
    
    if (adminBtn) adminBtn.style.display = isAdmin ? 'block' : 'none';
    
    if (input) {
        if (chatStatus.isLocked && !isAdmin) {
            input.disabled = true;
            input.placeholder = "چات لەلایەن ئەدمینەوە داخراوە...";
        } else {
            input.disabled = false;
            input.placeholder = "نامەیەک بنووسە...";
        }
    }
}

function manualSync() {
    if (sessionStorage.getItem('userRole') !== 'admin') {
        showToast("تەنها ئەدمین دەتوانێت پاشەکەوت بکات");
        return;
    }
    saveData(true); // Force immediate sync
    showToast("هەموو خاڵەکان پاشەکەوت کران! ✅");
}

// ===== BACKUP & RESTORE =====
function exportData() {
    const backup = {
        timestamp: new Date().toISOString(),
        version: "1.2",
        competitionData: data,
        playerPhotos: playerPhotos
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `competition_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("داتاکە بەسەرکەوتوویی پاشەکەوت کرا! 📥");
}

function triggerImport() {
    if (sessionStorage.getItem('userRole') !== 'admin') {
        showToast("تەنها ئەدمین دەتوانێت داتا بگەرێنێتەوە");
        return;
    }
    document.getElementById('importFileInput').click();
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const backup = JSON.parse(e.target.result);
            if (!backup.competitionData) {
                throw new Error("Invalid backup file structure");
            }

            showModal('گەڕانەوەی داتا؟', 'ئایا دڵنیایت لە گەڕانەوەی ئەم داتایە؟ هەموو زانیارییەکانی ئێستا دەسڕێنەوە و ئەم داتایە جێگەیان دەگرێتەوە.', [
                { text: 'پاشگەزبوونەوە', class: 'cancel' },
                { text: 'بەڵێ، گەڕانەوە', class: 'danger', action: () => {
                    // Update main data
                    data = normalizeData(backup.competitionData);
                    
                    // Update photos if present in backup
                    if (backup.playerPhotos) {
                        playerPhotos = backup.playerPhotos;
                    }
                    
                    // Important: Mark load as done so we can push to Firebase
                    isInitialLoadDone = true; 
                    
                    // Save everything
                    saveData(true);
                    savePhotos();
                    
                    showToast("داتاکە بەسەرکەوتوویی گەڕایەوە! 📤");
                    
                    // Refresh UI
                    renderLeaderboard();
                    renderSettings();
                    renderAnnualPage();
                    renderRankingsPage();
                    
                    // Reset file input
                    event.target.value = '';
                }}
            ]);
        } catch (err) {
            console.error("Import Error:", err);
            showToast("هەڵەیەک لە فایلی پاشەکەوتەکەدا هەیە!");
            event.target.value = '';
        }
    };
    reader.readAsText(file);
}
