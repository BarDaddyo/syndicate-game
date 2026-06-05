// Player view — real-time driven by game_state subscriptions

let player = null;
let gameState = null;
let teamData = null;
let timerInterval = null;
let submittedThisRound = false;

async function init() {
  const raw = localStorage.getItem('syndicate_player');
  if (!raw) { window.location.href = '/'; return; }

  try { player = JSON.parse(raw); } catch(e) { localStorage.removeItem('syndicate_player'); window.location.href = '/'; return; }

  // Verify player still exists in DB
  const { data: dbPlayer, error } = await db.from('players').select('*').eq('id', player.id).single();
  if (error || !dbPlayer) {
    localStorage.removeItem('syndicate_player');
    window.location.href = '/';
    return;
  }
  player = { ...player, constraint_role: dbPlayer.constraint_role, team_position: dbPlayer.team_position };

  // Set header
  document.getElementById('header-name').textContent = player.name.toUpperCase();
  document.getElementById('header-team').textContent = `TEAM ${player.teamNumber}`;

  // Load initial state
  const [gsResult, teamResult] = await Promise.all([
    db.from('game_state').select('*').eq('id', 1).single(),
    db.from('teams').select('*').eq('team_number', player.teamNumber).single()
  ]);

  gameState = gsResult.data;
  teamData = teamResult.data;

  // Show page
  document.getElementById('loading-screen').style.display = 'none';
  document.getElementById('player-page').style.display = 'flex';

  render();
  subscribeToChanges();
}

function subscribeToChanges() {
  db.channel('player-game')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_state', filter: 'id=eq.1' }, payload => {
      const prev = gameState;
      gameState = payload.new;
      if (prev.current_round !== gameState.current_round) submittedThisRound = false;
      render().catch(console.error);
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'players', filter: `id=eq.${player.id}` }, payload => {
      player.constraint_role = payload.new.constraint_role;
      render().catch(console.error);
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'teams', filter: `team_number=eq.${player.teamNumber}` }, payload => {
      teamData = payload.new;
      render().catch(console.error);
    })
    .subscribe();
}

async function render() {
  stopTimer();
  const content = document.getElementById('player-content');

  if (!gameState || gameState.current_round === 0) {
    content.innerHTML = renderLobby();
    subscribePlayerCount();
    return;
  }

  const round = GAME_DATA.rounds.find(r => r.roundNumber === gameState.current_round);
  if (!round) return;

  switch (gameState.round_status) {
    case 'waiting':
      content.innerHTML = renderRoundWaiting(round);
      break;
    case 'active':
      content.innerHTML = renderRoundActive(round);
      attachActiveHandlers(round);
      break;
    case 'closed':
      content.innerHTML = renderRoundClosed(round);
      break;
    case 'revealed':
      await renderRoundRevealed(round);
      break;
  }
}

// ─── Lobby ───────────────────────────────────────────────

let playerCountChannel = null;

function subscribePlayerCount() {
  if (playerCountChannel) return;
  refreshPlayerCount();
  playerCountChannel = db.channel('player-count-watch')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, refreshPlayerCount)
    .subscribe();
}

async function refreshPlayerCount() {
  const { count } = await db.from('players').select('*', { count: 'exact', head: true });
  const el = document.getElementById('lobby-player-count');
  if (el) el.textContent = count ?? '0';
}

function renderLobby() {
  return `
    <div class="lobby-message">
      <div class="lobby-title">THE<br>SYNDICATE</div>
      <div class="lobby-waiting">
        <span class="pulse-dot"></span>
        Waiting for the game to start
      </div>
      <div class="lobby-player-count">
        <span class="count" id="lobby-player-count">—</span> players have joined
      </div>
    </div>
  `;
}

// ─── Round waiting ────────────────────────────────────────

function renderRoundWaiting(round) {
  const typeBadge = round.type === 'wildcard'
    ? `<div class="badge badge-wildcard">WILDCARD</div>`
    : `<div class="badge badge-accent">MAIN ROUND</div>`;

  return `
    <div class="round-header">
      <div>
        <div class="round-label-text">Round</div>
        <div class="round-number-text">${round.roundNumber}</div>
      </div>
      ${typeBadge}
    </div>
    <div class="state-message">
      <div class="pulse-dot" style="display:inline-block;"></div>
      Round ${round.roundNumber} is about to begin — stand by
    </div>
  `;
}

