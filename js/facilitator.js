// Facilitator control panel

const FAC_PASSWORD = 'syndicate2025';
const TOTAL_TEAMS = 23;
const MAIN_ROUND_DURATION = 480; // seconds

let gameState = null;
let allTeams = [];
let allSubmissions = [];
let allPlayers = [];
let timerInterval = null;
let roundJustScored = new Set(); // track which teams had score changes this reveal

// ─── Auth ─────────────────────────────────────────────────

document.getElementById('auth-btn').addEventListener('click', authenticate);
document.getElementById('fac-password').addEventListener('keydown', e => { if (e.key === 'Enter') authenticate(); });

function authenticate() {
  const pw = document.getElementById('fac-password').value;
  const errEl = document.getElementById('auth-error');
  if (pw === FAC_PASSWORD) {
    document.getElementById('auth-gate').style.display = 'none';
    document.getElementById('fac-panel').style.display = 'flex';
    initFacilitator();
  } else {
    errEl.textContent = 'Incorrect password.';
    errEl.classList.add('visible');
    document.getElementById('fac-password').value = '';
    document.getElementById('fac-password').focus();
  }
}

// ─── Init ─────────────────────────────────────────────────

async function initFacilitator() {
  const [gsRes, teamsRes, subsRes, playersRes] = await Promise.all([
    db.from('game_state').select('*').eq('id', 1).single(),
    db.from('teams').select('*').order('score', { ascending: false }),
    db.from('submissions').select('*'),
    db.from('players').select('*')
  ]);

  gameState = gsRes.data;
  allTeams = teamsRes.data || [];
  allSubmissions = subsRes.data || [];
  allPlayers = playersRes.data || [];

  renderAll();
  subscribeToChanges();
  wireButtons();
}

function subscribeToChanges() {
  db.channel('fac-channel')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_state', filter: 'id=eq.1' }, payload => {
      gameState = payload.new;
      renderAll();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions' }, async payload => {
      if (payload.eventType === 'INSERT') {
        allSubmissions.push(payload.new);
        // Check for wildcard scoring
        if (gameState && gameState.round_status === 'active') {
          const round = GAME_DATA.rounds.find(r => r.roundNumber === gameState.current_round);
          if (round && round.type === 'wildcard') {
            await processWildcardSubmission(payload.new);
          }
        }
      } else if (payload.eventType === 'UPDATE') {
        const idx = allSubmissions.findIndex(s => s.id === payload.new.id);
        if (idx >= 0) allSubmissions[idx] = payload.new;
        else allSubmissions.push(payload.new);
      }
      renderSubmissions();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, payload => {
      const idx = allTeams.findIndex(t => t.team_number === payload.new.team_number);
      if (idx >= 0) allTeams[idx] = payload.new;
      else allTeams.push(payload.new);
      allTeams.sort((a, b) => b.score - a.score);
      renderLeaderboard();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, payload => {
      const idx = allPlayers.findIndex(p => p.id === payload.new.id);
      if (payload.eventType === 'DELETE') {
        allPlayers = allPlayers.filter(p => p.id !== payload.old.id);
      } else if (idx >= 0) {
        allPlayers[idx] = payload.new;
      } else {
        allPlayers.push(payload.new);
      }
      document.getElementById('status-players').textContent = allPlayers.length;
    })
    .subscribe();
}

// ─── Button wiring ────────────────────────────────────────

function wireButtons() {
  document.getElementById('btn-start-game').addEventListener('click', handleStartGame);
  document.getElementById('btn-open-round').addEventListener('click', handleOpenRound);
  document.getElementById('btn-close-round').addEventListener('click', handleCloseRound);
  document.getElementById('btn-reveal').addEventListener('click', handleReveal);
  document.getElementById('btn-next-round').addEventListener('click', handleNextRound);
  document.getElementById('btn-reset').addEventListener('click', handleReset);
}

// ─── Game flow handlers ───────────────────────────────────

async function handleStartGame() {
  if (!confirm('Start the game? This will advance from the lobby to Round 1.')) return;
  setAllBtnsLoading();

  await db.from('game_state').update({
    current_round: 1,
    round_status: 'waiting',
    round_start_time: null,
    wildcard_winners: []
  }).eq('id', 1);
}

