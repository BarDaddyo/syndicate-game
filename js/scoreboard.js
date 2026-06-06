// Scoreboard view — real-time, designed for projection

const TOTAL_TEAMS = 23;
const MAIN_ROUND_DURATION = 480;

let gameState = null;
let allTeams = [];
let allSubmissions = [];
let playerCount = 0;
let timerInterval = null;
let shownWildcardWinners = new Set();
let wildcardQueue = [];
let wildcardShowing = false;

async function init() {
  const [gsRes, teamsRes, subsRes, countRes] = await Promise.all([
    db.from('game_state').select('*').eq('id', 1).single(),
    db.from('teams').select('*').order('score', { ascending: false }),
    db.from('submissions').select('*'),
    db.from('players').select('*', { count: 'exact', head: true })
  ]);

  gameState = gsRes.data;
  allTeams = teamsRes.data || [];
  allSubmissions = subsRes.data || [];
  playerCount = countRes.count || 0;

  // Pre-load wildcard winners so we don't re-show them on reconnect
  if (gameState && Array.isArray(gameState.wildcard_winners)) {
    gameState.wildcard_winners.forEach(w => shownWildcardWinners.add(w.team_number));
  }

  render();
  subscribeToChanges();
}

function subscribeToChanges() {
  db.channel('sb-channel')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_state', filter: 'id=eq.1' }, payload => {
      const prev = gameState;
      gameState = payload.new;

      // Detect new wildcard winners
      const newWinners = Array.isArray(gameState.wildcard_winners) ? gameState.wildcard_winners : [];
      newWinners.forEach(w => {
        if (!shownWildcardWinners.has(w.team_number)) {
          shownWildcardWinners.add(w.team_number);
          wildcardQueue.push(w);
        }
      });

      render();
      processWildcardQueue();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, payload => {
      const idx = allTeams.findIndex(t => t.team_number === payload.new.team_number);
      if (idx >= 0) allTeams[idx] = payload.new;
      else allTeams.push(payload.new);
      allTeams.sort((a, b) => b.score - a.score);
      renderLeaderboard();
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'submissions' }, payload => {
      allSubmissions.push(payload.new);
      renderSubmissionIndicators();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, async () => {
      const { count } = await db.from('players').select('*', { count: 'exact', head: true });
      playerCount = count || 0;
      const el = document.getElementById('sb-player-count');
      if (el) el.textContent = playerCount;
    })
    .subscribe();
}

// ─── Main render ──────────────────────────────────────────

function render() {
  stopTimer();
  const page = document.getElementById('scoreboard-page');
  if (!gameState) return;

  if (gameState.current_round === 0) {
    page.innerHTML = renderLobby();
    return;
  }

  const round = GAME_DATA.rounds.find(r => r.roundNumber === gameState.current_round);
  if (!round) return;

  switch (gameState.round_status) {
    case 'waiting':
      page.innerHTML = renderRoundWaiting(round);
      break;
    case 'active':
      page.innerHTML = renderRoundActive(round);
      attachTimerIfNeeded(round);
      break;
    case 'closed':
      page.innerHTML = renderRoundClosed(round);
      break;
    case 'revealed':
      page.innerHTML = renderRoundRevealed(round);
      break;
  }
}

// ─── Lobby ────────────────────────────────────────────────

function renderLobby() {
  return `
    <div class="sb-lobby">
      <div class="sb-game-title">THE<br>SYNDICATE</div>
      <div class="sb-lobby-subtitle">Team Intelligence Challenge</div>
      <div class="sb-player-count">
        <span class="num" id="sb-player-count">${playerCount}</span> players have joined
      </div>
    </div>
  `;
}

// ─── Round waiting ────────────────────────────────────────

function renderRoundWaiting(round) {
  const typeBadge = round.type === 'wildcard'
    ? `<span class="badge badge-wildcard">WILDCARD ROUND</span>`
    : `<span class="badge badge-accent">MAIN ROUND</span>`;

  return `
    <div class="sb-active">
      <div class="sb-round-bar">
        <div class="sb-round-label">ROUND ${round.roundNumber} ${typeBadge}</div>
        <div class="sb-timer no-timer">STAND BY</div>
      </div>
      <div class="sb-question-text">${escHtml(round.question)}</div>
      <div style="margin-top:auto; color:var(--text-dim); font-family:'Barlow Condensed',sans-serif; font-size:1.2rem; letter-spacing:0.12em; display:flex; align-items:center; gap:10px;">
        <span class="pulse-dot"></span>
        Round opening soon — check your phones
      </div>
    </div>
  `;
}

// ─── Round active ─────────────────────────────────────────

