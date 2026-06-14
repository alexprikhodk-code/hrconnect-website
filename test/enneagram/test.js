(function () {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('t');
  let candidate = null;
  let answers = {};
  const stateKey = 'aihr_enn_' + token;

  document.getElementById('logoSlot').innerHTML = brandLogoSvg(28);

  if (!token) { showError('У посиланні немає коду тесту.'); return; }

  try {
    const saved = JSON.parse(localStorage.getItem(stateKey) || '{}');
    answers = saved.answers || {};
  } catch (e) {}

  async function loadCandidate() {
    const { data, error } = await sb.from('candidates')
      .select('id, name, position, enneagram_type, test_link_token')
      .eq('test_link_token', token).maybeSingle();
    if (error || !data) { showError('Посилання недійсне.'); return; }
    if (data.enneagram_type != null) { showError('Цей тест уже пройдено. Дякуємо!'); return; }
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
    else if (name === 'done') { document.getElementById('doneScreen').style.display = 'block'; updateProgress(100); }
  };

  function renderTest() {
    const container = document.getElementById('testQs');
    const LABELS = ['Категорично ні', 'Швидше ні', 'Інколи', 'Швидше так', 'Категорично так'];
    container.innerHTML = ENNEAGRAM_QUESTIONS.map((q, i) => {
      const cur = answers[i];
      return `<div class="q-card">
        <span class="q-label"><span class="q-num">${i+1}.</span>${esc(q.label)}</span>
        <div class="likert">
          ${[1,2,3,4,5].map(v => `<button type="button" class="${cur === v ? 'checked' : ''}" data-i="${i}" data-v="${v}">
            <span class="num">${v}</span>${LABELS[v-1]}
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
        // Auto-scroll to next unanswered if there's a next
        const nextIdx = i + 1;
        if (nextIdx < ENNEAGRAM_QUESTIONS.length && !answers[nextIdx]) {
          const nextEl = container.children[nextIdx];
          if (nextEl) setTimeout(() => nextEl.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200);
        }
      });
    });
  }

  window.submitTest = async function () {
    document.getElementById('testErr').textContent = '';
    const missing = [];
    ENNEAGRAM_QUESTIONS.forEach((_, i) => { if (!answers[i]) missing.push(i+1); });
    if (missing.length) {
      document.getElementById('testErr').textContent = 'Будь ласка, дайте відповідь на всі питання (залишилось ' + missing.length + ').';
      return;
    }

    // Compute scores per type
    const scores = {};
    for (let t = 1; t <= 9; t++) scores[t] = 0;
    ENNEAGRAM_QUESTIONS.forEach((q, i) => {
      scores[q.type] += answers[i]; // 1-5
    });
    // Convert to percentages: each type max = 5 questions * 5 points = 25
    const percentages = {};
    for (let t = 1; t <= 9; t++) {
      percentages[t] = Math.round(scores[t] / 25 * 100);
    }
    // Dominant type = max percentage
    let dominantType = 1, maxPct = 0;
    for (let t = 1; t <= 9; t++) {
      if (percentages[t] > maxPct) { maxPct = percentages[t]; dominantType = t; }
    }

    const summary = ENNEAGRAM_SUMMARIES[dominantType] || '';

    const btn = event.target;
    btn.disabled = true; btn.textContent = 'Зберігаю...';

    const { error } = await sb.from('candidates').update({
      enneagram_type: dominantType,
      enneagram_percentages: percentages,
      enneagram_summary: summary,
      enneagram_completed_at: new Date().toISOString()
    }).eq('test_link_token', token);

    if (error) {
      document.getElementById('testErr').textContent = '✗ ' + error.message;
      btn.disabled = false; btn.textContent = 'Завершити тест ✓';
      return;
    }
    localStorage.removeItem(stateKey);

    // Fire-and-forget email notification to HR (won't block UX if it fails)
    sb.functions.invoke('notify-test-complete', {
      body: { candidate_id: candidate.id, test_type: 'enneagram' }
    }).catch(err => console.warn('Email notification failed (non-blocking):', err));

    goToScreen('done');
  };

  function persist() { localStorage.setItem(stateKey, JSON.stringify({ answers })); }
  function esc(s) { return (s == null ? '' : String(s)).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
})();
