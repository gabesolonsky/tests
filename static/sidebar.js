// Mobile-friendly sidebar toggle and overlay
(function(){
  function createOverlay(){
    if(document.getElementById('mobile-sidebar-overlay')) return;
    const ov = document.createElement('div');
    ov.id = 'mobile-sidebar-overlay';
    ov.className = 'mobile-sidebar-overlay fixed inset-0 bg-black/40 z-40 hidden';
    ov.setAttribute('data-close','true');
    document.body.appendChild(ov);
    ov.addEventListener('click', hideSidebar);
  }

  function isMobile(){ return window.innerWidth < 768; }

  window.toggleSidebar = function(){
    createOverlay();
    const app = document.getElementById('app');
    const open = app.classList.toggle('sidebar-open');
    // lock body scroll while sidebar open
    if(open) document.body.classList.add('no-scroll'); else document.body.classList.remove('no-scroll');
    // update overlay visibility class handled by CSS
    // update aria on toggle buttons
    document.querySelectorAll('.toggle-btn').forEach(btn => btn.setAttribute('aria-expanded', String(open)));
  };

  function hideSidebar(){
    const app = document.getElementById('app');
    if(!app.classList.contains('sidebar-open')) return;
    app.classList.remove('sidebar-open');
    document.body.classList.remove('no-scroll');
    document.querySelectorAll('.toggle-btn').forEach(btn => btn.setAttribute('aria-expanded', 'false'));
  }

  // Close on escape
  document.addEventListener('keydown', (ev) => { if(ev.key === 'Escape') hideSidebar(); });

  // Close when clicking a sidebar link on mobile
  document.addEventListener('click', (ev) => {
    const a = ev.target.closest && ev.target.closest('#sidebar a');
    if(!a) return;
    // ignore links that target new tabs
    if(a.getAttribute('target') === '_blank') return;
    if(isMobile()) hideSidebar();
  });

  // ensure overlay exists after DOM ready
  document.addEventListener('DOMContentLoaded', () => { createOverlay();
    // set initial aria-expanded on toggle buttons
    document.querySelectorAll('.toggle-btn').forEach(btn => btn.setAttribute('aria-expanded', 'false'));
  });
})();
