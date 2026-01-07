function initMobileNav() {
  const nav = document.getElementById('mobile-nav');
  if (!nav) return;

  // Set active button based on current pathname
  function setActive() {
    const path = (window.location.pathname || '/').replace(/\/$/, '');
    document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
      const target = (btn.getAttribute('data-target') || '').replace(/\/$/, '');
      if (target === path || (path === '' && target === '/dashboard')) {
        btn.classList.add('active');
        btn.setAttribute('aria-current', 'page');
      } else {
        btn.classList.remove('active');
        btn.removeAttribute('aria-current');
      }
    });
  }

  setActive();

  // Click navigation
  document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = btn.getAttribute('data-target');
      if (!target) return;
      // If current, and we are on the college teams page, and a data-section attribute is present, trigger section change
      const section = btn.getAttribute('data-section');
      if (window.location.pathname.replace(/\/$/, '') === '/collegeteams' && section) {
        // switch sections without navigation
        if (typeof window.showCollegeTab === 'function') {
          window.showCollegeTab(section);
          setActive();
          return;
        }
      }
      // Navigate if needed
      if (window.location.pathname.replace(/\/$/, '') !== target) {
        window.location.href = target;
      }
    });
  });

  // Re-evaluate on history navigation
  window.addEventListener('popstate', setActive);

  // ensure lucide icons are created for buttons
  if (window.lucide) lucide.createIcons();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMobileNav);
} else {
  initMobileNav();
}
