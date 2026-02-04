// structured-data.js
// Injects WebSite JSON-LD on the homepage
(function(){
  function inject(json){
    var script=document.createElement('script');
    script.type='application/ld+json';
    script.textContent=JSON.stringify(json);
    document.head.appendChild(script);
  }
  var origin='https://nycsliceoflife.com';
  var path=window.location.pathname;
  if(path==='/'||/\/index\.html$/.test(path)){
    inject({
      '@context':'https://schema.org',
      '@type':'WebSite',
      name:'NYC Slice of Life',
      url:origin,
      potentialAction:{
        '@type':'SearchAction',
        target:origin+'/?s={search_term_string}',
        'query-input':'required name=search_term_string'
      }
    });
  }
})();