function renderRoundActive(round) {
  const typeBadge = round.type === 'wildcard'
    ? `<span class="badge badge-wildcard">WILDCARD</span>`
    : `<span class="badge badge-accent">MAIN ROUND</span>`;

  let timerHtml = '';
  if (round.type === 'main') {
    timerHtml = `<div class="sb-timer" id="sb-timer">8:00</div>`;
  } else {
    timerHtml = `<div class="sb-timer no-timer" style="display:flex;align-items:center;gap:12px;"><span class="pulse-dot"></span>OPEN</div>`;
  }

  const roundSubs = allSubmissions.filter(s => s.round_number === gameState.current_round);
  const submittedTeams = new Set(roundSubs.map(s => s.team_number));
  const count = submittedTeams.size;

  let subGrid = '';
  for (let t = 1; t <= TOTAL_TEAMS; t++) {
    const done = submittedTeams.has(t);
    subGrid += `<div class="sb-sub-item ${done ? 'submitted' : ''}">T${t}${done ? ' ✓' : ''}</div>`;
  }

  return `
    <div class="sb-active">
      <div class="sb-round-bar">
        <div class="sb-round-label">ROUND ${round.roundNumber} ${typeBadge}</div>
        ${timerHtml}
      </div>
      <div class="sb-question-text">${escHtml(round.question)}</div>
      <div>
        <div class="sb-subs-label">${count} / ${TOTAL_TEAMS} teams submitted</div>
        <div class="sb-submissions-grid" id="sb-sub-grid">${subGrid}</div>
      </div>
    </div>
  `;
}

function renderSubmissionIndicators() {
  const grid = document.getElementById('sb-sub-grid');
  if (!grid || !gameState) return;

  const roundSubs = allSubmissions.filter(s => s.round_number === gameState.current_round);
  const submittedTeams = new Set(roundSubs.map(s => s.team_number));

  const items = grid.querySelectorAll('.sb-sub-item');
  items.forEach((el, idx) => {
    const team = idx + 1;
    if (submittedTeams.has(team) && !el.classList.contains('submitted')) {
      el.classList.add('submitted');
      el.textContent = `T${team} ✓`;
    }
  });

  const label = document.querySelector('.sb-subs-label');
  if (label) label.textContent = `${submittedTeams.size} / ${TOTAL_TEAMS} teams submitted`;
}

function attachTimerIfNeeded(round) {
  if (round.type !== 'main' || !gameState.round_start_time) return;
  startTimer(gameState.round_start_time);
}

// ─── Round closed ─────────────────────────────────────────

function renderRoundClosed(round) {
  return `
    <div class="sb-active">
      <div class="sb-round-bar">
        <div class="sb-round-label">ROUND ${round.roundNumber}</div>
        <div class="sb-timer no-timer">CLOSED</div>
      </div>
      <div class="sb-question-text">${escHtml(round.question)}</div>
      <div style="margin-top:auto; color:var(--text-dim); font-family:'Barlow Condensed',sans-serif; font-size:1.4rem; letter-spacing:0.12em; display:flex; align-items:center; gap:12px;">
        <span class="pulse-dot"></span>
        Submissions closed — answer reveal incoming
      </div>
    </div>
  `;
}

// ─── Round revealed ───────────────────────────────────────

function buildLeaderboardItem(team, rank, round) {
  const rankClass = rank <= 3 ? `rank-${rank}` : '';
  const rankSpanClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';

  const sub = allSubmissions.find(s => s.round_number === round.roundNumber && s.team_number === team.team_number);
  const roundPts = sub && sub.points_awarded !== null ? sub.points_awarded : null;
  const submittedAnswer = sub ? formatNumber(sub.answer) : '—';
  const roundPtsHtml = roundPts !== null ? `+${roundPts}` : '';

  return `
    <div class="sb-lb-item ${rankClass}" data-team="${team.team_number}">
      <div class="sb-lb-rank ${rankSpanClass}">${rank}</div>
      <div class="sb-lb-team">Team ${team.team_number}</div>
      <div class="sb-lb-submitted">${submittedAnswer}</div>
      <div class="sb-lb-round-pts">${roundPtsHtml}</div>
      <div class="sb-lb-total">${team.score}</div>
    </div>
  `;
}

