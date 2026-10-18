import scribe from 'scribe.js-ocr';
import './style.css';

const app = document.querySelector('#app');
app.innerHTML = `
<header><div class="brandmark">PV</div><div><h1>PageVoice <span>Plus</span></h1><p>Read PDFs. Listen naturally. Keep your files private.</p></div></header>
<main>
  <section class="panel upload-panel">
    <div class="eyebrow">YOUR READING DESK</div>
    <h2>Bring a PDF to life</h2>
    <p class="muted">Text extraction and OCR run in your browser. Your PDF is not uploaded to a server.</p>
    <label class="file-button" for="pdfFile">Choose PDF</label><input id="pdfFile" type="file" accept="application/pdf,.pdf" />
    <div id="fileName" class="small muted">No PDF selected</div>
    <div id="status" class="status" role="status">Ready when you are.</div>
    <div class="privacy-note">First use needs internet to load this app. For OCR, language data and app files must be hosted with the app before reliable offline use is possible.</div>
  </section>
  <section class="panel controls">
    <div class="eyebrow">LISTENING CONTROLS</div>
    <div class="control-grid">
      <label>Voice<select id="voice"><option value="">System default</option></select></label>
      <label>Speed <strong id="rateLabel">1.0×</strong><input id="rate" type="range" min="0.65" max="1.6" value="1" step="0.05"></label>
    </div>
    <div class="buttons"><button id="play" class="primary" disabled>▶ Read aloud</button><button id="pause" disabled>Ⅱ Pause</button><button id="stop" disabled>■ Stop</button></div>
    <div class="progress-wrap"><div id="progress"></div></div><div id="progressText" class="small muted">0% read</div>
  </section>
  <section class="panel text-panel">
    <div class="section-head"><div><div class="eyebrow">EXTRACTED TEXT</div><h2>Check before listening</h2></div><button id="downloadText" disabled>Save .txt</button></div>
    <p class="muted small">If the preview still has broken spacing, try OCR extraction. OCR may take time and can make mistakes; review the result before listening.</p>
    <div class="buttons extract-buttons"><button id="normalExtract" disabled>Extract PDF text</button><button id="ocrExtract" disabled>Repair with OCR</button></div>
    <textarea id="text" placeholder="Your PDF text will appear here. You can edit it before reading aloud…" spellcheck="false"></textarea>
    <div class="small muted" id="textStats">No text loaded.</div>
  </section>
  <section class="panel qa-panel">
    <div class="eyebrow">ASK ABOUT THE TEXT</div><h2>Question desk</h2>
    <p class="muted small">This starter version searches the text currently in the preview and returns relevant passages. It is not a generative AI model and does not automatically know which words you have heard.</p>
    <form id="questionForm"><input id="question" placeholder="Ask a question about this document…" autocomplete="off"><button class="primary" type="submit">Find answer</button></form>
    <div id="answer" class="answer muted">Your matching passages will appear here.</div>
  </section>
  <footer>PageVoice Plus · Browser-based prototype · Scribe.js is AGPL-3.0 licensed. See README before redistributing or hosting.</footer>
</main>`;

const $ = (id) => document.getElementById(id);
let extracted = '';
let chunks = [];
let currentChunk = 0;
let voices = [];
let playToken = 0;
const fileInput = $('pdfFile');

