// Game-like day/night orbit, using Beijing time rather than astronomical positions.
const palettes = [
  [0, ['#101b39','#344566','#b9c1d1','#1e293d','#172e42','#112132','#e6eef5','#b5c6d7','#abcfdf','#17293e','#4a617b'],0],
  [5, ['#1b2747','#6a657b','#c39891','#46465b','#323a50','#17263c','#e6eef5','#c2c3d3','#bdd5e5','#1b2e44','#5c6c85'],.05],
  [6, ['#7b8ab0','#deb9ad','#f7d4a4','#a2a4ad','#6c8e93','#fcf3e7','#34465a','#566578','#526e8c','#efe6df','#c4bbb7'],.35],
  [8, ['#83bad5','#c1dfdf','#e8eed6','#91b3b2','#659591','#f6faf3','#293f4b','#536d77','#447487','#e5eeec','#bacdcb'],1],
  [16, ['#83bad5','#c1dfdf','#e8eed6','#91b3b2','#659591','#f6faf3','#293f4b','#536d77','#447487','#e5eeec','#bacdcb'],1],
  [18, ['#777ba8','#c297a8','#edb997','#9990a2','#6f8294','#f7ebe5','#3d4159','#69637c','#826183','#eee1e3','#c9b7c3'],.4],
  [20, ['#101b39','#344566','#b9c1d1','#1e293d','#172e42','#112132','#e6eef5','#b5c6d7','#abcfdf','#17293e','#4a617b'],0],
  [24, ['#101b39','#344566','#b9c1d1','#1e293d','#172e42','#112132','#e6eef5','#b5c6d7','#abcfdf','#17293e','#4a617b'],0]
];
const names=['sky-top','sky-mid','sky-horizon','mountain-far','mountain-near','paper-rgb','ink','muted','accent','soft','line'];
const rgb=hex=>hex.match(/\w\w/g).map(part=>parseInt(part,16));

export function skyState(hour) {
  if(!Number.isFinite(hour)) throw new TypeError('Time must be finite');
  hour=((hour%24)+24)%24;
  const day=hour>=6&&hour<18;
  const progress=day?(hour-6)/12:((hour-18+24)%24)/12;
  const upper=palettes.findIndex(stop=>stop[0]>hour);
  const before=palettes[upper-1],after=palettes[upper];
  const fraction=(hour-before[0])/(after[0]-before[0]);
  const colors=Object.fromEntries(names.map((name,index)=>{
    const a=rgb(before[1][index]),b=rgb(after[1][index]);
    const value=a.map((part,channel)=>Math.round(part+(b[channel]-part)*fraction)).join(',');
    return [name,name==='paper-rgb'?value:`rgb(${value})`];
  }));
  const daylight=before[2]+(after[2]-before[2])*fraction;
  // Keep each card palette within a readable light or dark range.
  const warmth=day?Math.max(0,Math.min(1,(8-hour)/2),Math.min(1,(hour-16)/2)):hour<6?Math.max(0,(hour-4)/2):Math.max(0,(20-hour)/2);
  const cardBase=day?palettes[3][1]:palettes[0][1];
  const cardWarm=day?palettes[2][1]:palettes[1][1];
  names.slice(5).forEach((name,index)=>{
    const a=rgb(cardBase[index+5]),b=rgb(cardWarm[index+5]);
    const value=a.map((part,channel)=>Math.round(part+(b[channel]-part)*warmth)).join(',');
    colors[name]=name==='paper-rgb'?value:`rgb(${value})`;
  });
  return {hour,day,progress,x:8+84*progress,y:172-112*Math.sin(Math.PI*progress),daylight,colors,
    label:hour<5?'深夜':hour<8?'清晨':hour<17?'白昼':hour<20?'黄昏':'夜晚'};
}

if(typeof document!=='undefined') {
  const root=document.documentElement;
  const clock=document.querySelector('.world-clock');
  const range=document.querySelector('.time-range');
  const output=document.querySelector('.time-output');
  const format=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  let preview=null;
  function render() {
    const parts=format.format(new Date()).split(':').map(Number);
    const hour=preview===null?parts[0]+parts[1]/60+parts[2]/3600:preview/60;
    const state=skyState(hour);
    const minutes=preview===null?parts[0]*60+parts[1]:preview;
    const time=`${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;
    for(const [name,value] of Object.entries(state.colors))root.style.setProperty('--'+name,value);
    root.style.setProperty('--paper',`rgba(${state.colors['paper-rgb']},.93)`);
    root.style.setProperty('--bg',state.colors['sky-top']);
    root.style.setProperty('--star-opacity',String(1-state.daylight));
    root.style.setProperty('--cloud-opacity',String(.15+.45*state.daylight));
    root.style.setProperty('--celestial-x',state.x+'%');
    root.style.setProperty('--celestial-y',state.y+'px');
    root.style.colorScheme=state.day?'light':'dark';
    document.body.dataset.period=state.day?'day':'night';
    document.body.dataset.hour=hour.toFixed(4);
    clock.textContent=`${state.day?'☀':'☾'} ${time} · ${state.label}`;
    document.querySelector('.world-mode').textContent=preview===null?'北京时间 / 此刻':'时光预览 / 北京时间';
    output.textContent=time;
    if(preview===null)range.value=String(parts[0]*60+parts[1]);
  }
  range.addEventListener('input',()=>{preview=Number(range.value);render()});
  document.querySelector('.time-reset').addEventListener('click',()=>{preview=null;render()});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)render()});
  render();setInterval(render,30000);
}