async function handleOpenRound() {
  if (!gameState || gameState.round_status !== 'waiting') return;
  setAllBtnsLoading();

  const roundNumber = gameState.current_round;
  const round = GAME_DATA.rounds.find(r => r.roundNumber === roundNumber);

  // Assign constraints to all players
  await assignConstraints(roundNumber);

  const now = new Date().toISOString();
  const updates = { round_status: 'active', round_start_time: null, wildcard_winners: [] };
  if (round.type === 'main') updates.round_start_time = now;

  await db.from('game_state').update(updates).eq('id', 1);
}

async function handleCloseRound() {
  if (!gameState || gameState.round_status !== 'active') return;
  setAllBtnsLoading();
  await db.from('game_state').update({ round_status: 'closed' }).eq('id', 1);
}

async function handleReveal() {
  if (!gameState || gameState.round_status !== 'closed') return;
  setAllBtnsLoading();

  const round = GAME_DATA.rounds.find(r => r.roundNumber === gameState.current_round);
  roundJustScored.clear();

  if (round.type === 'main') {
    await scoreMainRound(round);
  }
  // For wildcard, scoring already happened in real-time; just reveal
  await db.from('game_state').update({ round_status: 'revealed' }).eq('id', 1);
}

async function handleNextRound() {
  if (!gameState || gameState.round_status !== 'revealed') return;

  const nextRound = gameState.current_round + 1;
  if (nextRound > 7) {
    if (!confirm('All 7 rounds complete! Advance to show the final state?')) return;
  }

  setAllBtnsLoading();
  await db.from('game_state').update({
    current_round: nextRound > 7 ? 7 : nextRound,
    round_status: nextRound > 7 ? 'revealed' : 'waiting',
    round_start_time: null,
    wildcard_winners: []
  }).eq('id', 1);
}

async function handleReset() {
  if (!confirm('RESET GAME? This will delete ALL players, submissions, and scores. This cannot be undone.')) return;
  if (!confirm('Are you absolutely sure? All data will be wiped.')) return;
  setAllBtnsLoading();

  await Promise.all([
    db.from('submissions').delete().neq('id', '00000000-0000-0000-0000-000000000000'), // delete all
    db.from('players').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  ]);
  await db.from('teams').update({ score: 0 }).neq('team_number', 0);
  await db.from('game_state').update({
    current_round: 0,
    round_status: 'waiting',
    round_start_time: null,
    wildcard_winners: []
  }).eq('id', 1);

  allSubmissions = [];
  allPlayers = [];
}

function setAllBtnsLoading() {
  ['btn-start-game', 'btn-open-round', 'btn-close-round', 'btn-reveal', 'btn-next-round']
    .forEach(id => { document.getElementById(id).disabled = true; });
}

// ─── Constraint assignment ────────────────────────────────

async function assignConstraints(roundNumber) {
  if (!allPlayers.length) return;

  const teamSizeMap = {};
  allTeams.forEach(t => { teamSizeMap[t.team_number] = t.size; });

  const updates = allPlayers.map(p => ({
    id: p.id,
    name: p.name,
    team_number: p.team_number,
    team_position: p.team_position,
    constraint_role: getConstraintForRound(p.team_position, roundNumber, teamSizeMap[p.team_number] || 6)
  }));

  // Batch in chunks of 50
  for (let i = 0; i < updates.length; i += 50) {
    await db.from('players').upsert(updates.slice(i, i + 50));
  }
}

// ─── Main round scoring ───────────────────────────────────

async function scoreMainRound(round) {
  const { answer, fullPointsRange, halfPointsRange } = round;

  const roundSubs = allSubmissions.filter(s =>
    s.round_number === round.roundNumber && s.points_awarded === null
  );

  // Refresh team scores before calculating
  const { data: freshTeams } = await db.from('teams').select('*');
  const scoreMap = {};
  (freshTeams || []).forEach(t => { scoreMap[t.team_number] = t.score; });

  for (const sub of roundSubs) {
    const ratio = Math.abs(Number(sub.answer) - answer) / answer;
    const points = ratio <= fullPointsRange ? 10 : ratio <= halfPointsRange ? 5 : 0;

    const teamScore = (scoreMap[sub.team_number] || 0) + points;
    scoreMap[sub.team_number] = teamScore;

    await Promise.all([
      db.from('submissions').update({ points_awarded: points }).eq('id', sub.id),
      db.from('teams').update({ score: teamScore }).eq('team_number', sub.team_number)
    ]);

    if (points > 0) roundJustScored.add(sub.team_number);
  }

  // Update local cache
  const { data: updatedSubs } = await db.from('submissions').select('*').eq('round_number', round.roundNumber);
  if (updatedSubs) {
    updatedSubs.forEach(s => {
      const idx = allSubmissions.findIndex(x => x.id === s.id);
      if (idx >= 0) allSubmissions[idx] = s; else allSubmissions.push(s);
    });
  }
}