function setStatus(msg, error=false) { $('status').textContent = msg; $('status').classList.toggle('error', error); }
function normalizeText(s) {
  return s.replace(/\u00ad\s*\n/g, '')
    .replace(/[\u2010-\u2015]\s*\n(?=[a-z])/g, '')
    .replace(/[\t\u00a0]+/g, ' ')
    .replace(/([a-zA-Z])\n([a-zA-Z])/g, (m,a,b) => /[.!?:;]$/.test(a) ? `${a}\n${b}` : `${a} ${b}`)
    .replace(/ {2,}/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\b(?:[A-Za-z]\s){3,}[A-Za-z]\b/g, m => m.replace(/\s/g,''))
    .trim();
}
function refreshText() {
  const t = $('text').value;
  const words = t.trim() ? t.trim().split(/\s+/).length : 0;
  $('textStats').textContent = `${words.toLocaleString()} words · ${t.length.toLocaleString()} characters`;
  $('downloadText').disabled = !t.trim();
  $('play').disabled = !t.trim();
  $('progressText').textContent = `${Math.round((currentChunk / Math.max(chunks.length,1))*100)}% read`;
}
function makeChunks() {
  const paras = $('text').value.split(/\n\s*\n/).map(p=>p.trim()).filter(Boolean);
  chunks = [];
  for (const p of (paras.length ? paras : [$('text').value.trim()])) {
    // Keep utterances manageable and avoid splitting inside a word.
    let rest = p;
    while (rest.length > 1100) {
      let cut = Math.max(rest.lastIndexOf('. ', 1100), rest.lastIndexOf('? ', 1100), rest.lastIndexOf('! ', 1100), rest.lastIndexOf(' ', 1100));
      if (cut < 350) cut = 1100;
      chunks.push(rest.slice(0, cut).trim()); rest = rest.slice(cut).trim();
    }
    if (rest) chunks.push(rest);
  }
  currentChunk = 0; refreshText();
}
function populateVoices() {
  voices = speechSynthesis.getVoices(); const select=$('voice'); const old=select.value;
  select.innerHTML='<option value="">System default</option>';
  voices.forEach((v,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent=`${v.name} (${v.lang})${v.default?' · default':''}`;select.append(o)});
  if(old) select.value=old;
}
if ('speechSynthesis' in window) { populateVoices(); speechSynthesis.onvoiceschanged=populateVoices; }
fileInput.addEventListener('change', () => {
  const file=fileInput.files?.[0]; if(!file) return;
  $('fileName').textContent=`${file.name} · ${(file.size/1024/1024).toFixed(1)} MB`;
  ['normalExtract','ocrExtract'].forEach(id=>$(id).disabled=false);
  $('text').value=''; extracted=''; chunks=[]; refreshText(); setStatus('PDF selected. Choose text extraction or OCR.');
});
async function extract(ocr) {
  const file=fileInput.files?.[0]; if(!file) return;
  stopReading(); setStatus(ocr ? 'Running OCR… Large PDFs can take several minutes.' : 'Extracting text…');
  $('normalExtract').disabled=$('ocrExtract').disabled=true;
  try {
    const doc=await scribe.openDocument([file]);
    if(ocr) await doc.recognize({langs:['eng']});
    let result=await doc.exportData('text');
    if(typeof result !== 'string') result=String(result ?? '');
    extracted=normalizeText(result);
    $('text').value=extracted;
    makeChunks();
    setStatus(ocr ? 'OCR finished. Review the text for recognition mistakes.' : 'Extraction finished. Check word spacing before listening.');
    if(!extracted) setStatus('No text was found. Try OCR, or check whether the PDF is protected.', true);
    if(doc.terminate) await doc.terminate();
  } catch(err) {
    console.error(err); setStatus(`Could not process this PDF: ${err?.message || err}. Try a smaller PDF or another file.`,true);
  } finally { $('normalExtract').disabled=false; $('ocrExtract').disabled=false; }
}
$('normalExtract').addEventListener('click',()=>extract(false));
$('ocrExtract').addEventListener('click',()=>extract(true));
$('text').addEventListener('input',()=>{makeChunks();});
$('rate').addEventListener('input',()=>{$('rateLabel').textContent=`${Number($('rate').value).toFixed(2).replace(/0$/,'')}×`;});
function stopReading() { playToken++; if('speechSynthesis' in window) speechSynthesis.cancel(); $('pause').disabled=true; $('stop').disabled=true; }
function speakNext(token) {
  if(token!==playToken || currentChunk>=chunks.length) { $('pause').disabled=true; $('stop').disabled=true; return; }
  const utterance=new SpeechSynthesisUtterance(chunks[currentChunk]);
  const v=$('voice').value; if(v!=='' && voices[Number(v)]) utterance.voice=voices[Number(v)];
  utterance.rate=Number($('rate').value);
  utterance.onend=()=>{ if(token!==playToken)return; currentChunk++; $('progress').style.width=`${Math.min(100,currentChunk/Math.max(chunks.length,1)*100)}%`; refreshText(); speakNext(token); };
  utterance.onerror=(e)=>{ if(token===playToken && e.error!=='canceled') setStatus(`Speech stopped: ${e.error}`,true); };
  speechSynthesis.speak(utterance); $('pause').disabled=false; $('stop').disabled=false;
}
$('play').addEventListener('click',()=>{ if(!('speechSynthesis' in window)){setStatus('This browser does not support speech synthesis.',true);return;} makeChunks(); if(!chunks.length)return; if(currentChunk>=chunks.length)currentChunk=0; stopReading(); const token=playToken; setStatus(`Reading section ${currentChunk+1} of ${chunks.length}.`); speakNext(token); });
$('pause').addEventListener('click',()=>{ if(speechSynthesis.paused){speechSynthesis.resume();$('pause').textContent='Ⅱ Pause';}else{speechSynthesis.pause();$('pause').textContent='▶ Resume';} });
$('stop').addEventListener('click',()=>{stopReading();setStatus('Reading stopped.');});
$('downloadText').addEventListener('click',()=>{const blob=new Blob([$('text').value],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='pagevoice-extracted.txt';a.click();URL.revokeObjectURL(url);});
$('questionForm').addEventListener('submit',e=>{
  e.preventDefault(); const q=$('question').value.trim(); const text=$('text').value;
  if(!q||!text.trim()){ $('answer').textContent='Load a PDF and extract its text first.'; return; }
  const terms=q.toLowerCase().match(/[a-z0-9]{3,}/g)||[];
  const paras=text.split(/\n\s*\n|(?<=[.!?])\s+(?=[A-Z])/).filter(p=>p.trim());
  const ranked=paras.map(p=>({p,score:terms.reduce((n,t)=>n+(p.toLowerCase().match(new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'))||[]).length,0)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,4);
  $('answer').innerHTML=ranked.length?`<strong>Relevant passages</strong>${ranked.map(x=>`<blockquote>${escapeHtml(x.p.slice(0,900))}${x.p.length>900?'…':''}</blockquote>`).join('')}`:'No strong keyword match found. Try using important words from the document.';
});
function escapeHtml(s){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
refreshText();
