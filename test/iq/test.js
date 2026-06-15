(function () {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('t');
  let candidate = null;
  let answers = {};
  let currentQ = 0;
  let timerInterval = null;
  let timeLeftSec = IQ_TIME_LIMIT_SEC;
  const stateKey = 'aihr_iq_' + token;

  document.getElementById('logoSlot').innerHTML = brandLogoSvg(28);

  if (!token) { showError('У посиланні немає коду тесту.'); return; }

  try {
    const saved = JSON.parse(localStorage.getItem(stateKey) || '{}');
    answers = saved.answers || {};
    if (saved.started) {
      timeLeftSec = Math.max(0, IQ_TIME_LIMIT_SEC - Math.floor((Date.now() - saved.started) / 1000));
    }
  } catch (e) {}

  async function loadCandidate() {
    const { data, error } = await sb.from('candidates')
      .select('id, name, position, iq, test_link_token')
      .eq('test_link_token', token).maybeSingle();
    if (error || !data) { showError('Посилання недійсне.'); return; }
    if (data.iq != null) { showError('Цей тест уже пройдено.'); return; }
    candidate = data;
    document.getElementById('candidateName').textContent = data.name || '';
    document.getElementById('welcomePosition').textContent = data.position || '—';
  }
  loadCandidate();

  function showError(msg) {
    ['welcomeScreen','testScreen','doneScreen'].forEach(id => document.getElementById(id).style.display = 'none');
    document.getElementById('errorMsg').textContent = msg;
    document.getElementById('errorScreen').style.display = 'block';
  }

  window.startTest = function () {
    if (!candidate) return;
    const saved = JSON.parse(localStorage.getItem(stateKey) || '{}');
    if (!saved.started) {
      localStorage.setItem(stateKey, JSON.stringify({ answers, started: Date.now() }));
    }
    document.getElementById('welcomeScreen').style.display = 'none';
    document.getElementById('testScreen').style.display = 'block';
    document.getElementById('timerBox').style.display = 'block';
    startTimer();
    renderQ();
  };

  function startTimer() {
    updateTimerDisplay();
    timerInterval = setInterval(() => {
      timeLeftSec--;
      updateTimerDisplay();
      if (timeLeftSec <= 0) {
        clearInterval(timerInterval);
        submitTest();
      }
    }, 1000);
  }

  function updateTimerDisplay() {
    const min = Math.floor(timeLeftSec / 60);
    const sec = timeLeftSec % 60;
    const box = document.getElementById('timerBox');
    box.textContent = `${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
    box.classList.toggle('warning', timeLeftSec <= 60);
  }

  function renderQ() {
    const q = IQ_QUESTIONS[currentQ];
    document.getElementById('qCounter').textContent = `Питання ${currentQ + 1} з ${IQ_QUESTIONS.length}`;
    document.getElementById('qText').textContent = q.q;
    const optsEl = document.getElementById('qOpts');
    const cur = answers[currentQ];
    optsEl.innerHTML = q.opts.map((opt, i) => 
      `<button data-i="${i}" class="${cur === i ? 'checked' : ''}">${esc(opt)}</button>`
    ).join('');
    optsEl.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        answers[currentQ] = parseInt(btn.dataset.i);
        optsEl.querySelectorAll('button').forEach(b => b.classList.remove('checked'));
        btn.classList.add('checked');
        persist();
      });
    });
    document.getElementById('backBtn').style.visibility = currentQ > 0 ? 'visible' : 'hidden';
    document.getElementById('nextBtn').textContent = currentQ === IQ_QUESTIONS.length - 1 ? 'Завершити тест ✓' : 'Далі →';
    document.getElementById('progressBar').style.width = ((currentQ + 1) / IQ_QUESTIONS.length * 100) + '%';
  }

  window.nextQ = function () {
    if (currentQ < IQ_QUESTIONS.length - 1) {
      currentQ++;
      renderQ();
      window.scrollTo(0, 0);
    } else {
      submitTest();
    }
  };
  window.prevQ = function () {
    if (currentQ > 0) { currentQ--; renderQ(); window.scrollTo(0, 0); }
  };

  async function submitTest() {
    if (timerInterval) clearInterval(timerInterval);
    // Compute score
    let correct = 0;
    IQ_QUESTIONS.forEach((q, i) => { if (answers[i] === q.ans) correct++; });
    const iq = iqFromCorrect(correct);
    const band = iqBand(iq);
    const summary = iqSummary(iq, band);

    const { error } = await sb.from('candidates').update({
      iq: iq,
      iq_band: band,
      iq_summary: summary,
      iq_correct: correct,
      iq_completed_at: new Date().toISOString()
    }).eq('test_link_token', token);

    if (error) {
      alert('Не вдалось зберегти: ' + error.message);
      return;
    }
    localStorage.removeItem(stateKey);
    sb.functions.invoke('notify-test-complete', {
      body: { candidate_id: candidate.id, test_type: 'iq' }
    }).catch(err => console.warn('Notify failed:', err));
    document.getElementById('testScreen').style.display = 'none';
    document.getElementById('doneScreen').style.display = 'block';
    const _hubUrl = '/test/?t=' + token;
    const _backLink = document.getElementById('manualBackLink');
    if (_backLink) _backLink.href = _hubUrl;
    setTimeout(() => { window.location.href = _hubUrl; }, 1800);
    document.getElementById('timerBox').style.display = 'none';
  }

  function persist() {
    const saved = JSON.parse(localStorage.getItem(stateKey) || '{}');
    saved.answers = answers;
    localStorage.setItem(stateKey, JSON.stringify(saved));
  }
  function esc(s) { return (s == null ? '' : String(s)).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
})();
