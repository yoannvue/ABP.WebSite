(function () {
  const menuButtonSelector = '.menu-button';
  const navSelector = '.main-nav';

  function initMobileMenu() {
    const button = document.querySelector(menuButtonSelector);
    const nav = document.querySelector(navSelector);

    if (!button || !nav) {
      return;
    }

    const setMenuState = (isOpen) => {
      nav.classList.toggle('is-open', isOpen);
      button.setAttribute('aria-expanded', String(isOpen));
      button.setAttribute(
        'aria-label',
        isOpen ? 'Fermer le menu' : 'Ouvrir le menu'
      );
    };

    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();

      const shouldOpen = !nav.classList.contains('is-open');
      setMenuState(shouldOpen);
    });

    nav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        if (window.matchMedia('(max-width: 980px)').matches) {
          setMenuState(false);
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileMenu);
  } else {
    initMobileMenu();
  }
})();