// ─── Wildcard scoring ─────────────────────────────────────

async function processWildcardSubmission(submission) {
  const round = GAME_DATA.rounds.find(r => r.roundNumber === gameState.current_round);
  if (!round || round.type !== 'wildcard') return;

  const winners = Array.isArray(gameState.wildcard_winners) ? gameState.wildcard_winners : [];
  if (winners.length >= 3) return;

  // Already awarded?
  if (submission.points_awarded !== null) return;
  if (winners.some(w => w.team_number === submission.team_number)) return;

  const diff = Math.abs(Number(submission.answer) - round.answer) / round.answer;
  if (diff > 0.10) return;

  const position = winners.length + 1;
  const points = position === 1 ? 15 : position === 2 ? 10 : 5;

  // Award points
  const { data: team } = await db.from('teams').select('score').eq('team_number', submission.team_number).single();
  const newScore = (team ? team.score : 0) + points;

  await Promise.all([
    db.from('submissions').update({ points_awarded: points }).eq('id', submission.id),
    db.from('teams').update({ score: newScore }).eq('team_number', submission.team_number)
  ]);

  const newWinner = { team_number: submission.team_number, position, points, answer: Number(submission.answer) };
  const newWinners = [...winners, newWinner];

  await db.from('game_state').update({ wildcard_winners: newWinners }).eq('id', 1);

  // Add to wildcard feed
  addWildcardFeedItem(newWinner);
}

// ─── Render ───────────────────────────────────────────────

function renderAll() {
  renderStatus();
  renderButtons();
  renderRoundInfo();
  renderSubmissions();
  renderLeaderboard();
  renderTimer();
}

function renderStatus() {
  if (!gameState) return;
  const round = gameState.current_round;
  const status = gameState.round_status;

  document.getElementById('status-round').textContent = round === 0 ? 'Lobby' : `${round} of 7`;
  const stEl = document.getElementById('status-state');
  stEl.textContent = status.charAt(0).toUpperCase() + status.slice(1);
  stEl.className = `value ${status}`;
  document.getElementById('status-players').textContent = allPlayers.length;

  const roundSubs = allSubmissions.filter(s => s.round_number === gameState.current_round);
  document.getElementById('status-subs').textContent = `${roundSubs.length}/${TOTAL_TEAMS}`;
}

function renderButtons() {
  if (!gameState) return;
  const { current_round, round_status } = gameState;

  const states = {
    'btn-start-game': current_round === 0,
    'btn-open-round': current_round > 0 && current_round <= 7 && round_status === 'waiting',
    'btn-close-round': current_round > 0 && round_status === 'active',
    'btn-reveal': current_round > 0 && round_status === 'closed',
    'btn-next-round': current_round > 0 && round_status === 'revealed' && current_round < 7
  };

  Object.entries(states).forEach(([id, enabled]) => {
    document.getElementById(id).disabled = !enabled;
  });
}

function renderRoundInfo() {
  if (!gameState || gameState.current_round === 0) {
    document.getElementById('round-question-text').textContent = 'Game not started yet';
    document.getElementById('round-answer-text').style.display = 'none';
    return;
  }

  const round = GAME_DATA.rounds.find(r => r.roundNumber === gameState.current_round);
  if (!round) return;

  document.getElementById('round-question-text').textContent = round.question;

  const answerEl = document.getElementById('round-answer-text');
  answerEl.textContent = `Answer: ${formatNumber(round.answer)}`;
  // Show answer only after revealed (or always for facilitator)
  answerEl.style.display = 'block';
}

