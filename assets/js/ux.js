// AI-HRconnect — shared UX behaviors for cabinet pages
(function () {
  // 1) Scroll-reveal via IntersectionObserver
  function setupReveal() {
    const els = document.querySelectorAll('.reveal');
    if (!els.length) return;
    if (!('IntersectionObserver' in window)) {
      els.forEach(el => el.classList.add('visible'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
    els.forEach(el => io.observe(el));
  }

  // 2) Auto-mark common cabinet blocks with .reveal class (no need to touch every HTML)
  function autoMarkReveal() {
    const selectors = [
      '.card', '.summary-card', '.point-block', '.trait-card',
      '.kpi-card', '.r-section', '.dim-row', '.style-row', '.type-row',
      '.hire-rec', '.section', '.bf-grid', '.enn-grid', '.disc-grid',
      '.cand-hero', '.compare-wrap'
    ];
    let counter = 0;
    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        if (!el.classList.contains('reveal')) {
          el.classList.add('reveal');
          // Stagger delays for visually grouped elements
          const delay = (counter % 4) + 1;
          el.classList.add('reveal-d-' + delay);
          counter++;
        }
      });
    });
  }

  // 3) Smart app-topbar — hide on scroll down, show on scroll up / cursor near top
  function setupSmartTopbar() {
    const bar = document.querySelector('.app-topbar');
    const main = document.querySelector('.app-main');
    if (!bar || !main) return;

    let lastY = main.scrollTop || 0;
    const SCROLL_THRESHOLD = 60;

    // Use the scrollable .app-main container (which scrolls in cabinet layout)
    const scroller = main;

    function update() {
      const y = scroller.scrollTop || 0;
      const delta = y - lastY;
      if (y < SCROLL_THRESHOLD) {
        bar.classList.remove('topbar-hidden');
        bar.classList.remove('topbar-floating');
      } else if (delta > 4) {
        bar.classList.add('topbar-hidden');
      } else if (delta < -4) {
        bar.classList.remove('topbar-hidden');
        bar.classList.add('topbar-floating');
      }
      lastY = y;
    }

    let ticking = false;
    scroller.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => { update(); ticking = false; });
        ticking = true;
      }
    }, { passive: true });

    // Cursor reveal: top of the scrollable area
    main.addEventListener('mousemove', (e) => {
      const rect = main.getBoundingClientRect();
      if (e.clientY - rect.top < 14 && scroller.scrollTop > SCROLL_THRESHOLD) {
        bar.classList.remove('topbar-hidden');
        bar.classList.add('topbar-floating');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { autoMarkReveal(); setupReveal(); setupSmartTopbar(); });
  } else {
    autoMarkReveal(); setupReveal(); setupSmartTopbar();
  }
})();
