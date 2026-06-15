(function () {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('t');
  let candidate = null;
  let answers = {};
  const stateKey = 'aihr_bf_' + token;

  document.getElementById('logoSlot').innerHTML = brandLogoSvg(28);

  if (!token) { showError('У посиланні немає коду тесту.'); return; }

  try { answers = JSON.parse(localStorage.getItem(stateKey) || '{}').answers || {}; } catch (e) {}

  async function loadCandidate() {
    const { data, error } = await sb.rpc('get_candidate_by_token', { p_token: token });
    if (error || !data) { showError('Посилання недійсне.'); return; }
    if (data.bigfive_dominant) { showError('Цей тест уже пройдено. Дякуємо!'); return; }
    candidate = data;
    document.getElementById('candidateName').textContent = data.name || '';
    document.getElementById('welcomePosition').textContent = data.position || '—';
    hideAll(); document.getElementById('welcomeScreen').style.display = 'block';
    updateProgress(0);
  }
  loadCandidate();

  function hideAll() {
    ['loaderScreen','welcomeScreen','testScreen','doneScreen','errorScreen']
      .forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
  }
  function showError(msg) {
    hideAll();
    document.getElementById('errorMsg').textContent = msg;
    document.getElementById('errorScreen').style.display = 'block';
    document.getElementById('progressLabel').textContent = '';
    document.getElementById('progressBar').style.width = '0%';
  }
  function updateProgress(pct) {
    document.getElementById('progressBar').style.width = pct + '%';
    document.getElementById('progressLabel').textContent = 'Прогрес: ' + Math.round(pct) + '%';
  }

  window.goToScreen = function (name) {
    hideAll();
    if (name === 'welcome') { document.getElementById('welcomeScreen').style.display = 'block'; updateProgress(0); }
    else if (name === 'test') { renderTest(); document.getElementById('testScreen').style.display = 'block'; updateProgress(50); window.scrollTo(0,0); }
    else if (name === 'done') { document.getElementById('doneScreen').style.display = 'block';
    const _hubUrl = '/test/?t=' + token;
    const _backLink = document.getElementById('manualBackLink');
    if (_backLink) _backLink.href = _hubUrl;
    setTimeout(() => { window.location.href = _hubUrl; }, 1800); updateProgress(100); }
  };

  function renderTest() {
    const container = document.getElementById('testQs');
    container.innerHTML = BIGFIVE_QUESTIONS.map((q, i) => {
      const cur = answers[i];
      return `<div class="q-card">
        <span class="q-label"><span class="q-num">${i+1}.</span>${esc(q.label)}</span>
        <div class="likert">
          ${[1,2,3,4,5].map(v => `<button type="button" class="${cur === v ? 'checked' : ''}" data-i="${i}" data-v="${v}">
            <span class="num">${v}</span>${BIGFIVE_LIKERT[v-1]}
          </button>`).join('')}
        </div>
      </div>`;
    }).join('');
    container.querySelectorAll('.likert button').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = +btn.dataset.i, v = +btn.dataset.v;
        answers[i] = v;
        container.querySelectorAll(`.likert button[data-i="${i}"]`).forEach(b =>
          b.classList.toggle('checked', +b.dataset.v === v));
        persist();
        const nextIdx = i + 1;
        if (nextIdx < BIGFIVE_QUESTIONS.length && !answers[nextIdx]) {
          const nextEl = container.children[nextIdx];
          if (nextEl) setTimeout(() => nextEl.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200);
        }
      });
    });
  }

  function levelOf(pct) {
    if (pct <= 33) return 'low';
    if (pct <= 66) return 'mid';
    return 'high';
  }

  window.submitTest = async function () {
    document.getElementById('testErr').textContent = '';
    const missing = [];
    BIGFIVE_QUESTIONS.forEach((_, i) => { if (!answers[i]) missing.push(i+1); });
    if (missing.length) {
      document.getElementById('testErr').textContent = 'Будь ласка, дайте відповідь на всі питання (залишилось ' + missing.length + ').';
      return;
    }

    const scores = { O: 0, C: 0, E: 0, A: 0, N: 0 };
    BIGFIVE_QUESTIONS.forEach((q, i) => { scores[q.d] += answers[i]; });
    // 6 questions × 5 max = 30 per dimension
    const percentages = {};
    const levels = {};
    ['O','C','E','A','N'].forEach(k => {
      percentages[k] = Math.round(scores[k] / 30 * 100);
      levels[k] = levelOf(percentages[k]);
    });

    // Dominant: among O/C/E/A, pick highest. Exclude N — high N is risk, not a "strength"
    let dominant = 'O', maxPct = 0;
    ['O','C','E','A'].forEach(k => {
      if (percentages[k] > maxPct) { maxPct = percentages[k]; dominant = k; }
    });

    // Build summary
    const dominantSummary = BIGFIVE_CONCLUSIONS[dominant][levels[dominant]];
    const nNote = levels.N === 'high' ? ' Емоційна стабільність низька — потребує підтримуючого середовища.' :
                  levels.N === 'low' ? ' Емоційна стабільність висока — спокій під тиском.' : '';
    const summary = (BIGFIVE_DIMS[dominant].ua + ' (' + percentages[dominant] + '%): ') + dominantSummary + nNote;

    const btn = event.target;
    btn.disabled = true; btn.textContent = 'Зберігаю...';

    const { error } = await sb.rpc('update_candidate_by_token', { p_token: token, p_data: {
      bigfive_dominant: dominant,
      bigfive_percentages: percentages,
      bigfive_levels: levels,
      bigfive_summary: summary,
      bigfive_completed_at: new Date().toISOString()
    } });

    if (error) {
      document.getElementById('testErr').textContent = '✗ ' + error.message;
      btn.disabled = false; btn.textContent = 'Завершити тест ✓';
      return;
    }
    localStorage.removeItem(stateKey);

    // Fire-and-forget email notification to HR (won't block UX if it fails)
    sb.functions.invoke('notify-test-complete', {
      body: { candidate_id: candidate.id, test_type: 'bigfive' }
    }).catch(err => console.warn('Email notification failed (non-blocking):', err));

    goToScreen('done');
  };

  function persist() { localStorage.setItem(stateKey, JSON.stringify({ answers })); }
  function esc(s) { return (s == null ? '' : String(s)).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
})();
