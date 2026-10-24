/* Native browser fields: iOS keyboards edit inputs, not Defold's canvas. */
(function () {
  'use strict';
  const names={difficulty:'NPC difficulty',server:'Server address',room:'Room code'};
  const fields=new Map(),buttons=new Map();
  let root,dialog,input,label,current=null,changes={};

  function clean(key,value) {
    if(key==='difficulty')return value.replace(/\D/g,'').slice(0,5);
    if(key==='room')return value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,16);
    return value.replace(/[\s\x00-\x1f\x7f]/g,'').slice(0,150);
  }
  function close() {
    if(!dialog)return;
    const opener=buttons.get(current);
    if(current)changes.commit=true;
    dialog.hidden=true;current=null;input.blur();
    if(opener)opener.focus({preventScroll:true});
  }
  function layout() {
    const canvas=document.getElementById('canvas');
    if(!canvas)return;
    const rect=canvas.getBoundingClientRect();
    for(const [key,button] of buttons) {
      const field=fields.get(key);
      Object.assign(button.style,{
        left:(rect.left+(field.x-field.width/2)*rect.width/720)+'px',
        top:(rect.top+(1280-field.y-field.height/2)*rect.height/1280)+'px',
        width:(field.width*rect.width/720)+'px',height:(field.height*rect.height/1280)+'px',
      });
    }
  }
  function mount() {
    if(root)return;
    const style=document.createElement('style');
    style.textContent=`
      #boardroom-field-controls{position:fixed;inset:0;pointer-events:none;z-index:20}
      .boardroom-field-trigger{position:fixed;pointer-events:auto;appearance:none;border:0;background:transparent;padding:0;cursor:text;touch-action:manipulation}
      .boardroom-field-trigger:focus-visible{outline:2px solid #52dbba;outline-offset:2px}
      #boardroom-editor{position:fixed;inset:0;z-index:30;background:#0b111cdd;pointer-events:auto;color:#f2edda;font:16px ui-monospace,SFMono-Regular,Consolas,monospace}
      #boardroom-editor-panel{box-sizing:border-box;position:absolute;top:max(16px,env(safe-area-inset-top));left:12px;right:12px;max-width:560px;margin:0 auto;padding:18px;background:#121b28;border:1px solid #334756;border-radius:8px;box-shadow:0 10px 40px #0008}
      #boardroom-editor-label{display:block;margin-bottom:12px;color:#52dbba;font-size:16px}
      #boardroom-editor-input{box-sizing:border-box;display:block;width:100%;min-height:48px;padding:10px;border:1px solid #52dbba;border-radius:4px;background:#1a2533;color:#f2edda;caret-color:#52dbba;font:18px ui-monospace,SFMono-Regular,Consolas,monospace;outline:none;-webkit-user-select:text;user-select:text}
      #boardroom-editor-done{display:block;margin:14px 0 0 auto;min-height:44px;padding:10px 24px;border:0;border-radius:4px;background:#52dbba;color:#0b111c;font:16px ui-monospace,SFMono-Regular,Consolas,monospace;cursor:pointer;touch-action:manipulation}
    `;
    document.head.appendChild(style);
    root=document.createElement('div');root.id='boardroom-field-controls';
    dialog=document.createElement('div');dialog.id='boardroom-editor';dialog.hidden=true;
    dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-labelledby','boardroom-editor-label');
    const panel=document.createElement('div');panel.id='boardroom-editor-panel';
    label=document.createElement('label');label.id='boardroom-editor-label';label.setAttribute('for','boardroom-editor-input');
    input=document.createElement('input');input.id='boardroom-editor-input';input.type='text';
    input.autocomplete='off';input.autocorrect='off';input.spellcheck=false;
    input.setAttribute('enterkeyhint','done');
    input.addEventListener('input',()=>{
      if(!current)return;
      const raw=input.value,value=clean(current,raw);
      if(raw!==value) {
        const start=clean(current,raw.slice(0,input.selectionStart)).length;
        const end=clean(current,raw.slice(0,input.selectionEnd)).length;
        input.value=value;input.setSelectionRange(start,end);
      }
      fields.get(current).value=value;changes[current]=value;
    });
    const done=document.createElement('button');done.id='boardroom-editor-done';done.type='button';done.textContent='Done';
    done.addEventListener('click',close);
    dialog.addEventListener('keydown',event=>{
      event.stopPropagation();
      if(event.key==='Escape'||(event.key==='Enter'&&event.target===input)){
        event.preventDefault();close();
      }else if(event.key==='Tab'){
        event.preventDefault();
        (document.activeElement===input?done:input).focus({preventScroll:true});
      }
    },true);
    panel.append(label,input,done);dialog.appendChild(panel);root.appendChild(dialog);document.body.appendChild(root);
    window.addEventListener('resize',layout);window.addEventListener('scroll',layout,true);
    if(window.visualViewport){window.visualViewport.addEventListener('resize',layout);window.visualViewport.addEventListener('scroll',layout);}
    if(typeof ResizeObserver==='function')new ResizeObserver(layout).observe(document.getElementById('canvas'));
  }
  function open(key) {
    const field=fields.get(key);
    if(!field)return;
    current=key;label.textContent=field.label||names[key];
    // Apply length limits after filtering in the input handler. DOM maxlength
    // would cut off a pasted value before spaces/punctuation can be removed.
    input.value=field.value;
    input.inputMode=key==='difficulty'?'numeric':key==='server'?'url':'text';
    input.setAttribute('autocapitalize',key==='room'?'characters':'off');
    dialog.hidden=false;
    // This runs directly inside the native field button's click handler. iOS
    // requires that user gesture to open its software keyboard reliably.
    input.focus({preventScroll:true});input.select();
  }
  window.BoardroomEditor=Object.freeze({
    sync(specifications) {
      mount();
      const present=new Set();
      for(const field of specifications) {
        if(!Object.hasOwn(names,field.key))continue;
        present.add(field.key);fields.set(field.key,{...field,value:String(field.value||'')});
        if(!buttons.has(field.key)) {
          const button=document.createElement('button');button.type='button';button.className='boardroom-field-trigger';
          button.setAttribute('aria-label','Edit '+names[field.key]);
          button.addEventListener('click',()=>open(field.key));
          root.appendChild(button);buttons.set(field.key,button);
        }
      }
      for(const [key,button] of buttons)if(!present.has(key)){button.remove();buttons.delete(key);fields.delete(key);}
      if(current&&!present.has(current))close();
      layout();
    },
    open,close,
    poll() {if(!Object.keys(changes).length)return '';const result=JSON.stringify(changes);changes={};return result;}
  });
})();
