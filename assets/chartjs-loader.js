/* Chart.js 4.5.1 — chargeur local, version du bundle UMD épinglée.
 * Le bundle complet est servi par jsDelivr ; ce fichier assure son chargement.
 */
(() => {
  "use strict";
  if (window.Chart) {
    window.chartJsReady = Promise.resolve(window.Chart);
    return;
  }
  window.chartJsReady = new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js";
    script.crossOrigin = "anonymous";
    script.onload = () => resolve(window.Chart || null);
    script.onerror = () => {
      console.warn("Chart.js n'a pas pu être chargé depuis le CDN.");
      resolve(null);
    };
    document.head.appendChild(script);
  });
})();
