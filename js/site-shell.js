(function () {
  function getBasePath() {
    return location.pathname.includes('/pages/') ? '../' : './';
  }

  const partials = [
    { target: '#site-header', url: getBasePath() + 'partials/header.html' },
    { target: '#site-footer', url: getBasePath() + 'partials/footer.html' }
  ];

  const pageKeyMap = {
    '/': 'accueil',
    '/index.html': 'accueil',
    '/pages/entrainements.html': 'entrainements',
    '/pages/salles.html': 'salles',
    '/pages/coachs.html': 'coachs',
    '/pages/equipes.html': 'equipes',
    '/pages/sponsors.html': 'sponsors',
    '/pages/bureau.html': 'bureau',
    '/pages/arbitrage.html' : 'arbitrage'
  };

  function getCurrentPageKey() {
    const bodyPage = document.body.dataset.page;
    if (bodyPage) return bodyPage;

    const path = (location.pathname || '/').replace(/\\/g, '/');
    return pageKeyMap[path] || pageKeyMap[path.replace(/\/index\.html$/, '')] || '';
  }

  function applyActiveLink() {
    const currentPage = getCurrentPageKey();
    const clubParent = document.querySelector('.nav-item.has-submenu');
    const clubTrigger = document.querySelector('.nav-trigger[data-page="clubs"]');
    const isClubPage = currentPage === 'salles' || currentPage === 'bureau';

    if (clubParent) {
      clubParent.classList.toggle('is-active', isClubPage);
    }

    if (clubTrigger) {
      clubTrigger.classList.toggle('active', isClubPage);
      clubTrigger.classList.toggle('is-active', isClubPage);

      if (isClubPage) {
        clubTrigger.setAttribute('aria-current', 'page');
        clubTrigger.dataset.status = 'active';
      } else {
        clubTrigger.removeAttribute('aria-current');
        delete clubTrigger.dataset.status;
      }
    }

    const links = document.querySelectorAll('.nav-link[data-page]');

    links.forEach((link) => {
      const isActive = link.dataset.page === currentPage;
      link.classList.toggle('active', isActive);
      link.classList.toggle('is-active', isActive);

      if (isActive) {
        link.setAttribute('aria-current', 'page');
        link.dataset.status = 'active';
      } else {
        link.removeAttribute('aria-current');
        delete link.dataset.status;
      }
    });
  }

  function initMobileMenu() {
    const button = document.querySelector('.menu-button');
    const nav = document.querySelector('.main-nav');

    if (!button || !nav) {
      return;
    }

    const setMenuState = (isOpen) => {
      nav.classList.toggle('is-open', isOpen);
      button.setAttribute('aria-expanded', String(isOpen));
      button.setAttribute('aria-label', isOpen ? 'Fermer le menu' : 'Ouvrir le menu');
    };

    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      setMenuState(!nav.classList.contains('is-open'));
    });

    nav.querySelectorAll('.nav-trigger').forEach((trigger) => {
      trigger.addEventListener('click', (event) => {
        if (window.matchMedia('(max-width: 980px)').matches) {
          event.preventDefault();
          const parent = trigger.closest('.nav-item');
          const isOpen = parent.classList.toggle('is-open');
          trigger.setAttribute('aria-expanded', String(isOpen));
        }
      });
    });

    nav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        if (window.matchMedia('(max-width: 980px)').matches) {
          setMenuState(false);
          const parent = link.closest('.nav-item');
          if (parent) {
            parent.classList.remove('is-open');
          }
        }
      });
    });

    document.addEventListener('click', (event) => {
      const target = event.target;
      const clickedInsideNav = nav.contains(target);
      const clickedButton = button.contains(target);

      if (!clickedInsideNav && !clickedButton && nav.classList.contains('is-open')) {
        setMenuState(false);
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && nav.classList.contains('is-open')) {
        setMenuState(false);
      }
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 980 && nav.classList.contains('is-open')) {
        setMenuState(false);
      }
    });
  }

  async function loadPartial(targetSelector, url) {
    const target = document.querySelector(targetSelector);
    if (!target) {
      return;
    }

    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Partial load failed');
      }

      const html = await response.text();
      target.innerHTML = html;
    } catch (error) {
      console.warn('Impossible de charger le partial', url, error);
    }
  }

  function loadAnalyticsScript() {
    const existingScript = document.querySelector('script[data-analytics-loader="true"]');
    if (existingScript) {
      return;
    }

    const script = document.createElement('script');
    script.src = getBasePath() + 'js/analytics.js';
    script.async = true;
    script.dataset.analyticsLoader = 'true';
    document.head.appendChild(script);
  }

  async function bootstrap() {
    for (const partial of partials) {
      await loadPartial(partial.target, partial.url);
    }

    loadAnalyticsScript();
    applyActiveLink();
    initMobileMenu();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})();
