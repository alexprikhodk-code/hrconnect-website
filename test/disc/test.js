(function () {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('t');
  let candidate = null;
  let answers = {};
  const stateKey = 'aihr_disc_' + token;

  document.getElementById('logoSlot').innerHTML = brandLogoSvg(28);

  if (!token) { showError('У посиланні немає коду тесту.'); return; }

  try { answers = JSON.parse(localStorage.getItem(stateKey) || '{}').answers || {}; } catch (e) {}

  async function loadCandidate() {
    const { data, error } = await sb.from('candidates')
      .select('id, name, position, disc_dominant, test_link_token')
      .eq('test_link_token', token).maybeSingle();
    if (error || !data) { showError('Посилання недійсне.'); return; }
    if (data.disc_dominant) { showError('Цей тест уже пройдено. Дякуємо!'); return; }
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
    container.innerHTML = DISC_QUESTIONS.map((q, i) => {
      const cur = answers[i];
      return `<div class="q-card">
        <span class="q-label"><span class="q-num">${i+1}.</span>${esc(q.label)}</span>
        <div class="likert">
          ${[1,2,3,4,5].map(v => `<button type="button" class="${cur === v ? 'checked' : ''}" data-i="${i}" data-v="${v}">
            <span class="num">${v}</span>${DISC_LIKERT[v-1]}
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
        if (nextIdx < DISC_QUESTIONS.length && !answers[nextIdx]) {
          const nextEl = container.children[nextIdx];
          if (nextEl) setTimeout(() => nextEl.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200);
        }
      });
    });
  }

  window.submitTest = async function () {
    document.getElementById('testErr').textContent = '';
    const missing = [];
    DISC_QUESTIONS.forEach((_, i) => { if (!answers[i]) missing.push(i+1); });
    if (missing.length) {
      document.getElementById('testErr').textContent = 'Будь ласка, дайте відповідь на всі питання (залишилось ' + missing.length + ').';
      return;
    }

    const scores = { D: 0, I: 0, S: 0, C: 0 };
    DISC_QUESTIONS.forEach((q, i) => { scores[q.s] += answers[i]; });
    // Each style has 6 questions × 5 max = 30
    const percentages = {};
    ['D','I','S','C'].forEach(k => { percentages[k] = Math.round(scores[k] / 30 * 100); });

    let dominant = 'D', maxPct = 0;
    ['D','I','S','C'].forEach(k => { if (percentages[k] > maxPct) { maxPct = percentages[k]; dominant = k; } });

    const sorted = ['D','I','S','C'].sort((a, b) => percentages[b] - percentages[a]);
    const secondary = (percentages[sorted[1]] >= percentages[sorted[0]] - 10) ? sorted[1] : null;
    const profileLabel = secondary ? (dominant + '/' + secondary) : dominant;

    const summary = DISC_SUMMARIES[dominant] || '';

    const btn = event.target;
    btn.disabled = true; btn.textContent = 'Зберігаю...';

    const { error } = await sb.from('candidates').update({
      disc_dominant: dominant,
      disc_profile: profileLabel,
      disc_percentages: percentages,
      disc_summary: summary,
      disc_completed_at: new Date().toISOString()
    }).eq('test_link_token', token);

    if (error) {
      document.getElementById('testErr').textContent = '✗ ' + error.message;
      btn.disabled = false; btn.textContent = 'Завершити тест ✓';
      return;
    }
    localStorage.removeItem(stateKey);
    goToScreen('done');
  };

  function persist() { localStorage.setItem(stateKey, JSON.stringify({ answers })); }
  function esc(s) { return (s == null ? '' : String(s)).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
})();
