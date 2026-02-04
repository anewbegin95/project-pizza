// structured-data.js
// Injects WebSite JSON-LD on the homepage
(function(){
  function inject(json){
    const script=document.createElement('script');
    script.type='application/ld+json';
    script.textContent=JSON.stringify(json);
    document.head.appendChild(script);
  }
  function getSearchActionConfig(origin){
    const form=document.querySelector('form[role="search"], form.search-form, form#searchform, form.search');
    if(!form){return null;}
    const input=form.querySelector('input[type="search"], input[name="s"], input[name="q"], input[name]');
    if(!input||!input.name){return null;}
    const paramName=input.name;
    const action=form.getAttribute('action')||origin;
    let actionUrl;
    try{
      actionUrl=new URL(action, origin).href;
    }catch(e){
      return null;
    }
    return {
      target:actionUrl+(actionUrl.includes('?')?'&':'?')+paramName+'={search_term_string}',
      queryInput:'required name='+paramName
    };
  }
  const origin=window.location.origin;
  const path=window.location.pathname;
  if(path==='/'||/\/index\.html$/.test(path)){
    const searchAction=getSearchActionConfig(origin);
    const jsonLd={
      '@context':'https://schema.org',
      '@type':'WebSite',
      name:'NYC Slice of Life',
      url:origin
    };
    if(searchAction){
      jsonLd.potentialAction={
        '@type':'SearchAction',
        target:searchAction.target,
        'query-input':searchAction.queryInput
      };
    }
    inject(jsonLd);
  }
})();
