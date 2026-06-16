// AI-HRconnect — Universal recommendation builder
// Distinguishes AI-resume candidates (preliminary) from live-test candidates (validated).

(function (g) {
  'use strict';

  function isAiSource(c) {
    return c && c.source === 'resume_ai';
  }

  // Helpers — which tests have data (only counts LIVE tests, not AI analysis)
  function whatIsDone(c) {
    if (isAiSource(c)) {
      // AI candidate: no live tests done — analysis is preliminary
      return {
        productivity: false, enneagram: false, disc: false,
        bigfive: false, iq: false, reproduction: false
      };
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

  // What data is AVAILABLE (live OR AI)
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

  function productivityConclusion(c, avail) {
    if (!avail.productivity) return null;
    const verdict = c.verdict;
    if (!verdict) return null;
    return {
      label: verdict === 'Перформер' ? 'Продуктивний' : 'Виконавець',
      raw: verdict,
      score: c.verdict_score ?? 0,
      confidence: c.verdict_confidence || 'помірна',
      isStrong: verdict === 'Перформер'
    };
  }

  function cognitiveConclusion(c, avail) {
    if (!avail.iq && !avail.reproduction) return null;
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

  function personalityConclusion(c, avail) {
    if (!avail.enneagram && !avail.disc && !avail.bigfive) return null;
    const parts = [];
    if (avail.enneagram) parts.push('Тип ' + c.enneagram_type);
    if (avail.disc) parts.push('DISC: ' + (c.disc_profile || c.disc_dominant));
    if (avail.bigfive) parts.push('Big Five: ' + c.bigfive_dominant);
    return { label: parts.join(' · '), parts };
  }

  function computeRecommendation(c) {
    const aiSource = isAiSource(c);
    const avail = whatIsAvailable(c);
    const done = whatIsDone(c);
    const doneCount = countDone(done);
    const availCount = countDone(avail);
    const total = 6;
    const completeness = Math.round(availCount / total * 100);

    const TEST_NAMES = {
      productivity: 'Продуктивність', enneagram: 'Еннеаграма',
      disc: 'DISC', bigfive: 'Big Five', iq: 'IQ', reproduction: 'Відтворення'
    };
    const missingLiveTests = Object.keys(avail).filter(k => !done[k]).map(k => TEST_NAMES[k]);
    const doneListLive = Object.keys(done).filter(k => done[k]).map(k => TEST_NAMES[k]);

    // === AI-source candidate — special branch ===
    if (aiSource) {
      const perform = productivityConclusion(c, avail);
      const cognitive = cognitiveConclusion(c, avail);
      let label, shortLabel, icon, cls;
      if (perform && perform.isStrong) {
        label = 'AI: Рекомендовано (попередньо)';
        shortLabel = 'AI: Рекомендовано';
        icon = '🤖✓'; cls = 'green';
      } else if (perform && !perform.isStrong) {
        label = 'AI: Виконавча роль (попередньо)';
        shortLabel = 'AI: Виконавча';
        icon = '🤖⚠'; cls = 'amber';
      } else {
        label = 'AI: попередній аналіз';
        shortLabel = 'AI-аналіз';
        icon = '🤖'; cls = 'gray';
      }
      return {
        label, shortLabel, icon, cls,
        isAi: true,
        confidence: 'попередня (з резюме)',
        completeness, done: 0, total,
        doneList: [], missing: Object.values(TEST_NAMES),
        description: 'Попередня оцінка на основі AI-аналізу резюме. Радимо запросити кандидата пройти 6 живих тестів для остаточного рішення.',
        caveats: ['Радимо доповнити живими тестами для підтвердження'],
        perform, cognitive,
        nextSteps: ['Запросити кандидата пройти 6 живих тестів через посилання']
      };
    }

    // === No data at all ===
    if (doneCount === 0) {
      return {
        label: 'Очікує проходження тестів', shortLabel: 'Очікує',
        icon: '⏳', cls: 'gray', isAi: false,
        confidence: '—',
        completeness: 0, done: 0, total,
        doneList: [], missing: Object.values(TEST_NAMES),
        description: 'Кандидат ще не пройшов жодного тесту. Надішліть посилання на тестування.',
        caveats: [],
        nextSteps: ['Надіслати кандидату посилання на тестування']
      };
    }

    // === Normal candidate with live tests ===
    const perform = productivityConclusion(c, done);
    const cognitive = cognitiveConclusion(c, done);
    const personality = personalityConclusion(c, done);

    let label, shortLabel, icon, cls;
    const caveats = [];

    if (perform && perform.isStrong) {
      label = 'Рекомендовано до співбесіди + найму';
      shortLabel = 'Рекомендовано';
      icon = '✓'; cls = 'green';
      if (cognitive && cognitive.lvl === 'low') {
        label = 'Рекомендовано з застереженням';
        shortLabel = 'З застереженням';
        cls = 'amber'; icon = '⚠';
        caveats.push('Низький IQ — переконайтесь, що роль не вимагає складного аналізу');
      }
    } else if (perform && !perform.isStrong) {
      label = 'Виконавча роль з наглядом';
      shortLabel = 'Виконавча';
      icon = '⚠'; cls = 'amber';
      if (cognitive && (cognitive.lvl === 'high' || cognitive.lvl === 'aboveAvg')) {
        caveats.push('Високий IQ — здатний до розвитку, але не ініціативний');
      }
    } else if (!perform && cognitive) {
      if (cognitive.lvl === 'high' || cognitive.lvl === 'aboveAvg') {
        label = 'Розумний — потрібен тест на продуктивність';
        shortLabel = 'Розумний';
        icon = '🧠'; cls = 'amber';
      } else {
        label = 'Когнітивно прийнятний — потрібен тест на продуктивність';
        shortLabel = 'Часткові дані';
        icon = 'ℹ'; cls = 'gray';
      }
    } else if (!perform && !cognitive && personality) {
      label = 'Профіль особистості виміряний';
      shortLabel = 'Профіль є';
      icon = 'ℹ'; cls = 'gray';
    } else {
      label = 'Часткові дані';
      shortLabel = 'Часткові';
      icon = 'ℹ'; cls = 'gray';
    }

    // Add caveats ONLY about tests that are actually MISSING
    if (missingLiveTests.length > 0 && missingLiveTests.length < 6) {
      caveats.push('Не пройдено: ' + missingLiveTests.join(', ') + ' — рекомендую дозамовити');
    }

    const confidence = doneCount >= 5 ? 'висока' : (doneCount >= 3 ? 'помірна' : 'низька');

    const descParts = [];
    if (perform) descParts.push(`Продуктивність: ${perform.label} (впевн. ${perform.confidence})`);
    if (cognitive && cognitive.label) descParts.push(cognitive.label + (cognitive.iq != null ? ` (${cognitive.iq})` : ''));
    if (personality && personality.label) descParts.push(personality.label);
    const description = descParts.length ? descParts.join(' · ') : 'Часткові дані з тестів.';

    const nextSteps = [];
    if (missingLiveTests.length > 0 && missingLiveTests.length < 6) {
      nextSteps.push('Дозамовити тести: ' + missingLiveTests.join(', '));
    }

    return {
      label, shortLabel, icon, cls, isAi: false,
      confidence,
      completeness, done: doneCount, total,
      doneList: doneListLive, missing: missingLiveTests,
      caveats, description,
      perform, cognitive, personality,
      nextSteps
    };
  }

  g.computeRecommendation = computeRecommendation;
  g.AIHR_REC = { computeRecommendation, whatIsDone, whatIsAvailable, isAiSource };
})(typeof window !== 'undefined' ? window : this);
