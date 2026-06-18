// AI-HRconnect — Recommendation builder
// 4 fixed main statuses + secondary insights (Розумний/Продуктивний/etc.) as small badges.
// AI-resume candidates: no test counted as "passed" — only HR analytics.

(function (g) {
  'use strict';

  const DISCLAIMER = 'Це рекомендація на основі аналізу тестів і резюме. Остаточне рішення за особою, яка наймає персонал.';

  function isAiSource(c) { return c && c.source === 'resume_ai'; }

  function whatIsDone(c) {
    if (isAiSource(c)) {
      return { productivity:false, enneagram:false, disc:false, bigfive:false, iq:false, reproduction:false };
    }
    return {
      productivity: !!c.productivity_completed_at || !!c.raw_answers || (c.points && Object.keys(c.points).length > 0) || !!c.verdict,
      enneagram:    c.enneagram_type != null,
      disc:         !!c.disc_dominant,
      bigfive:      !!c.bigfive_dominant,
      iq:           c.iq != null,
      reproduction: c.reproduction != null
    };
  }
  function whatIsAvailable(c) {
    return {
      productivity: !!c.productivity_completed_at || !!c.raw_answers || (c.points && Object.keys(c.points).length > 0) || !!c.verdict,
      enneagram:    c.enneagram_type != null,
      disc:         !!c.disc_dominant,
      bigfive:      !!c.bigfive_dominant,
      iq:           c.iq != null,
      reproduction: c.reproduction != null
    };
  }
  function countDone(map) { return Object.values(map).filter(Boolean).length; }

  // === Main 4-status decision ===
  // Inputs: verdict (Перформер/Делатель), IQ level, completion ratio
  function decideMainStatus(c) {
    const aiSource = isAiSource(c);
    const avail = whatIsAvailable(c);
    const verdict = c.verdict;
    const iq = c.iq;
    const availCount = countDone(avail);

    // No data at all (and not AI) — pending
    if (availCount === 0 && !aiSource) {
      return {
        code: 'pending',
        label: 'Очікує проходження тестів',
        shortLabel: 'Очікує',
        icon: '⏳', cls: 'gray'
      };
    }

    const isPerf = verdict === 'Перформер';
    const isDel  = verdict === 'Делатель';
    const iqLow  = (iq != null && iq < 90);
    const iqHigh = (iq != null && iq >= 110);
    // "Strong" if completed 4+ tests OR AI analysis
    const dataIsStrong = aiSource || availCount >= 4;

    // 1. Рекомендовано до найму
    if (isPerf && !iqLow && dataIsStrong) {
      return { code:'hire', label:'Рекомендовано до найму', shortLabel:'Рекомендовано', icon:'✓', cls:'green' };
    }
    // 2. Рекомендовано з застереженнями
    if (isPerf || (!verdict && iqHigh)) {
      return { code:'hireWithCaveats', label:'Рекомендовано до найму з застереженнями', shortLabel:'Рекомендовано із застереженнями', icon:'✓⚠', cls:'amber-green' };
    }
    // 4. Не рекомендовано до найму (strict NO)
    if (isDel && iqLow) {
      return { code:'noHire', label:'Не рекомендовано до найму', shortLabel:'Не рекомендовано', icon:'✗', cls:'red' };
    }
    // 3. Не рекомендовано до найму з застереженнями (lighter NO)
    return { code:'noHireWithCaveats', label:'Не рекомендовано до найму з застереженнями', shortLabel:'Не рекомендовано із застереженнями', icon:'✗⚠', cls:'amber-red' };
  }

  // === Secondary badges that complement the main status ===
  function buildSecondaryBadges(c) {
    const badges = [];
    if (!c) return badges;
    const verdict = c.verdict;
    if (verdict === 'Перформер') badges.push({ text:'Продуктивний', cls:'green', ic:'📋' });
    else if (verdict === 'Делатель') badges.push({ text:'Виконавець',  cls:'amber', ic:'📋' });
    if (c.iq != null) {
      if (c.iq >= 120) badges.push({ text:'Розумний', cls:'green', ic:'🧠' });
      else if (c.iq >= 110) badges.push({ text:'Кмітливий', cls:'green', ic:'🧠' });
      else if (c.iq < 90)   badges.push({ text:'Низький IQ', cls:'red',   ic:'🧠' });
    }
    if (c.enneagram_type != null) badges.push({ text:'Тип '+c.enneagram_type, cls:'gray', ic:'🌀' });
    if (c.disc_dominant) badges.push({ text:c.disc_profile || c.disc_dominant, cls:'gray', ic:'📊' });
    if (c.bigfive_dominant) badges.push({ text:c.bigfive_dominant, cls:'gray', ic:'🌌' });
    return badges;
  }

  function computeRecommendation(c) {
    const aiSource = isAiSource(c);
    const avail = whatIsAvailable(c);
    const done = whatIsDone(c);
    const doneCount = countDone(done);
    const availCount = countDone(avail);
    const total = 6;

    const main = decideMainStatus(c);
    const secondary = buildSecondaryBadges(c);

    const TEST_NAMES = {
      productivity:'Продуктивність', enneagram:'Еннеаграма', disc:'DISC',
      bigfive:'Big Five', iq:'IQ', reproduction:'Відтворення'
    };
    const missingLiveTests = Object.keys(done).filter(k => !done[k]).map(k => TEST_NAMES[k]);

    // Confidence
    let confidence;
    if (aiSource) confidence = 'попередня (з резюме)';
    else if (doneCount >= 5) confidence = 'висока';
    else if (doneCount >= 3) confidence = 'помірна';
    else confidence = 'низька';

    // Caveats list (what to do next)
    const caveats = [];
    if (aiSource) {
      caveats.push('Це AI-аналіз з резюме, не результати живих тестів. Рекомендовано призначити тести для підтвердження.');
    } else if (missingLiveTests.length > 0 && missingLiveTests.length < 6) {
      caveats.push('Не пройдено: ' + missingLiveTests.join(', ') + ' — рекомендую дозамовити');
    }

    return {
      // Main 4-status fields
      label: main.label,
      shortLabel: main.shortLabel,
      icon: main.icon,
      cls: main.cls,
      code: main.code,
      // Secondary badges to display NEXT TO main status
      secondaryBadges: secondary,
      // Meta
      isAi: aiSource,
      confidence,
      done: doneCount,
      total,
      missing: missingLiveTests,
      caveats,
      disclaimer: DISCLAIMER
    };
  }

  g.computeRecommendation = computeRecommendation;
  g.AIHR_DISCLAIMER = DISCLAIMER;
  g.AIHR_REC = { computeRecommendation, whatIsDone, whatIsAvailable, isAiSource, DISCLAIMER };
})(typeof window !== 'undefined' ? window : this);
