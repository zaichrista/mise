// A waiting update activates after the old app closes, never during a cooking step.
if (window.CookConfig?.offline && 'serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch((error) => {
      console.warn('Offline support could not be enabled.', error);
    });
  });
}