// ─── Round active ─────────────────────────────────────────

function renderRoundActive(round) {
  const role = player.constraint_role;
  const roleInfo = ROLES[role] || ROLES.waiting;
  const isMain = round.type === 'main';

  let timerHtml = '';
  if (isMain) {
    timerHtml = `<div class="timer-display" id="player-timer">8:00</div>`;
  } else {
    timerHtml = `<div class="wildcard-indicator"><span class="pulse-dot"></span>WILDCARD — OPEN</div>`;
  }

  let clueHtml = '';
  if (round.clues && role !== 'waiting') {
    const clue = round.clues[role];
    if (clue) {
      if (role === 'fixedphrase') {
        clueHtml = `
          <div class="clue-card">
            <div class="clue-label">Your Phrase</div>
            <div class="clue-text">${escHtml(clue.clue)}</div>
            <div class="fixed-phrase-highlight">"${escHtml(clue.phrase)}"</div>
          </div>
        `;
      } else {
        clueHtml = `
          <div class="clue-card">
            <div class="clue-label">Your Clue</div>
            <div class="clue-text">${escHtml(clue)}</div>
          </div>
        `;
      }
    }
  } else if (round.type === 'wildcard') {
    clueHtml = `
      <div class="clue-card">
        <div class="clue-label">Wildcard Round</div>
        <div class="clue-text" style="color:var(--text-dim);">No clues provided for wildcard rounds. Use your team's collective knowledge!</div>
      </div>
    `;
  }

  let speakerForm = '';
  if (role === 'speaker') {
    if (submittedThisRound) {
      speakerForm = `
        <div class="submit-form-card">
          <div class="submitted-confirm">
            <span style="font-size:1.4rem;">✓</span>
            Answer submitted — waiting for results
          </div>
        </div>
      `;
    } else {
      speakerForm = `
        <div class="submit-form-card">
          <div class="submit-form-label">Submit Your Team's Answer</div>
          <input type="number" id="answer-input" class="input" placeholder="Enter answer..." inputmode="decimal" step="any">
          <div id="submit-error" class="error-msg" style="margin-bottom:10px;"></div>
          <button id="submit-btn" class="btn btn-primary btn-lg">Submit Answer</button>
        </div>
      `;
    }
  }

  let silentNote = '';
  if (role === 'silent') {
    silentNote = `
      <div class="silent-card">
        <div class="clue-label">Private Estimate (only you can see this)</div>
        <textarea class="silent-textarea" placeholder="Write your private estimate here..." id="silent-estimate"></textarea>
        <div class="silent-note">Do NOT show this to your team. Only the Speaker may ask to see it — show them directly, one-to-one.</div>
      </div>
    `;
    // Restore saved estimate
    const saved = localStorage.getItem(`silent_${gameState.current_round}_${player.id}`);
    setTimeout(() => {
      const ta = document.getElementById('silent-estimate');
      if (ta) {
        if (saved) ta.value = saved;
        ta.addEventListener('input', () => {
          localStorage.setItem(`silent_${gameState.current_round}_${player.id}`, ta.value);
        });
      }
    }, 0);
  }

  return `
    <div class="round-header">
      <div>
        <div class="round-label-text">Round</div>
        <div class="round-number-text">${round.roundNumber}</div>
      </div>
      ${timerHtml}
    </div>

    <div class="question-card">
      <div class="question-label">The Question</div>
      <div class="question-text">${escHtml(round.question)}</div>
    </div>

    <div class="constraint-card" style="background:${roleInfo.bgColor}; border-color:${roleInfo.borderColor}; color:${roleInfo.color};">
      <div class="constraint-role-label" style="color:var(--text-dim);">Your Role This Round</div>
      <div class="constraint-role-name">${escHtml(roleInfo.label)}</div>
      <div class="constraint-role-desc" style="color:var(--text-mid);">${escHtml(roleInfo.description)}</div>
    </div>

    ${clueHtml}
    ${speakerForm}
    ${silentNote}
  `;
}

function attachActiveHandlers(round) {
  // Start timer for main rounds
  if (round.type === 'main' && gameState.round_start_time) {
    startTimer(gameState.round_start_time);
  }

  // Speaker submit
  const submitBtn = document.getElementById('submit-btn');
  if (submitBtn) {
    submitBtn.addEventListener('click', () => handleSubmit(round));
    const input = document.getElementById('answer-input');
    if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') handleSubmit(round); });
  }
}

