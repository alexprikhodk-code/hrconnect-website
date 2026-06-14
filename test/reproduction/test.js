(function () {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('t');
  let candidate = null;
  let answers = {};
  let currentTask = 0;
  let stimTimer = null;

  document.getElementById('logoSlot').innerHTML = brandLogoSvg(28);

  if (!token) { showError('У посиланні немає коду тесту.'); return; }

  async function loadCandidate() {
    const { data, error } = await sb.from('candidates')
      .select('id, name, position, reproduction, test_link_token')
      .eq('test_link_token', token).maybeSingle();
    if (error || !data) { showError('Посилання недійсне.'); return; }
    if (data.reproduction != null) { showError('Цей тест уже пройдено.'); return; }
    candidate = data;
    document.getElementById('candidateName').textContent = data.name || '';
    document.getElementById('welcomePosition').textContent = data.position || '—';
  }
  loadCandidate();

  function showError(msg) {
    ['welcomeScreen','stimScreen','qScreen','doneScreen'].forEach(id => document.getElementById(id).style.display = 'none');
    document.getElementById('errorMsg').textContent = msg;
    document.getElementById('errorScreen').style.display = 'block';
  }

  window.startTest = function () {
    if (!candidate) return;
    document.getElementById('welcomeScreen').style.display = 'none';
    showStimulus();
  };

  function renderStimulus(task) {
    const stim = task.stimulus;
    let html = '';
    if (stim.type === 'colors' || stim.type === 'words' || stim.type === 'numbers') {
      html = '<div class="stim-list">' + stim.items.join(' · ') + '</div>';
    } else if (stim.type === 'shapes') {
      html = '<div class="stim-shapes">' + stim.items.join('  ') + '</div>';
    } else if (stim.type === 'order' || stim.type === 'calc') {
      html = '<div style="text-align:left; font-size:18px; line-height:2">' + stim.items.map((it, i) => '<div><strong>' + (i + 1) + '.</strong> ' + esc(it) + '</div>').join('') + '</div>';
    } else {
      html = stim.items.map(it => esc(it)).join('<br>');
    }
    return html;
  }

  function showStimulus() {
    const task = REPRODUCTION_TASKS[currentTask];
    document.getElementById('qScreen').style.display = 'none';
    document.getElementById('stimScreen').style.display = 'block';
    document.getElementById('stimCounter').textContent = `Завдання ${currentTask + 1} з ${REPRODUCTION_TASKS.length}`;
    document.getElementById('stimContent').innerHTML = renderStimulus(task);
    document.getElementById('progressBar').style.width = ((currentTask + 1) / REPRODUCTION_TASKS.length * 100) + '%';

    let seconds = task.showTime;
    document.getElementById('stimTimer').textContent = seconds;
    stimTimer = setInterval(() => {
      seconds--;
      if (seconds <= 0) {
        clearInterval(stimTimer);
        showQuestion();
      } else {
        document.getElementById('stimTimer').textContent = seconds;
      }
    }, 1000);
  }

  function showQuestion() {
    const task = REPRODUCTION_TASKS[currentTask];
    document.getElementById('stimScreen').style.display = 'none';
    document.getElementById('qScreen').style.display = 'block';
    document.getElementById('qCounter').textContent = `Завдання ${currentTask + 1} з ${REPRODUCTION_TASKS.length}`;
    document.getElementById('qText').textContent = task.question;
    const optsEl = document.getElementById('qOpts');
    optsEl.innerHTML = task.opts.map((opt, i) => `<button data-i="${i}">${esc(opt)}</button>`).join('');
    document.getElementById('nextBtn').disabled = true;
    optsEl.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        answers[currentTask] = parseInt(btn.dataset.i);
        optsEl.querySelectorAll('button').forEach(b => b.classList.remove('checked'));
        btn.classList.add('checked');
        document.getElementById('nextBtn').disabled = false;
      });
    });
  }

  window.nextTask = function () {
    if (currentTask < REPRODUCTION_TASKS.length - 1) {
      currentTask++;
      showStimulus();
      window.scrollTo(0, 0);
    } else {
      submitTest();
    }
  };

  async function submitTest() {
    let correct = 0;
    REPRODUCTION_TASKS.forEach((t, i) => { if (answers[i] === t.ans) correct++; });
    const score = Math.round(correct / REPRODUCTION_TASKS.length * 100);
    const band = reproductionBand(score);
    const summary = reproductionSummary(score, band);

    const { error } = await sb.from('candidates').update({
      reproduction: score,
      reproduction_band: band,
      reproduction_summary: summary,
      reproduction_completed_at: new Date().toISOString()
    }).eq('test_link_token', token);

    if (error) {
      alert('Не вдалось зберегти: ' + error.message);
      return;
    }
    sb.functions.invoke('notify-test-complete', {
      body: { candidate_id: candidate.id, test_type: 'reproduction' }
    }).catch(err => console.warn('Notify failed:', err));
    document.getElementById('qScreen').style.display = 'none';
    document.getElementById('doneScreen').style.display = 'block';
  }

  function esc(s) { return (s == null ? '' : String(s)).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
})();