function renderSubmissions() {
  if (!gameState) return;
  const round = GAME_DATA.rounds.find(r => r.roundNumber === gameState.current_round);
  const roundSubs = allSubmissions.filter(s => s.round_number === gameState.current_round);
  const submittedTeams = new Set(roundSubs.map(s => s.team_number));

  // Progress bar
  const pct = (submittedTeams.size / TOTAL_TEAMS) * 100;
  document.getElementById('sub-progress-bar').style.width = `${pct}%`;
  document.getElementById('sub-count').textContent = submittedTeams.size;
  document.getElementById('status-subs').textContent = `${submittedTeams.size}/${TOTAL_TEAMS}`;

  // Grid
  const grid = document.getElementById('submission-grid');
  grid.innerHTML = '';
  for (let t = 1; t <= TOTAL_TEAMS; t++) {
    const sub = roundSubs.find(s => s.team_number === t);
    const hasWcHit = sub && round && round.type === 'wildcard' && sub.points_awarded > 0;
    const div = document.createElement('div');
    div.className = `submission-item ${sub ? (hasWcHit ? 'wildcard-hit' : 'submitted') : ''}`;

    let checkStr = '';
    if (sub && hasWcHit) {
      const w = (gameState.wildcard_winners || []).find(x => x.team_number === t);
      checkStr = w ? `#${w.position}` : '✓';
    } else if (sub) {
      checkStr = '✓';
    }

    div.innerHTML = `<span class="sub-team">T${t}</span><span class="sub-check">${checkStr}</span>`;
    grid.appendChild(div);
  }

  // Wildcard feed section visibility
  const wcSection = document.getElementById('wildcard-feed-section');
  if (round && round.type === 'wildcard') {
    wcSection.style.display = 'block';
    renderWildcardFeed();
  } else {
    wcSection.style.display = 'none';
  }
}

function renderWildcardFeed() {
  if (!gameState) return;
  const winners = gameState.wildcard_winners || [];
  const feed = document.getElementById('wildcard-feed');
  if (!feed) return;
  feed.innerHTML = '';
  if (winners.length === 0) {
    feed.innerHTML = '<div style="color:var(--text-dim);font-size:0.85rem;">No teams within 10% yet</div>';
    return;
  }
  winners.forEach(w => {
    const div = document.createElement('div');
    div.className = 'wildcard-feed-item';
    const pts = [15, 10, 5][w.position - 1];
    div.innerHTML = `
      <span class="wf-team">#${w.position} — Team ${w.team_number}</span>
      <span class="wf-answer">answered: ${formatNumber(w.answer)}</span>
      <span class="wf-points">+${pts} pts</span>
    `;
    feed.appendChild(div);
  });
}

function addWildcardFeedItem(winner) {
  renderWildcardFeed();
}

function renderLeaderboard() {
  const sorted = [...allTeams].sort((a, b) => b.score - a.score);
  const lb = document.getElementById('fac-leaderboard');
  lb.innerHTML = '';

  sorted.forEach((team, idx) => {
    const rank = idx + 1;
    const div = document.createElement('div');
    const rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : '';
    div.className = `fac-lb-item ${rankClass}`;

    const rankSpanClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
    const roundSub = allSubmissions.find(s => s.round_number === gameState?.current_round && s.team_number === team.team_number);
    const roundPts = roundSub && roundSub.points_awarded !== null ? roundSub.points_awarded : null;

    div.innerHTML = `
      <div class="fac-lb-rank ${rankSpanClass}">${rank}</div>
      <div class="fac-lb-team">Team ${team.team_number}</div>
      <div class="fac-lb-round">${roundPts !== null ? `+${roundPts}` : ''}</div>
      <div class="fac-lb-total">${team.score}</div>
    `;
    lb.appendChild(div);
  });
}

function renderTimer() {
  stopTimer();
  const timerEl = document.getElementById('fac-timer');

  if (!gameState || gameState.round_status !== 'active' || !gameState.round_start_time) {
    timerEl.classList.add('hidden');
    return;
  }

  const round = GAME_DATA.rounds.find(r => r.roundNumber === gameState.current_round);
  if (!round || round.type !== 'main') { timerEl.classList.add('hidden'); return; }

  timerEl.classList.remove('hidden');

  function tick() {
    const elapsed = Date.now() - new Date(gameState.round_start_time).getTime();
    const remaining = Math.max(0, MAIN_ROUND_DURATION * 1000 - elapsed);
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    timerEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    timerEl.className = `fac-timer ${remaining < 60000 ? 'danger' : ''}`;

    if (remaining === 0) {
      stopTimer();
      timerEl.textContent = '0:00';
      // Auto-close if still active
      if (gameState.round_status === 'active') {
        db.from('game_state').update({ round_status: 'closed' }).eq('id', 1);
      }
    }
  }

  tick();
  timerInterval = setInterval(tick, 1000);
}

function stopTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}