async function handleSubmit(round) {
  const input = document.getElementById('answer-input');
  const errEl = document.getElementById('submit-error');
  const btn = document.getElementById('submit-btn');

  const raw = input ? input.value.trim() : '';
  const val = parseFloat(raw);

  if (raw === '' || isNaN(val)) {
    if (errEl) { errEl.textContent = 'Please enter a valid number.'; errEl.classList.add('visible'); }
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = 'Submitting...'; }
  if (errEl) errEl.classList.remove('visible');

  const { error } = await db.from('submissions').upsert({
    team_number: player.teamNumber,
    round_number: round.roundNumber,
    answer: val,
    submitted_at: new Date().toISOString()
  }, { onConflict: 'team_number,round_number' });

  if (error) {
    if (errEl) { errEl.textContent = 'Submission failed. Please try again.'; errEl.classList.add('visible'); }
    if (btn) { btn.disabled = false; btn.textContent = 'Submit Answer'; }
    return;
  }

  submittedThisRound = true;
  render();
}

// ─── Round closed ─────────────────────────────────────────

function renderRoundClosed(round) {
  return `
    <div class="round-header">
      <div>
        <div class="round-label-text">Round</div>
        <div class="round-number-text">${round.roundNumber}</div>
      </div>
      <div class="badge badge-dim">CLOSED</div>
    </div>
    <div class="state-message">
      <div class="pulse-dot" style="display:inline-block;"></div>
      Submissions closed — waiting for the answer reveal
    </div>
  `;
}

// ─── Round revealed ───────────────────────────────────────

async function renderRoundRevealed(round) {
  // Fetch this team's submission for this round
  const { data: sub } = await db.from('submissions')
    .select('answer, points_awarded')
    .eq('team_number', player.teamNumber)
    .eq('round_number', round.roundNumber)
    .maybeSingle();

  const pointsEarned = sub ? (sub.points_awarded ?? 0) : 0;
  const teamScore = teamData ? teamData.score : 0;

  // Fetch leaderboard rank
  const { data: teams } = await db.from('teams').select('team_number, score').order('score', { ascending: false });
  const rank = teams ? teams.findIndex(t => t.team_number === player.teamNumber) + 1 : '?';

  const pointsClass = pointsEarned > 0 ? 'positive' : 'zero';

  document.getElementById('player-content').innerHTML = `
    <div class="round-header">
      <div>
        <div class="round-label-text">Round ${round.roundNumber} — Result</div>
      </div>
      <div class="badge badge-success">REVEALED</div>
    </div>

    <div class="reveal-answer-card">
      <div class="reveal-answer-label">Correct Answer</div>
      <div class="reveal-answer-value">${formatNumber(round.answer)}</div>
    </div>

    <div class="points-earned-card">
      <div class="points-stat">
        <div class="points-stat-value ${pointsClass}">${pointsEarned > 0 ? '+' : ''}${pointsEarned}</div>
        <div class="points-stat-label">Points this round</div>
      </div>
      <div class="points-stat">
        <div class="points-stat-value" style="color:var(--accent);">${teamScore}</div>
        <div class="points-stat-label">Total score</div>
      </div>
    </div>

    <div class="card" style="text-align:center;">
      <div style="font-family:'Barlow Condensed',sans-serif; font-size:0.75rem; font-weight:700; letter-spacing:0.15em; text-transform:uppercase; color:var(--text-dim); margin-bottom:6px;">Current Rank</div>
      <div style="font-family:'Bebas Neue',sans-serif; font-size:3rem; color:var(--text); letter-spacing:0.06em;">#${rank}</div>
    </div>
  `;
}

// ─── Timer ───────────────────────────────────────────────

function startTimer(startTimeStr) {
  stopTimer();
  const timerEl = document.getElementById('player-timer');
  if (!timerEl) return;

  function tick() {
    const elapsed = Date.now() - new Date(startTimeStr).getTime();
    const remaining = Math.max(0, 480000 - elapsed);
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    timerEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    timerEl.classList.toggle('danger', remaining < 60000 && remaining > 0);
    if (remaining === 0) {
      timerEl.textContent = 'TIME\'S UP';
      timerEl.classList.remove('danger');
      timerEl.classList.add('expired');
      stopTimer();
    }
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

init().catch(console.error);
