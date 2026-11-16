/* Cook Mode visual prototype. See docs/interaction-specification.md for the full behavioural contract. */
(() => {
 const root=document.getElementById('cook-concepts');
 const pick=root.querySelector('#cook-screen');
 // Only prototype preferences are saved; this is not a production session store.
 const STORAGE_KEY = 'mise-cook-mode-prototype-v1';
 function readSaved() {
   try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); }
   catch { return null; }
 }
 const saved = readSaved();
 const directionPick = root.querySelector('#cook-direction');
 const shapePick = root.querySelector('#cook-shape');
 let direction = saved?.privateContent?.direction === 'counter' ? 'counter' : 'journal';
 const permitted=['preparing','active','waiting','parallel','checkpoint','interrupted','recovery','finishing','completed'];
 const recipe=Recipe.sample;
 const step=(id)=>recipe.steps.find(s=>s.id===id);
 const stepNo=(id)=>recipe.steps.findIndex(s=>s.id===id)+1;
 let servings=Recipe.clampServings(saved?.modelContent?.servings??recipe.baseServings);
 const plural=(n)=>n===1?'serving':'servings';
 // Ingredients scaled to the current servings, in the [name, qty, note] shape the screens use.
 const need=(st)=>Recipe.stepIngredients(recipe,st,servings).map(i=>[i.name,i.qty,i.note]);
 const settings={size:16,rounded:24,shape:saved?.modelContent?.buttonShape||'Rounded square'};
 let state=permitted.includes(saved?.modelContent?.screen)?saved.modelContent.screen:'active';
 const local={journal:{mode:saved?.privateContent?.journal||'Assisted',herbsStarted:false,herbsDone:false,due:['checkpoint','interrupted','recovery'].includes(state),dismissed:false,note:''},counter:{mode:saved?.privateContent?.counter||'Assisted',herbsStarted:false,herbsDone:false,due:['checkpoint','interrupted','recovery'].includes(state),dismissed:false,note:''}};
 const icon=(name)=>`<i data-lucide="${name}" aria-hidden="true"></i>`;
 const button=(text,action,kind='primary')=>{
  if(kind!=='primary')return `<button class="cm-${kind} cursor-interaction" type="button" data-act="${action}">${text}</button>`;
  const plain=text.replace(/<[^>]*>/g,'').trim();
  const names={active:['Start','Begin cooking','arrow-right'],waiting:['Done',plain,'check'],parallel:['View task','Prepare the herbs','arrow-right'],'start-herbs':['Start','Chopping the herbs','arrow-right'],finishing:['Ready','Stop sauce timer','check'],completed:['Finish','Served at the table','check'],resume:['Resume','Your cooking session','arrow-right'],preparing:['Cook again','A fresh session','rotate-ccw'],checkpoint:['Check','The sauce','eye']};
  const [heading,detail,symbol]=names[action]||[plain,'','arrow-right'];
  return `<button class="cm-primary cursor-interaction" type="button" data-act="${action}" aria-label="${plain}">${icon(symbol)}<span class="cm-action-title">${heading}</span>${detail?`<span class="cm-action-detail">${detail}</span>`:''}</button>`;
 };
 const label=(text)=>`<div class="cm-label">${text}</div>`;
 const ingredients=(items,heading='You need now')=>`<div class="cm-section">${label(heading)}${items.map(([name,qty,note])=>`<div class="cm-ingredient"><span>${name}${note?` <small>· ${note}</small>`:''}</span><strong>${qty}</strong></div>`).join('')}</div>`;
 const running=(x)=>`<div class="cm-running"><div class="cm-row"><div><strong>${x.due?'Sauce check pending':'Sauce is simmering'}</strong><div class="cm-quiet">${x.due?'Timer finished · readiness unconfirmed':'Check when the timer finishes'}</div></div><span class="cm-time">${x.due?icon('bell'):'06:24'}</span></div>${x.due?button('Check sauce','checkpoint','link'):'<div class="cm-track"><span style="width:20%"></span></div>'}</div>`;
 const eyebrow=(text,ico='')=>`<div class="cm-eyebrow">${ico?icon(ico):''}${text}</div>`;
 const title=(text)=>`<h1>${text}</h1>`;
 const desc=(text)=>`<p class="cm-description">${text}</p>`;
 const footer=(main,next='',tools=true)=>`<footer class="cm-footer">${next?`<div class="cm-upnext"><span>UP NEXT</span><span>${next}</span></div>`:''}${main}${tools?`<div class="cm-tools">${button(icon('volume-2')+' Read step','read','link')}${button(icon('list')+' Overview','overview','link')}</div>`:''}</footer>`;
 const rows=(items)=>items.map(([ico,name,status])=>`<div class="cm-smallrow">${icon(ico)}<div><b>${name}</b><p class="cm-quiet">${status}</p></div></div>`).join('');
 function body(k){
  const x=local[k], counter=k==='counter'; let main='',foot='';
  if(state==='preparing'){
   main=eyebrow('Make a little room for dinner')+title(recipe.title)+desc('A bright, simple supper.<br>Everything you need, one step at a time.')+`<div class="cm-prepmeta"><span class="cm-servings"><button class="cm-step cursor-interaction" type="button" data-act="servings-down" aria-label="Fewer servings"${servings<=Recipe.MIN_SERVINGS?' disabled':''}>${icon('minus')}</button><b aria-live="polite">${servings} ${plural(servings)}</b><button class="cm-step cursor-interaction" type="button" data-act="servings-up" aria-label="More servings"${servings>=Recipe.MAX_SERVINGS?' disabled':''}>${icon('plus')}</button></span><span>${icon('clock-3')}${recipe.time}</span></div>`+ingredients(Recipe.scaleRecipe(recipe,servings).map(i=>[i.name,i.qty,i.note]),'Ingredients')+`<details><summary>Equipment & preparation</summary><p>A pot, a saucepan, a grater and a chopping board. Review the full recipe before you begin.</p></details>`;
   foot=footer(button('Start cooking '+icon('arrow-right'),'active'),'',false);
  }else if(state==='active'){
   main=(counter?running(x):'')+eyebrow(`Now · step ${stepNo('parmesan')} of ${recipe.steps.length}`)+title(step('parmesan').title)+desc(step('parmesan').text)+ingredients(need(step('parmesan')))+`<div class="cm-cue">${icon('eye')}<span>Use the fine side of your grater.<br>The sauce timer will keep running.</span></div>`+(!counter?running(x):'');
   foot=footer(button('Parmesan is grated '+icon('arrow-right'),'waiting'),step('herbs').title.replace(/\.$/,''));
  }else if(state==='waiting'){
   main=eyebrow(x.due?'Attention needed':'A moment to let it cook','timer')+title(x.due?'Time to check<br>the sauce.':'The sauce<br>is simmering.')+(x.due?'<p class="cm-quiet">Timer finished · check still pending</p>':`<div class="cm-clock">06:24</div><p class="cm-quiet">Until your next check</p>`)+`<div class="cm-actions">${button('Check sauce','checkpoint','secondary')}${x.due?'':button('+1 min','extend','link')}</div>`;
   if(x.mode==='Assisted'&&!x.dismissed&&!x.due) main+=`<div class="cm-suggestion">${label('If you’d like')}<h3>Prepare the herbs<br>while it simmers?</h3><p class="cm-quiet">About 2 minutes · easy to put down</p><div class="cm-actions">${button('Prepare herbs '+icon('arrow-right'),'parallel')}${button('Not now','dismiss','link')}</div></div>`;
   else main+=`<div class="cm-section">${desc(x.due?'The sauce is not marked ready. Check it before continuing.':'Nothing else needs your attention right now.')}<p class="cm-quiet" style="margin-top:12px">${x.due?'Your other work is saved.':'Your sauce timer will keep running.'}</p></div>`;
   foot=footer(button(icon('list')+' View recipe','overview','secondary'),'',false);
  }else if(state==='parallel'){
   main=(counter?running(x):'')+eyebrow(x.herbsStarted?'Now · herbs in progress':'Next task · not started')+title(step('herbs').title)+desc(step('herbs').text)+ingredients(need(step('herbs')))+(!counter?running(x):'')+`<p class="cm-quiet" style="margin-top:18px">${x.herbsStarted?'You can put this down when the sauce needs checking.':'The sauce is still cooking. Start this task when you’re ready.'}</p>`;
   foot=footer(button((x.herbsStarted?'Herbs are done':'Start chopping')+' '+icon('arrow-right'),x.herbsStarted?'waiting':'start-herbs'),'Check the sauce');
  }else if(state==='checkpoint'){
   main=eyebrow('Check the sauce','eye')+title('Smooth and<br>lightly thickened?')+desc('Look for the consistency described in your recipe. The timer is a cue to check, rather than a sign it is ready.')+`<div class="cm-panel">${label('Your sauce timer')}<div class="cm-row" style="margin-top:10px"><span>Time to check</span>${icon('timer')}</div><p class="cm-quiet" style="margin-top:8px">Keep stirring gently as needed.</p></div><details><summary>Read the original instruction</summary><p>Simmer gently until the sauce lightly coats the back of a spoon. Stir occasionally.</p></details>`;
   foot=footer(button('Ready · stop sauce timer '+icon('check'),'finishing')+`<div class="cm-actions">${button('Not yet','not-yet','secondary')}${button('I’m unsure','unsure','link')}</div>`,'',false);
  }else if(state==='interrupted'){
   main=`<div class="cm-alert">${eyebrow('Your sauce needs a check','bell')}${title('Time to check<br>the sauce.')}${desc('Your sauce timer has finished. Check its consistency before continuing.')}<div style="margin-top:22px">${button('Check sauce '+icon('arrow-right'),'checkpoint')}</div>${button('Acknowledge · keep check pending','ack','link')}</div>`+`<div class="cm-section">${label('Your place is saved')}${rows([['scissors','Chop the herbs','Still in progress · not marked done']])}<p class="cm-quiet" style="margin-top:14px">Acknowledging silences this alert.<br>The sauce will still need checking.</p></div>`;
   foot=footer(button('Where was I?','recovery','secondary'),'',false);
  }else if(state==='recovery'){
   main=eyebrow('Welcome back')+title('Let’s pick up<br>from here.')+desc('Your last confirmed action was adding the lemon to the sauce.')+`<div class="cm-section">${label('Needs attention')}${rows([['timer','Sauce timer finished','Check the sauce · readiness unconfirmed']])}${button('Check sauce','checkpoint','link')}</div><div class="cm-section">${label('You were doing')}${rows([['scissors','Chopping the herbs','No completion recorded']])}</div>`+`<div class="cm-actions">${button('Still doing this','still','secondary')}${button('Already done','already','secondary')}</div>`;
   foot=footer(button('Resume cooking '+icon('arrow-right'),'resume'),'',false);
  }else if(state==='finishing'){
   main=eyebrow('The last little things')+title('Bring it<br>to the table.')+desc(step('serve').text)+ingredients(need(step('serve')).map(([n,q,t])=>n==='Fresh herbs'?['Prepared herbs','all',t]:[n,q,t]))+`<div class="cm-section">${rows([['check','Cooking checks resolved','Sauce and pasta confirmed ready'],['timer-off','No timers left running','All recipe timers reviewed']])}</div>`;
   foot=footer(button('Served · finish cooking '+icon('check'),'completed'),'',false);
  }else{
   main=`<div class="cm-complete">${icon('utensils')}${eyebrow(recipe.title)}${title('À table.')}${desc('Dinner is ready.<br>Enjoy what you’ve made.')}</div><div class="cm-section">${button(icon('notebook-pen')+' Add a cooking note','note','secondary')}<p class="cm-quiet" style="margin-top:13px">A substitution, a small adjustment,<br>something to remember next time.</p></div>`;
   foot=footer(button('Cook again '+icon('arrow-right'),'preparing'),'',false);
  }
  return `<header class="cm-top"><span class="cm-brand">${counter?'mise / cook mode':'mise.'}</span><button class="cm-mode" data-act="mode" type="button" aria-label="Assistance mode: ${x.mode}. Switch mode">${icon('sliders-horizontal')}${x.mode}</button></header><div class="cm-identity"><strong>${recipe.title}</strong><span>${state==='preparing'?'Recipe preview':state==='completed'?'Completed':servings+' '+plural(servings)}</span></div><main class="cm-body">${main}${x.note?`<p class="cm-notice" role="status">${x.note}</p>`:''}</main>${foot}`;
 }
 // Renders the selected screen in both design directions. Cooking actions here
 // demonstrate the interaction design; they are not a complete task engine.
 function render(){
  pick.value=state;
  directionPick.value = direction;
  shapePick.value = settings.shape;
  root.querySelectorAll('[data-variant]').forEach(section => {
    section.hidden = !section.querySelector('#cm-' + direction);
  });
  for(const k of ['journal','counter']){
   const el=root.querySelector('#cm-'+k); el.innerHTML=body(k);
   el.style.fontSize=settings.size+'px';
   el.style.setProperty('--cm-action-radius',settings.shape==='Circle'?'50%':'28px');
   if(k==='journal') el.style.borderRadius=settings.rounded+'px';
  }
  if(globalThis.lucide) lucide.createIcons({attrs:{width:18,height:18}});
 }
 // Local persistence is optional. Private browsing may disable storage.
 function save() {
   try {
     localStorage.setItem(STORAGE_KEY, JSON.stringify({
       modelContent: { screen: state, buttonShape: settings.shape, servings },
       privateContent: { direction, journal: local.journal.mode, counter: local.counter.mode }
     }));
   } catch { /* Keep the preview usable if storage is unavailable. */ }
 }
 function go(s){state=s;for(const k in local){local[k].note='';if(['interrupted','checkpoint','recovery'].includes(s))local[k].due=true;if(['preparing','active','finishing','completed'].includes(s))local[k].due=false;}render();save();root.querySelector('#cm-update').textContent=pick.options[pick.selectedIndex].text+' preview';}
 pick.addEventListener('change',()=>go(pick.value));
 root.addEventListener('click',e=>{
  const b=e.target.closest('[data-act]');if(!b)return;
  const app=b.closest('.cm-app'),k=app.id==='cm-journal'?'journal':'counter',x=local[k],a=b.dataset.act;
  if(permitted.includes(a)){if(a==='parallel'){x.herbsStarted=false;x.dismissed=true;}go(a);return;}
  if(a==='servings-up')servings=Recipe.clampServings(servings+1);
  if(a==='servings-down')servings=Recipe.clampServings(servings-1);
  if(a==='mode')x.mode=x.mode==='Guided'?'Assisted':'Guided';
  if(a==='dismiss')x.dismissed=true;
  if(a==='start-herbs')x.herbsStarted=true;
  if(a==='extend')x.note='Preview: add one minute to the sauce timer. The food is not marked ready.';
  if(a==='ack'){state='parallel';x.herbsStarted=true;x.note='Sauce check still pending. Your chopping task is unchanged.';}
  if(a==='not-yet')x.note='Continue cooking. Set your own check interval or continue untimed.';
  if(a==='unsure')x.note='Keep this check open. Use the original instruction to judge the sauce; nothing has been marked ready.';
  if(a==='read')x.note='Spoken-guidance preview: the current action, quantities and cooking cues would be read aloud.';
  if(a==='overview')x.note='Recipe overview: prepare → cook sauce → cook pasta → check components → combine → serve. Opening it does not change progress.';
  if(a==='still')x.note='Recorded: you are still chopping the herbs. The sauce check remains pending.';
  if(a==='already'){x.herbsDone=true;x.note='Herbs marked done. The sauce check is still unconfirmed.';}
  if(a==='resume'){state=x.herbsDone?'checkpoint':'parallel';x.herbsStarted=!x.herbsDone;x.note=x.herbsDone?'Herbs are complete. Check the sauce before continuing.':'Your place is restored. The sauce check remains pending.';}
  if(a==='note')x.note='Cooking-note preview: “Next time, reserve a little extra lemon zest for serving.”';
  render();save();
 });
 directionPick.addEventListener('change', () => {
   direction = directionPick.value;
   render();
   save();
 });
 shapePick.addEventListener('change', () => {
   settings.shape = shapePick.value;
   render();
   save();
 });
 render();
})();
