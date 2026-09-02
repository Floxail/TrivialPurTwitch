// Single Page Apps for GitHub Pages
// MIT License
// https://github.com/rafgraph/spa-github-pages
//
// Externalisé depuis index.html pour permettre une CSP `script-src 'self'`
// (un script inline exigerait 'unsafe-inline', ce qui viderait la directive
// de son intérêt). Inutile derrière les rewrites Vercel, conservé pour le
// déploiement gh-pages (`yarn deploy`) qui dépend du couple 404.html/index.html.
//
// Ce script lit une redirection présente dans la query string, la reconvertit
// en URL correcte et l'injecte dans l'historique via history.replaceState(),
// sans provoquer de chargement. L'app trouve ensuite la bonne URL en place.
(function (l) {
  if (l.search[1] === '/') {
    var decoded = l.search.slice(1).split('&').map(function (s) {
      return s.replace(/~and~/g, '&')
    }).join('?');
    window.history.replaceState(null, null,
      l.pathname.slice(0, -1) + decoded + l.hash
    );
  }
}(window.location))
