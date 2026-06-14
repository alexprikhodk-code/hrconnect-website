// AI-HRconnect — test page logic
(function () {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('t');
  let candidate = null;
  let prodAnswers = {};
  let persAnswers = {};

  // Render brand logo
  document.getElementById('logoSlot').innerHTML = brandLogoSvg(28);

  if (!token) {
    showError('У посиланні немає коду тесту. Перевірте URL.');
    return;
  }

  // Resume state from localStorage (per token)
  const stateKey = 'aihr_test_' + token;
  try {
    const saved = JSON.parse(localStorage.getItem(stateKey) || '{}');
    prodAnswers = saved.prod || {};
    persAnswers = saved.pers || {};
  } catch (e) {}

  // Load candidate by token
  async function loadCandidate() {
    const { data, error } = await sb
      .from('candidates')
      .select('id, name, position, test_status, test_link_token')
      .eq('test_link_token', token)
      .maybeSingle();
    if (error || !data) {
      showError('Посилання недійсне або тест уже видалений.');
      return;
    }
    if (data.test_status === 'completed') {
      showError('Цей тест уже пройдено. Дякуємо!');
      return;
    }
    candidate = data;
    document.getElementById('candidateName').textContent = data.name || '';
    document.getElementById('welcomePosition').textContent = data.position || '—';
    hideAll();
    document.getElementById('welcomeScreen').style.display = 'block';
    updateProgress(0);
  }

  loadCandidate();

  // ============ Screens ============
  function hideAll() {
    ['loaderScreen', 'welcomeScreen', 'productivityScreen', 'personalityScreen', 'doneScreen', 'errorScreen']
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
    if (name === 'welcome') {
      document.getElementById('welcomeScreen').style.display = 'block';
      updateProgress(0);
    } else if (name === 'productivity') {
      renderProductivity();
      document.getElementById('productivityScreen').style.display = 'block';
      updateProgress(25);
      window.scrollTo(0, 0);
    } else if (name === 'personality') {
      renderPersonality();
      document.getElementById('personalityScreen').style.display = 'block';
      updateProgress(65);
      window.scrollTo(0, 0);
    } else if (name === 'done') {
      document.getElementById('doneScreen').style.display = 'block';
      updateProgress(100);
    }
  };

  // ============ Productivity render ============
  function renderProductivity() {
    const container = document.getElementById('productivityQs');
    container.innerHTML = PRODUCTIVITY_QUESTIONS.map((q, i) => {
      const cur = prodAnswers[q.key] || '';
      let inputHTML = '';
      if (q.type === 'textarea') {
        inputHTML = `<textarea class="form-input" data-key="${q.key}" rows="3" placeholder="Ваша відповідь...">${escapeHTML(cur)}</textarea>`;
      } else if (q.type === 'text') {
        inputHTML = `<input type="text" class="form-input" data-key="${q.key}" value="${escapeHTML(cur)}" placeholder="Ваша відповідь...">`;
      } else if (q.type === 'radio') {
        inputHTML = '<div class="radio-group">' +
          q.options.map(opt => {
            const checked = cur === opt;
            return `<label class="radio-row ${checked ? 'checked' : ''}">
              <input type="radio" name="${q.key}" value="${escapeHTML(opt)}" data-key="${q.key}" ${checked ? 'checked' : ''}>
              <span>${escapeHTML(opt)}</span>
            </label>`;
          }).join('') +
        '</div>';
      }
      return `<div class="question">
        <span class="q-label"><span class="q-num">${i + 1}.</span> ${escapeHTML(q.label)}</span>
        ${inputHTML}
        ${q.hint ? `<div class="q-hint">${escapeHTML(q.hint)}</div>` : ''}
      </div>`;
    }).join('');

    // Bind change handlers
    container.querySelectorAll('[data-key]').forEach(el => {
      el.addEventListener('input', () => {
        prodAnswers[el.dataset.key] = el.value;
        persist();
      });
      el.addEventListener('change', () => {
        prodAnswers[el.dataset.key] = el.value;
        // For radio: highlight the row
        if (el.type === 'radio') {
          container.querySelectorAll(`input[name="${el.name}"]`).forEach(r => r.closest('.radio-row').classList.toggle('checked', r.checked));
        }
        persist();
      });
    });
  }

  window.submitProductivity = function () {
    document.getElementById('prodErr').textContent = '';
    // Validate required: at least first 6 must be filled
    const missing = [];
    PRODUCTIVITY_QUESTIONS.slice(0, 6).forEach((q, i) => {
      if (!prodAnswers[q.key] || prodAnswers[q.key].trim().length < 1) {
        missing.push(i + 1);
      }
    });
    if (missing.length) {
      document.getElementById('prodErr').textContent = 'Будь ласка, дайте відповідь на питання: ' + missing.join(', ');
      window.scrollTo(0, 0);
      return;
    }
    goToScreen('personality');
  };

  // ============ Personality render ============
  function renderPersonality() {
    const container = document.getElementById('personalityQs');
    container.innerHTML = PERSONALITY_QUESTIONS.map((q, i) => {
      const cur = persAnswers[q.key];
      return `<div class="question">
        <span class="q-label"><span class="q-num">${i + 1}.</span> ${escapeHTML(q.label)}</span>
        <div class="yn-pair">
          <button type="button" class="yn-btn ${cur === 'yes' ? 'checked' : ''}" data-key="${q.key}" data-val="yes">✓ Так</button>
          <button type="button" class="yn-btn ${cur === 'no' ? 'checked' : ''}" data-key="${q.key}" data-val="no">✗ Ні</button>
        </div>
      </div>`;
    }).join('');

    container.querySelectorAll('.yn-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.key;
        persAnswers[key] = btn.dataset.val;
        // Toggle visual
        container.querySelectorAll(`.yn-btn[data-key="${key}"]`).forEach(b => b.classList.toggle('checked', b.dataset.val === btn.dataset.val));
        persist();
      });
    });
  }

  // ============ Submit final ============
  window.submitAll = async function () {
    document.getElementById('persErr').textContent = '';
    // Validate: all personality questions answered
    const missing = PERSONALITY_QUESTIONS.filter(q => !persAnswers[q.key]);
    if (missing.length) {
      document.getElementById('persErr').textContent = 'Будь ласка, дайте відповідь на всі питання (залишилось ' + missing.length + ').';
      window.scrollTo(0, document.body.scrollHeight);
      return;
    }

    // Compute personality scores
    const points = {};
    Object.keys(TRAIT_LABELS).forEach(t => { points[t] = { label: TRAIT_LABELS[t], score: 0, level: '', thesis: '', full: '' }; });
    PERSONALITY_QUESTIONS.forEach(q => {
      const yes = persAnswers[q.key] === 'yes';
      // direction +1 (positive trait statement): Yes=+35, No=-10
      // direction -1 (negative trait statement): Yes=-35, No=+10
      let delta;
      if (q.direction > 0) delta = yes ? 35 : -10;
      else delta = yes ? -35 : 10;
      points[q.trait].score += delta;
      points[q.trait].agree_count = (points[q.trait].agree_count || 0) + (yes ? 1 : 0);
    });
    // Track ambiguity: if both yes or both no on same trait → flag
    Object.keys(points).forEach(t => {
      const traitQs = PERSONALITY_QUESTIONS.filter(q => q.trait === t);
      const yesCount = traitQs.filter(q => persAnswers[q.key] === 'yes').length;
      points[t].ambiguous = (yesCount === 0 || yesCount === traitQs.length);
    });
    // Clamp -100..100 and assign level
    Object.keys(points).forEach(t => {
      const s = Math.max(-100, Math.min(100, points[t].score));
      points[t].score = s;
      points[t].level = s <= -19 ? 'Низький' : (s < 32 ? 'Середній' : 'Високий');
    });

    // Compute verdict from productivity answers (same logic as candidate.html)
    const a = prodAnswers;
    let vScore = 0;
    const vReasons = [];
    const agrees = (a.agrees_product || '').toLowerCase();
    if (agrees.includes('так, абсолютно')) { vScore += 2; vReasons.push('Безумовно погоджується, що кожна посада має продукт'); }
    else if (agrees.startsWith('швидше так') || agrees.startsWith('так')) { vScore += 1; vReasons.push('Погоджується з концепцією продукту посади'); }
    else if (agrees.startsWith('ні') || agrees.startsWith('швидше ні')) { vScore -= 1; vReasons.push('Не погоджується з концепцією продукту посади'); }

    const product = (a.product || '').toLowerCase();
    const thingPat = /(угод|обід|обед|клиент|клієнт|звіт|отчет|прибут|виручк|продаж|подача|меню|страв|обслугов|сервіс|товар|консультац)/;
    const procPat = /(комуник|коммуник|управл|керую|спілкуван|обовязк|обязанн|процес|процесс)/;
    if (thingPat.test(product)) { vScore += 2; vReasons.push('Продукт описаний як конкретний результат'); }
    else if (procPat.test(product) && !thingPat.test(product)) { vScore -= 1; vReasons.push('Продукт описаний як процес, а не результат'); }
    else if (product.length > 15) { vScore += 1; vReasons.push('Опис продукту присутній'); }

    const res = ((a.results || '') + ' ' + (a.achievements || '')).toLowerCase();
    const hasNum = /\d{2,}/.test(res);
    if (hasNum && /(збільш|увелич|зріс|вирос|оптиміз|оптимиз|прибут)/.test(res)) { vScore += 2; vReasons.push('Конкретні цифрові досягнення'); }
    else if (hasNum) { vScore += 1; vReasons.push('Є кількісні дані у відповідях'); }
    else if (res.trim().length < 40) { vScore -= 1; vReasons.push('Результати описані абстрактно'); }

    const comp = (a.comparison || '').toLowerCase();
    if (comp.includes('значно вищ') || comp.includes('дещо вищ')) { vScore += 1; vReasons.push('Оцінює свої результати вище за колег'); }
    else if (comp.includes('нижч')) { vScore -= 1; vReasons.push('Оцінює свої результати нижче за колег'); }

    const plan = (a.plan_performance || '').toLowerCase();
    if (plan.startsWith('перевик')) { vScore += 1; vReasons.push('Заявляє про перевиконання плану'); }
    else if (plan.startsWith('не завжди') || plan.startsWith('часто не')) { vScore -= 1; vReasons.push('Часто не виконує план'); }

    let verdict, verdict_confidence;
    if (vScore >= 5) { verdict = 'Перформер'; verdict_confidence = 'висока'; }
    else if (vScore >= 2) { verdict = 'Перформер'; verdict_confidence = 'помірна'; }
    else if (vScore >= 0) { verdict = 'Делатель'; verdict_confidence = 'помірна'; }
    else { verdict = 'Делатель'; verdict_confidence = 'висока'; }

    // Build payload
    const update = {
      test_status: 'completed',
      test_completed_at: new Date().toISOString(),
      raw_answers: prodAnswers,
      product_self: prodAnswers.product || null,
      points: points,
      verdict: verdict,
      verdict_confidence: verdict_confidence,
      verdict_score: vScore,
      verdict_reasons: vReasons
    };

    // Disable button
    const btn = event.target;
    btn.disabled = true;
    btn.textContent = 'Зберігаю...';

    const { error } = await sb.from('candidates').update(update).eq('test_link_token', token);
    if (error) {
      document.getElementById('persErr').textContent = '✗ Не вдалося зберегти: ' + error.message;
      btn.disabled = false;
      btn.textContent = 'Завершити тест ✓';
      return;
    }

    // Cleanup local state
    localStorage.removeItem(stateKey);
    goToScreen('done');
  };

  // ============ Helpers ============
  function persist() {
    localStorage.setItem(stateKey, JSON.stringify({ prod: prodAnswers, pers: persAnswers }));
  }
  function escapeHTML(s) {
    return (s == null ? '' : String(s)).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
})();
