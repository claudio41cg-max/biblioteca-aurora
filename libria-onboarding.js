/* Configuração rápida de primeira abertura. Sem conta, senha ou sincronização remota. */
(()=> {
  'use strict';
  const dialog=document.getElementById('libriaWelcome');
  const form=document.getElementById('libriaWelcomeForm');
  if(!dialog||!form)return;
  const PROFILE_KEY='libria-profile-v1';
  const LEGACY_NAME_KEY='aurora-perfil-nome';
  function readProfile(){
    try{return JSON.parse(localStorage.getItem(PROFILE_KEY)||'{}')||{};}catch{return {};}
  }
  function hasExistingLibrary(){
    try{
      return Boolean(localStorage.getItem('aurora-estantes-personalizadas-v1')||
        localStorage.getItem('aurora-books')||localStorage.getItem(LEGACY_NAME_KEY));
    }catch{return false;}
  }
  const profile=readProfile();
  if(profile.setupComplete)return;
  if(hasExistingLibrary()){
    const name=(()=>{try{return localStorage.getItem(LEGACY_NAME_KEY)||'';}catch{return ''}})();
    try{localStorage.setItem(PROFILE_KEY,JSON.stringify({...profile,name,country:profile.country||'BR',language:profile.language||'pt-BR',setupComplete:true,migratedFromLegacy:true}));}catch{}
    return;
  }
  const name=document.getElementById('libriaWelcomeName');
  const country=document.getElementById('libriaWelcomeCountry');
  const language=document.getElementById('libriaWelcomeLanguage');
  name.value=profile.name||'';
  country.value=profile.country||'BR';
  language.value=profile.language||'pt-BR';
  const close=()=>{try{dialog.close();}catch{dialog.removeAttribute('open');}};
  form.addEventListener('submit',event=>{
    event.preventDefault();
    const next={name:name.value.trim(),country:country.value,language:language.value,setupComplete:true,createdAt:Date.now()};
    try{
      localStorage.setItem(PROFILE_KEY,JSON.stringify(next));
      if(next.name)localStorage.setItem(LEGACY_NAME_KEY,next.name);
      close();
      document.dispatchEvent(new CustomEvent('libria:profile-ready',{detail:next}));
    }catch{
      const status=document.getElementById('libriaWelcomeStatus');
      if(status)status.textContent='Não foi possível salvar as preferências neste aparelho. Tente novamente.';
    }
  });
  document.getElementById('libriaWelcomeSkip')?.addEventListener('click',()=>{
    try{localStorage.setItem(PROFILE_KEY,JSON.stringify({name:'',country:country.value,language:language.value,setupComplete:true,skipped:true}));}catch{}
    close();
  });
  requestAnimationFrame(()=>{try{dialog.showModal();}catch{dialog.setAttribute('open','');}});
})();
