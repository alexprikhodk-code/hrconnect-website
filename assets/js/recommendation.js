// AI-HRconnect — Universal recommendation builder
// Works with ANY combination of completed tests; updates as more data arrives.
// All functions are window-global so any page can import this single file.

(function (g) {
  'use strict';

  // Helpers — which tests have data
  function whatIsDone(c) {
    return {
      productivity: !!c.productivity_completed_at || !!c.raw_answers || (c.points && Object.keys(c.points).length > 0),
      enneagram:    c.enneagram_type != null,
      disc:         !!c.disc_dominant,
      bigfive:      !!c.bigfive_dominant,
      iq:           c.iq != null,
      reproduction: c.reproduction != null
    };
  }

  function countDone(has) { return Object.values(has).filter(Boolean).length; }

  // Sub-conclusion: productivity verdict (uses stored c.verdict if present)
  function productivityConclusion(c, has) {
    if (!has.productivity) return null;
    const verdict = c.verdict; // 'Перформер' | 'Делатель'
    const confidence = c.verdict_confidence || 'помірна';
    const score = c.verdict_score ?? 0;
    if (!verdict) return null;
    return {
      label: verdict === 'Перформер' ? 'Продуктивний' : 'Виконавець',
      raw: verdict,
      score,
      confidence,
      isStrong: verdict === 'Перформер'
    };
  }

  // Sub-conclusion: cognitive (IQ + reproduction)
  function cognitiveConclusion(c, has) {
    if (!has.iq && !has.reproduction) return null;
    const iq = c.iq;
    let lvl = null, label = null;
    if (iq != null) {
      if (iq >= 120) { lvl = 'high'; label = 'Високий IQ'; }
      else if (iq >= 110) { lvl = 'aboveAvg'; label = 'IQ вище середнього'; }
      else if (iq >= 90) { lvl = 'avg'; label = 'Середній IQ'; }
      else { lvl = 'low'; label = 'Низький IQ'; }
    }
    return { lvl, label, iq, reproduction: c.reproduction };
  }

  // Sub-conclusion: personality (Enneagram + DISC + Big Five)
  function personalityConclusion(c, has) {
    if (!has.enneagram && !has.disc && !has.bigfive) return null;
    const parts = [];
    if (has.enneagram) parts.push('Тип ' + c.enneagram_type);
    if (has.disc) parts.push('DISC: ' + (c.disc_profile || c.disc_dominant));
    if (has.bigfive) parts.push('Big Five: ' + c.bigfive_dominant);
    return { label: parts.join(' · '), parts };
  }

  // ===================================================================
  // Main entry — returns rich recommendation object
  // ===================================================================
  function computeRecommendation(c) {
    const has = whatIsDone(c);
    const done = countDone(has);
    const total = 6;
    const completeness = Math.round(done / total * 100);

    const missingNames = {
      productivity: 'Продуктивність',
      enneagram:    'Еннеаграма',
      disc:         'DISC',
      bigfive:      'Big Five',
      iq:           'IQ',
      reproduction: 'Відтворення'
    };
    const missing = Object.keys(has).filter(k => !has[k]).map(k => missingNames[k]);
    const doneList = Object.keys(has).filter(k => has[k]).map(k => missingNames[k]);

    // === Edge case: no tests yet ===
    if (done === 0) {
      return {
        label: 'Очікує проходження тестів',
        shortLabel: 'Очікує',
        icon: '⏳', cls: 'gray',
        confidence: '—',
        completeness, done, total,
        doneList, missing,
        description: 'Кандидат ще не пройшов жодного тесту. Надішліть посилання на тестування.',
        nextSteps: ['Надіслати кандидату посилання на тестування']
      };
    }

    // Build sub-conclusions
    const perform = productivityConclusion(c, has);
    const cognitive = cognitiveConclusion(c, has);
    const personality = personalityConclusion(c, has);

    // === Decide main label ===
    let label, shortLabel, icon, cls;
    const caveats = [];

    if (perform && perform.isStrong) {
      // Strong productivity → green
      label = 'Рекомендовано до співбесіди + найму';
      shortLabel = 'Рекомендовано';
      icon = '✓'; cls = 'green';
      // Caveat if IQ low
      if (cognitive && cognitive.lvl === 'low') {
        label = 'Рекомендовано з застереженням';
        shortLabel = 'З застереженням';
        cls = 'amber'; icon = '⚠';
        caveats.push('Низький IQ — переконайтесь, що роль не вимагає складного аналізу');
      }
    } else if (perform && !perform.isStrong) {
      // Productive but executor → amber
      label = 'Виконавча роль з наглядом';
      shortLabel = 'Виконавча';
      icon = '⚠'; cls = 'amber';
      if (cognitive && (cognitive.lvl === 'high' || cognitive.lvl === 'aboveAvg')) {
        caveats.push('Високий IQ — здатний до розвитку, але не ініціативний');
      }
    } else if (!perform && cognitive) {
      // No productivity, but IQ exists
      if (cognitive.lvl === 'high' || cognitive.lvl === 'aboveAvg') {
        label = 'Розумний — перевірте продуктивність';
        shortLabel = 'Розумний';
        icon = '🧠'; cls = 'amber';
        caveats.push('Не пройдено тест на продуктивність — рекомендую дозамовити');
      } else if (cognitive.lvl === 'avg') {
        label = 'Когнітивно прийнятний — потрібен тест на продуктивність';
        shortLabel = 'Часткові дані';
        icon = 'ℹ'; cls = 'gray';
      } else {
        label = 'Низький IQ + продуктивність невідома';
        shortLabel = 'З застереженням';
        icon = '⚠'; cls = 'amber';
        caveats.push('Не пройдено тест на продуктивність');
      }
    } else if (!perform && !cognitive && personality) {
      // Only personality
      label = 'Профіль особистості виміряний — потрібні тести продуктивності та IQ';
      shortLabel = 'Профіль є';
      icon = 'ℹ'; cls = 'gray';
      caveats.push('Не пройдено тести продуктивності та IQ');
    } else {
      label = 'Часткові дані';
      shortLabel = 'Часткові';
      icon = 'ℹ'; cls = 'gray';
    }

    // Confidence based on tests count
    const confidence = done >= 5 ? 'висока' : (done >= 3 ? 'помірна' : 'низька');

    // Build a longer description
    const descParts = [];
    if (perform) descParts.push(`Продуктивність: ${perform.label} (впевненість ${perform.confidence})`);
    if (cognitive && cognitive.label) descParts.push(cognitive.label + (cognitive.iq != null ? ` (${cognitive.iq})` : ''));
    if (personality && personality.label) descParts.push(personality.label);
    const description = descParts.length ? descParts.join(' · ') : 'Часткові дані з тестів.';

    // Next steps for HR
    const nextSteps = [];
    if (missing.length > 0 && missing.length < 6) {
      nextSteps.push('Дозамовити тести: ' + missing.join(', '));
    }
    if (caveats.length === 0 && perform && perform.isStrong && done < 6) {
      nextSteps.push('Запустити решту тестів для повної картини');
    }

    return {
      label, shortLabel, icon, cls,
      confidence,
      completeness, done, total,
      doneList, missing,
      caveats, description,
      perform, cognitive, personality,
      nextSteps
    };
  }

  // Expose globals
  g.computeRecommendation = computeRecommendation;
  g.AIHR_REC = { computeRecommendation, whatIsDone, countDone };
})(typeof window !== 'undefined' ? window : this);
