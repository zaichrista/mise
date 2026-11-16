/* One interruptible spring drives both the switch and every page colour. */
(() => {
  const root = document.documentElement;
  const system = matchMedia('(prefers-color-scheme: dark)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let preference;
  try { preference = localStorage.getItem('mise-theme'); } catch { /* Storage is optional. */ }
  if (!['light', 'dark'].includes(preference)) preference = null;
  let dark = preference ? preference === 'dark' : system.matches;
  let position = Number(dark), velocity = 0, frame = null, lastTime = 0;

  function paint() {
    root.style.setProperty('--theme-position', position);
    root.style.setProperty('--theme-mix', `${Math.min(1, Math.max(0, position)) * 100}%`);
  }
  function label() {
    root.style.colorScheme = dark ? 'dark' : 'light';
    root.dataset.theme = dark ? 'dark' : 'light';
    document.querySelectorAll('.theme-toggle').forEach((button) => {
      button.setAttribute('aria-checked', String(dark));
      button.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
    });
  }
  function settle() {
    cancelAnimationFrame(frame);
    frame = null;
    velocity = 0;
    position = Number(dark);
    paint();
  }
  function animate(now) {
    // Small integration steps keep the spring stable after a dropped frame.
    let elapsed = Math.min((now - lastTime) / 1000, .064);
    lastTime = now;
    while (elapsed > 0) {
      const dt = Math.min(elapsed, 1 / 120);
      velocity += ((Number(dark) - position) * 260 - velocity * 21) * dt;
      position += velocity * dt;
      elapsed -= dt;
    }
    paint();
    if (Math.abs(Number(dark) - position) < .001 && Math.abs(velocity) < .01) settle();
    else frame = requestAnimationFrame(animate);
  }
  function change(next) {
    dark = next;
    label();
    if (reduced.matches) { settle(); return; }
    // Re-target a running spring without discarding position or momentum.
    if (frame === null) {
      lastTime = performance.now();
      frame = requestAnimationFrame(animate);
    }
  }
  const sun = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg>';
  const moon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 14A8.5 8.5 0 0 1 10 3.5 8.5 8.5 0 1 0 20.5 14Z"/></svg>';
  window.MiseTheme = {
    markup: () => `<button type="button" class="theme-toggle" role="switch" aria-label="Dark mode" aria-checked="${dark}" title="Switch to ${dark ? 'light' : 'dark'} mode"><span class="theme-track-icon theme-track-sun">${sun}</span><span class="theme-track-icon theme-track-moon">${moon}</span><span class="theme-thumb"><span class="theme-sun">${sun}</span><span class="theme-moon">${moon}</span></span></button>`
  };
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.theme-toggle')) return;
    preference = dark ? 'light' : 'dark';
    try { localStorage.setItem('mise-theme', preference); } catch { /* Keep working without storage. */ }
    change(!dark);
  });
  system.addEventListener('change', () => { if (!preference) change(system.matches); });
  reduced.addEventListener('change', () => { if (reduced.matches) settle(); });
  paint();
  label();
})();
