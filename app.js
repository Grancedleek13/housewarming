(() => {
  'use strict';
  const cfg = window.INVITE, form = document.querySelector('#invite-form');
  const status = document.querySelector('#status'), submit = document.querySelector('#submit');
  let gifts = cfg.gifts.map(g => ({...g, reserved:false})), busy = false, pending = null;
  const configured = /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(cfg.apiUrl);
  const setStatus = (text, kind='info') => {status.textContent=text;status.dataset.kind=kind;};
  const safeLink = url => {try {return new URL(url).protocol==='https:' ? url : '';}catch{return '';}};
  document.querySelector('#date').textContent = cfg.date;
  document.querySelector('#time').textContent = cfg.time || 'Время скоро добавим';
  document.querySelector('#address').textContent = cfg.address || 'Адрес скоро добавим';
  if(cfg.hosts){const el=document.querySelector('#hosts');el.textContent=cfg.hosts;el.hidden=false;}
  if(safeLink(cfg.mapUrl)){const el=document.querySelector('#map');el.href=cfg.mapUrl;el.hidden=false;}
  const video=document.querySelector('#background');
  const backdrop=document.querySelector('.video-background');
  const videoStart=document.querySelector('#video-start');
  const sound=document.querySelector('#sound');
  video.muted=true;video.defaultMuted=true;video.playsInline=true;
  video.setAttribute('muted','');video.setAttribute('playsinline','');
  if(video.getAttribute('src')!==cfg.video)video.src=cfg.video;
  if(cfg.poster){video.poster=cfg.poster;document.querySelector('.background-poster').src=cfg.poster;}
  function playBackground(){
    try{const result=video.play();if(result&&result.catch)result.catch(()=>{videoStart.hidden=false;});}catch{videoStart.hidden=false;}
  }
  video.addEventListener('playing',()=>{backdrop.classList.add('is-playing');videoStart.hidden=true;});
  video.addEventListener('error',()=>{backdrop.classList.remove('is-playing');videoStart.hidden=false;videoStart.textContent='Повторить запуск видео';});
  video.addEventListener('canplay',playBackground,{once:true});
  videoStart.addEventListener('click',()=>{video.muted=true;playBackground();});
  document.addEventListener('pointerdown',()=>{if(video.paused)playBackground();},{once:true,passive:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&video.paused)playBackground();});
  playBackground();
  sound.addEventListener('click', async () => {
    try{video.muted=!video.muted;await video.play();sound.textContent=video.muted?'Звук выключен':'Выключить звук';sound.setAttribute('aria-pressed',String(!video.muted));}catch{video.muted=true;sound.textContent='Звук выключен';sound.setAttribute('aria-pressed','false');videoStart.hidden=false;}
  });
  function render(){
    const selected=form.querySelector('input[name=giftId]:checked')?.value||'';
    const grid=document.querySelector('#gifts');grid.replaceChildren();
    gifts.forEach(gift=>{
      const card=document.createElement('label');card.className='gift-card'+(gift.reserved?' reserved':'');
      const radio=document.createElement('input');radio.type='radio';radio.name='giftId';radio.value=gift.id;radio.disabled=gift.reserved||busy;radio.checked=gift.id===selected&&!gift.reserved;radio.required=true;
      card.append(radio);const check=document.createElement('span');check.className='gift-check';check.setAttribute('aria-hidden','true');card.append(check);
      for(const [tag,cls,value] of [['strong','',gift.title],['span','gift-status',gift.reserved?'Забронирован':'Свободен']]){
        const el=document.createElement(tag);el.className=cls;el.textContent=value;card.append(el);
      }
      if(safeLink(gift.link)){const a=document.createElement('a');a.className='gift-link';a.href=gift.link;a.textContent='Посмотреть подарок';a.target='_blank';a.rel='noopener noreferrer';a.addEventListener('click',e=>e.stopPropagation());card.append(a);}
      grid.append(card);
    });

  }
  function jsonp(params){
    return new Promise((resolve,reject)=>{
      const name='invite_'+crypto.randomUUID().replaceAll('-','');const script=document.createElement('script');
      const cleanup=()=>{clearTimeout(timer);script.remove();delete window[name];};
      const timer=setTimeout(()=>{cleanup();reject(new Error('Связь с сервисом недоступна.'));},15000);
      window[name]=data=>{cleanup();resolve(data);};script.onerror=()=>{cleanup();reject(new Error('Не удалось загрузить данные.'));};
      script.src=cfg.apiUrl+'?'+new URLSearchParams({...params,callback:name,t:Date.now()});document.body.append(script);
    });
  }
  async function refresh(){
    const data=await jsonp({action:'gifts'});
    if(!data.ok||!Array.isArray(data.gifts))throw new Error('Вишлист пока недоступен.');
    gifts=data.gifts;render();
  }
  async function receipt(id){
    for(let attempt=0;attempt<12;attempt++){
      const result=await jsonp({action:'receipt',requestId:id});
      if(result.found)return result;
      await new Promise(resolve=>setTimeout(resolve,1800));
    }
    throw new Error('Не удалось проверить сохранение. Не меняй ФИО и подарок: повторное нажатие проверит ту же заявку.');
  }
  render();
  if(configured){refresh().catch(e=>{submit.disabled=true;setStatus(e.message+' Обнови страницу, чтобы попробовать снова.','error');});}
  else setStatus('Предпросмотр: запись гостей и бронь будут доступны после подключения сервиса.');
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;
    const fullName=form.elements.fullName.value.trim().replace(/\s+/g,' ');
    if(fullName.length<3||fullName.length>120||fullName.split(' ').length<2||/[\x00-\x1f<>]/.test(fullName)){setStatus('Впиши фамилию и имя.','error');form.elements.fullName.focus();return;}
    const giftId=form.querySelector('input[name=giftId]:checked')?.value||'';
    if(!giftId){setStatus('Выбери один подарок, чтобы подтвердить бронирование.','error');return;}
    if(!configured){setStatus('Это предпросмотр. Заявка никуда не отправлена — подключение сервиса ещё не выполнено.','info');return;}
    if(pending&&(pending.fullName!==fullName||pending.giftId!==giftId)){setStatus('Сначала повтори подтверждение прежней заявки с теми же ФИО и подарком, чтобы проверить результат.','error');return;}
    if(!pending)pending={requestId:crypto.randomUUID().replaceAll('-',''),fullName,giftId,website:form.elements.website.value};
    busy=true;submit.disabled=true;form.elements.fullName.readOnly=true;form.querySelectorAll('input[name=giftId]').forEach(el=>el.disabled=true);
    submit.textContent='Сохраняем…';setStatus('Подтверждаем участие и проверяем подарок…');
    try{
      // Оpaque response is NOT a confirmation. Confirmation comes from a separate read-only receipt.
      await fetch(cfg.apiUrl,{method:'POST',mode:'no-cors',credentials:'omit',body:new URLSearchParams(pending)}).catch(()=>{});
      const result=await receipt(pending.requestId);
      if(!result.ok){pending=null;throw new Error(result.code==='TAKEN'?'Этот подарок уже забронировали. Выбери другой.':result.code==='INVALID'?'Проверь ФИО и выбранный подарок.':'Сервис пока не настроен. Напиши организаторам.');}
      pending=null;setStatus('Готово! Участие подтверждено'+(giftId?', подарок закреплён за тобой.':'.')+' До встречи!','success');
      form.elements.fullName.value='';form.querySelectorAll('input[name=giftId]').forEach(el=>el.checked=false);
    }catch(e){setStatus(e.message,'error');}
    finally{busy=false;submit.disabled=false;submit.textContent='Подтвердить участие';form.elements.fullName.readOnly=false;render();refresh().catch(()=>{});}
  });
})();