function renderRoundRevealed(round) {
  const sorted = [...allTeams].sort((a, b) => b.score - a.score);
  const lbHtml = sorted.map((team, idx) => buildLeaderboardItem(team, idx + 1, round)).join('');

  return `
    <div class="sb-revealed">
      <div class="sb-answer-panel">
        <div class="sb-round-label-sm">Round ${round.roundNumber} — Answer</div>
        <div class="sb-correct-label">CORRECT ANSWER</div>
        <div class="sb-correct-answer">${formatNumber(round.answer)}</div>
        ${round.type === 'main' ? `
          <div style="margin-top:16px;">
            <div style="color:var(--text-dim); font-family:'Barlow Condensed',sans-serif; font-size:0.85rem; font-weight:700; letter-spacing:0.15em; text-transform:uppercase; margin-bottom:8px;">Scoring</div>
            <div style="color:var(--text-mid); font-size:0.9rem; line-height:1.8;">
              Within 10%: <strong style="color:var(--success)">10 pts</strong><br>
              Within 25%: <strong style="color:#ffaa00">5 pts</strong><br>
              Outside 25%: <strong style="color:var(--text-dim)">0 pts</strong>
            </div>
          </div>
        ` : ''}
      </div>
      <div class="sb-leaderboard-panel">
        <div style="display:grid; grid-template-columns: 44px 1fr auto auto auto; gap:12px; padding:0 16px 8px; font-family:'Barlow Condensed',sans-serif; font-size:0.75rem; font-weight:700; letter-spacing:0.15em; text-transform:uppercase; color:var(--text-dim);">
          <div></div>
          <div>Team</div>
          <div style="text-align:right;">Submitted</div>
          <div style="text-align:right;">This Round</div>
          <div style="text-align:right;">Total</div>
        </div>
        <div class="sb-leaderboard" id="sb-leaderboard">${lbHtml}</div>
      </div>
    </div>
  `;
}

function renderLeaderboard() {
  const lb = document.getElementById('sb-leaderboard');
  if (!lb) return;

  // FLIP animation — capture positions before update
  const items = lb.querySelectorAll('.sb-lb-item');
  const oldPositions = {};
  items.forEach(el => {
    if (el.dataset.team) oldPositions[el.dataset.team] = el.getBoundingClientRect().top;
  });

  const sorted = [...allTeams].sort((a, b) => b.score - a.score);
  const round = GAME_DATA.rounds.find(r => r.roundNumber === gameState?.current_round);
  lb.innerHTML = sorted.map((team, idx) => buildLeaderboardItem(team, idx + 1, round)).join('');

  // Animate new positions
  const newItems = lb.querySelectorAll('.sb-lb-item');
  newItems.forEach(el => {
    const team = el.dataset.team;
    const oldTop = oldPositions[team];
    if (oldTop !== undefined) {
      const newTop = el.getBoundingClientRect().top;
      const delta = oldTop - newTop;
      if (Math.abs(delta) > 1) {
        el.style.transform = `translateY(${delta}px)`;
        el.style.transition = 'none';
        requestAnimationFrame(() => {
          el.style.transition = 'transform 0.5s cubic-bezier(0.34, 1.10, 0.64, 1)';
          el.style.transform = 'translateY(0)';
        });
      }
    } else {
      // New item — flash in
      el.classList.add('score-updated');
      setTimeout(() => el.classList.remove('score-updated'), 1000);
    }
  });
}

// ─── Wildcard overlay ─────────────────────────────────────

function processWildcardQueue() {
  if (wildcardShowing || wildcardQueue.length === 0) return;
  showNextWildcard();
}

function showNextWildcard() {
  if (wildcardQueue.length === 0) { wildcardShowing = false; return; }
  wildcardShowing = true;

  const winner = wildcardQueue.shift();
  const overlay = document.getElementById('wildcard-overlay');
  const posLabels = ['', '1ST PLACE', '2ND PLACE', '3RD PLACE'];
  const pts = [0, 15, 10, 5][winner.position];
  const posClass = `pos-${winner.position}`;

  overlay.innerHTML = `
    <div class="wc-position">${posLabels[winner.position]}</div>
    <div class="wc-team ${posClass}">TEAM ${winner.team_number}</div>
    <div class="wc-label">scores on the wildcard</div>
    <div class="wc-points ${posClass}">+${pts} PTS</div>
  `;

  overlay.style.display = 'flex';
  overlay.className = 'wildcard-overlay active';

  setTimeout(() => {
    overlay.className = 'wildcard-overlay exit';
    setTimeout(() => {
      overlay.style.display = 'none';
      overlay.className = 'wildcard-overlay';
      wildcardShowing = false;
      // Slight gap before showing next
      setTimeout(processWildcardQueue, 600);
    }, 500);
  }, 5000);
}

// ─── Timer ───────────────────────────────────────────────

function startTimer(startTimeStr) {
  stopTimer();
  const timerEl = document.getElementById('sb-timer');
  if (!timerEl) return;

  function tick() {
    const elapsed = Date.now() - new Date(startTimeStr).getTime();
    const remaining = Math.max(0, MAIN_ROUND_DURATION * 1000 - elapsed);
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    timerEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    timerEl.className = `sb-timer ${remaining < 60000 && remaining > 0 ? 'danger' : ''}`;
    if (remaining === 0) { stopTimer(); timerEl.textContent = '0:00'; }
  }

  tick();
  timerInterval = setInterval(tick, 1000);
}

function stopTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

// ─── Utilities ────────────────────────────────────────────

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

init();
