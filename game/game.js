const lobbyEl = document.getElementById('lobby');
const deckSelectorEl = document.getElementById('deck-selector');
const gameEl = document.getElementById('game');
const invitationModal = document.getElementById('invitation-modal');
const joinBtn = document.getElementById('join');
const roomInput = document.getElementById('room');
let playerPseudo = 'Player';
const handEl = document.getElementById('hand');
const infoEl = document.getElementById('info');
const opponentEl = document.getElementById('opponent');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let localPlayerId = localStorage.getItem('playerId') || null;
let currentRoom = null;
let draggingCardId = null;
let draggingEmoji = null;
let dragPos = null;
let justDragged = false;
let evtSource = null;
let selectedDeck = [];
let currentRoomId = null;
let isInvitationAccepted = false;
let isInvitationWaiting = false;

function showGameEndedOverlay(winnerId, winnerName){
  const isWinner = winnerId === localPlayerId;
  const overlay = document.createElement('div');
  overlay.className = 'game-end-overlay';

  const content = document.createElement('div');
  content.className = 'game-end-card ' + (isWinner ? 'game-end-win' : 'game-end-loss');

  if (isWinner) {
    content.innerHTML = `<div class="game-end-emoji">🎉</div><div class="game-end-title emerald">VICTOIRE!</div><div class="game-end-sub">Tu as vaincu <strong>${winnerName}</strong></div>`;
  } else {
    content.innerHTML = `<div class="game-end-emoji">😢</div><div class="game-end-title" style="color:#ef4444">DÉFAITE</div><div class="game-end-sub"><strong>${winnerName}</strong> a gagné</div>`;
  }

  overlay.appendChild(content);
  document.body.appendChild(overlay);

  setTimeout(() => {
    window.location.href = `../index/index.html`;
  }, 3000);
}

const clientState = {
  prev: null,
  target: null,
  prevTime: 0,
  targetTime: 0,
  renderDelay: 120,
};
function deepCopy(obj){ return JSON.parse(JSON.stringify(obj)); }
function handleServerSnapshot(room){
  const now = Date.now();
  if (clientState.target){ clientState.prev = clientState.target; clientState.prevTime = clientState.targetTime; }
  else { clientState.prev = deepCopy(room); clientState.prevTime = now - 60; }
  clientState.target = deepCopy(room); clientState.targetTime = now;
}

document.addEventListener('pointermove', (ev)=>{ if (!draggingCardId) return; dragPos = { x: ev.clientX, y: ev.clientY }; }, { passive: true });
document.addEventListener('pointerup', (ev)=>{
  document.body.classList.remove('is-dragging');
  if (!draggingCardId) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (ev.clientX - rect.left) * scaleX;
  const y = (ev.clientY - rect.top) * scaleY;
  const overCanvas = ev.clientX >= rect.left && ev.clientX <= rect.right && ev.clientY >= rect.top && ev.clientY <= rect.bottom;
  if (overCanvas) playCard(draggingCardId, { x: Math.round(x), y: Math.round(y) }); else playCard(draggingCardId);
  draggingCardId = null; draggingEmoji = null; dragPos = null; justDragged = true; setTimeout(()=>{ justDragged = false; }, 60);
});

let shake = { intensity: 0, duration: 0, start: 0 };
function triggerScreenShake(intensity = 6, duration = 350){ shake.intensity = intensity; shake.duration = duration; shake.start = Date.now(); }

// Cache pour les images chargées
const imageCache = {};
function loadImage(url) {
  if (!url) return null;
  if (imageCache[url]) return imageCache[url];
  
  const img = new Image();
  img.src = url;
  imageCache[url] = img;
  return img;
}

function drawImage(ctx, x, y, size, imageUrl, fallbackEmoji) {
  if (!imageUrl) {
    ctx.font = (size + 6) + 'px serif';
    ctx.textAlign = 'center';
    ctx.fillText(fallbackEmoji || '❓', x, y + size / 3);
    return;
  }
  
  const img = loadImage(imageUrl);
  if (img && img.complete && img.naturalWidth > 0) {
    try {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, size / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
      ctx.restore();
    } catch (e) {
      // Fallback si erreur
      ctx.font = (size + 6) + 'px serif';
      ctx.textAlign = 'center';
      ctx.fillText(fallbackEmoji || '❓', x, y + size / 3);
    }
  } else {
    // Image pas chargée encore, affiche emoji
    ctx.font = (size + 6) + 'px serif';
    ctx.textAlign = 'center';
    ctx.fillText(fallbackEmoji || '❓', x, y + size / 3);
  }
}

function renderTick(){
  requestAnimationFrame(renderTick);
  const now = Date.now();
  const renderTime = now - clientState.renderDelay;

  let sx = 0, sy = 0;
  if (shake.duration > 0){ const elapsed = now - shake.start; if (elapsed < shake.duration){ const p = 1 - (elapsed / shake.duration); const mag = shake.intensity * p; sx = (Math.random()*2-1) * mag; sy = (Math.random()*2-1) * mag; } else { shake.duration = 0; } }

  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,canvas.width, canvas.height);
  ctx.translate(sx, sy);

  if (currentRoom && currentRoom.players.length > 0){
    const me = currentRoom.players.find(p=>p.id === localPlayerId);
    if (me){
      const playerIndex = currentRoom.players.indexOf(me);
      let zone;
      if (me.view === 'vertical'){
        zone = playerIndex === 0 
          ? { x: 0, y: 0, w: 900, h: 200 }
          : { x: 0, y: 200, w: 900, h: 200 };
      } else {
        zone = playerIndex === 0 
          ? { x: 0, y: 0, w: 450, h: 400 }
          : { x: 450, y: 0, w: 450, h: 400 };
      }
      ctx.save();
      ctx.fillStyle = '#22c55e';
      ctx.globalAlpha = 0.15;
      ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
      ctx.restore();
    }
  }

  if (draggingCardId && dragPos){ const rect = canvas.getBoundingClientRect(); const gx = dragPos.x - rect.left; const gy = dragPos.y - rect.top; if (gx>=0 && gx<=canvas.width && gy>=0 && gy<=canvas.height){ ctx.save(); ctx.globalAlpha=0.85; 
  // Trouver la carte en train d'être traînée pour obtenir son lien
  let cardLink = '';
  if (currentRoom) {
    const me = currentRoom.players.find(p => p.id === localPlayerId);
    if (me) {
      const card = me.hand.find(c => c.id === draggingCardId);
      if (card) {
        cardLink = card.link || '';
        draggingEmoji = card.emoji || '❓';
      }
    }
  }
  drawImage(ctx, gx, gy, 40, cardLink, draggingEmoji || '❓'); 
  ctx.restore(); } }
  ctx.font = '28px serif'; ctx.textAlign='left'; ctx.fillText('🏰', 8, canvas.height/2); ctx.textAlign='right'; ctx.fillText('🏰', canvas.width-8, canvas.height/2);

  const prev = clientState.prev; const target = clientState.target; let t = 1;
  if (prev && target){ const dt = Math.max(1, clientState.targetTime - clientState.prevTime); t = (renderTime - clientState.prevTime) / dt; t = Math.max(0, Math.min(1, t)); }

  const drawnIds = new Set();
  if (target && target.entities){
    for (const te of target.entities.filter(e=>e.type==='aoe')){
      const pe = prev && prev.entities ? prev.entities.find(x=>x.id===te.id) : null;
      const x = te.x, y = te.y, r = te.radius || 40;
      if (te.subtype === 'frost'){
        ctx.save(); ctx.globalAlpha=0.18; ctx.fillStyle='#59f'; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill(); ctx.restore();
        drawImage(ctx, x, y + 8, 22, te.link, '❄️');
      } else if (te.subtype === 'heal'){
        const pulse = 0.9 + 0.1 * Math.sin(Date.now()/180);
        ctx.save(); ctx.globalAlpha=0.12; ctx.fillStyle='#6f6'; ctx.beginPath(); ctx.arc(x,y,r*pulse,0,Math.PI*2); ctx.fill(); ctx.restore(); 
        drawImage(ctx, x, y + 8, 22, te.link, '✨');
      } else {
        ctx.save(); ctx.globalAlpha=0.45; ctx.fillStyle='orange'; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill(); ctx.restore(); 
        drawImage(ctx, x, y + 8, 24, te.link, te.emoji||'💥');
      }
      drawnIds.add(te.id);
    }

    for (const te of target.entities.filter(e=>e.type==='projectile')){
      const pe = prev && prev.entities ? prev.entities.find(x=>x.id===te.id) : null;
      let x = te.x, y = te.y;
      if (pe){ x = pe.x + (te.x - pe.x) * t; y = pe.y + (te.y - pe.y) * t; }
      ctx.save(); ctx.globalAlpha=0.95; 
      drawImage(ctx, x, y, 20, te.link, te.emoji||'➡️'); 
      ctx.restore(); 
      drawnIds.add(te.id);
    }

    for (const te of target.entities.filter(e=>e.type==='unit')){
      const pe = prev && prev.entities ? prev.entities.find(x=>x.id===te.id) : null;
      let x = te.x, y = te.y, hp = te.hp, emoji = te.emoji||'❓';
      if (pe){ x = pe.x + (te.x - pe.x) * t; y = pe.y + (te.y - pe.y) * t; hp = pe.hp + (te.hp - pe.hp) * t; }
      const isFlying = !!te.isFlying;
      const yOffset = isFlying ? -12 : 0;
      drawImage(ctx, x+20, y+28 + yOffset, 34, te.link, emoji);
      if (te.attackAnim && te.attackAnim > 0){
        const p = te.attackAnim / (te.attackAnimMax||6);
        const cx2 = x+20, cy2 = y+28 + yOffset;
        const r1 = 20 + p*14, r2 = r1 + 5;
        ctx.save();
        const gAtk = ctx.createRadialGradient(cx2, cy2, r1*0.4, cx2, cy2, r2);
        gAtk.addColorStop(0, `rgba(255,220,0,${0.7*p})`);
        gAtk.addColorStop(0.5, `rgba(255,140,0,${0.4*p})`);
        gAtk.addColorStop(1, `rgba(255,60,0,0)`);
        ctx.fillStyle = gAtk;
        ctx.beginPath(); ctx.arc(cx2, cy2, r2, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = `rgba(255,220,50,${0.85*p})`;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = 'rgba(255,200,0,0.9)';
        ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(cx2, cy2, r1, 0, Math.PI*2); ctx.stroke();
        const dmgTxt = te.dmg ? `-${te.dmg}` : '!';
        ctx.font = `bold ${10 + p*4}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.shadowBlur = 6;
        ctx.shadowColor = 'rgba(255,100,0,0.9)';
        ctx.fillStyle = `rgba(255,255,80,${p})`;
        ctx.fillText(dmgTxt, cx2, cy2 - r1 - 4 - p*6);
        ctx.restore();
      }
      const hpRatio = Math.max(0, Math.min(1, (hp||0) / (te.maxHp||10)));
      const bx = x+4, by = y+2 + yOffset, bw = 40, bh = 6, br = 3;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 4;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath(); ctx.roundRect(bx-1, by-1, bw+2, bh+2, br+1); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, br); ctx.fill();
      if (hpRatio > 0){
        const hpColor = hpRatio > 0.55 ? ['#22c55e','#16a34a','rgba(74,222,128,0.7)'] : hpRatio > 0.28 ? ['#facc15','#ca8a04','rgba(250,204,21,0.7)'] : ['#ef4444','#b91c1c','rgba(239,68,68,0.7)'];
        const gHp = ctx.createLinearGradient(bx, by, bx, by+bh);
        gHp.addColorStop(0, hpColor[0]);
        gHp.addColorStop(1, hpColor[1]);
        ctx.fillStyle = gHp;
        ctx.beginPath(); ctx.roundRect(bx, by, bw*hpRatio, bh, br); ctx.fill();
        ctx.shadowColor = hpColor[2]; ctx.shadowBlur = 5;
        ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.roundRect(bx, by, bw*hpRatio, bh, br); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.beginPath(); ctx.roundRect(bx+1, by+1, (bw*hpRatio - 2)*0.7, 2, 1); ctx.fill();
      }
      const hpVal = Math.ceil(hp||0);
      ctx.font = 'bold 7px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 3;
      ctx.fillText(`${hpVal}/${te.maxHp||10}`, bx + bw/2, by + bh - 0.5);
      ctx.restore();
      drawnIds.add(te.id);
    }
  }

  if (prev && prev.entities){ for (const pe of prev.entities){ if (drawnIds.has(pe.id)) continue; const x = pe.x, y = pe.y, emoji = pe.emoji || '❓'; ctx.save(); ctx.globalAlpha = 0.28; drawImage(ctx, x+20, y+28, 34, pe.link, emoji); ctx.restore(); } }
}
requestAnimationFrame(renderTick);

function startEventSource(roomId){
  if (evtSource) evtSource.close();
  const token = window.BrainrotAuth?.getToken?.() || '';
  evtSource = new EventSource(
    'https://bstests.leogib.fr/game/events?roomId=' + encodeURIComponent(roomId) +
    '&playerId=' + encodeURIComponent(localPlayerId || '') +
    '&token=' + encodeURIComponent(token)
  );
  evtSource.onmessage = (ev)=>{
    try { 
      const data = JSON.parse(ev.data); 
      if (!data || !data.type) return;
      
      if (data.type === 'roomUpdate'){ 
        currentRoom = data.payload;
        
        // Vérifier si on doit afficher le jeu ou si on attend toujours
        const invModalVisible = invitationModal.style.display === 'flex';
        const gameVisible = gameEl.style.display === 'block';
        
        if (invModalVisible) {
          // On est encore en phase d'invitation
          if (currentRoom.players.length === 2) {
            const opponent = currentRoom.players.find(p => p.id !== localPlayerId);
            const bothReady = currentRoom.players.every(p => p.deckReady === true);
            
            const title = document.getElementById('invitation-title');
            const message = document.getElementById('invitation-message');
            const waitingBtn = document.getElementById('waiting-btn');
            
            // Premier joueur en attente : afficher quand le deuxième rejoint
            if (isInvitationWaiting && !isInvitationAccepted && opponent) {
              console.log('SSE: Joueur 2 a rejoint, opponent deckReady:', opponent.deckReady);
              title.textContent = '🤝 ' + opponent.name + ' a rejoint !';
              
              if (opponent.deckReady) {
                message.textContent = '✅ ' + opponent.name + ' a accepté ! Démarrage du combat...';
              } else {
                message.textContent = 'En attente que ' + opponent.name + ' accepte son invitation...';
              }
            } else if (isInvitationAccepted && opponent) {
              // Deuxième joueur qui a accepté : afficher l'état du premier
              console.log('SSE: Je suis joueur 2, opponent deckReady:', opponent.deckReady);
              if (opponent.deckReady) {
                title.textContent = '✅ Prêt !';
                message.textContent = 'L\'autre joueur est prêt ! Démarrage du combat...';
              }
            }
            
            // Les deux sont prêts, démarrer le jeu
            if (bothReady) {
              console.log('SSE: Les deux sont prêts, startGame=', currentRoom.started);
              title.textContent = '🚀 Démarrage...';
              message.textContent = 'Tous les joueurs sont prêts !';
              
              if (currentRoom.started) {
                setTimeout(() => {
                  console.log('SSE: Affichage du jeu');
                  invitationModal.style.display = 'none';
                  gameEl.style.display = 'block';
                  handleServerSnapshot(currentRoom);
                  renderRoom(currentRoom);
                }, 600);
              }
            }
          }
        } else if (gameVisible) {
          // Si le jeu est visible, mettre à jour
          handleServerSnapshot(currentRoom);
          renderRoom(currentRoom);
        }
      } else if (data.type === 'playFailed'){ 
        alert('Play failed: ' + (data.payload && data.payload.reason ? data.payload.reason : 'unknown')); 
      } else if (data.type === 'gameEnded'){ 
        showGameEndedOverlay(data.payload.winnerId, data.payload.winnerName); 
        triggerScreenShake(15, 600); 
      } else if (data.type === 'effect'){ 
        if (data.payload && data.payload.effect === 'screenShake'){ 
          triggerScreenShake(data.payload.intensity||6, data.payload.duration||300); 
        } 
      }
    }
    catch(err){ console.error('SSE error:', err); }
  };
  evtSource.onerror = ()=>{ console.error('SSE connection error'); };
}

joinBtn.addEventListener('click', async ()=>{
  showDeckSelector();
});

document.getElementById('invite-btn')?.addEventListener('click', async () => {
  let room = roomInput.value.trim();
  
  // Si pas de room spécifiée, générer un UUID aléatoire
  if (!room) {
    // Générer un UUID v4 simplifié
    room = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0,
            v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
    roomInput.value = room;
  }
  
  // Créer l'URL d'invitation
  const url = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(room)}`;
  
  // Copier/partager le lien
  if (navigator.share) {
    navigator.share({ 
      title: 'BrainrotStars — Combat', 
      text: 'Rejoins mon arène !', 
      url 
    });
  } else {
    navigator.clipboard.writeText(url).then(() => {
      alert('🔗 Lien copié !\n\nArène: ' + room + '\n\nPartage-le à ton ami !');
    }).catch(() => {
      // Fallback si clipboard échoue
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('🔗 Lien copié !\n\nArène: ' + room + '\n\nPartage-le à ton ami !');
    });
  }
});

(async () => {
  try {
    const token = window.BrainrotAuth?.getToken?.() || '';
    if (!token) return;
    const res = await fetch('https://bstests.leogib.fr/user/stats', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return;
    const payload = await res.json();
    if (payload?.success && payload?.value?.pseudo) {
      playerPseudo = payload.value.pseudo;
    }
  } catch {}

  const params = new URLSearchParams(window.location.search);
  if (params.get('room')) {
    roomInput.value = params.get('room');
    joinBtn.click();
  }
})();

function renderRoom(room){
  const me = room.players.find(p=>p.id === localPlayerId);
  localPlayerId = me ? me.id : localPlayerId;
  const opponent = room.players.find(p=>p.id !== localPlayerId) || {name:'Waiting...', hp:'-'};
  opponentEl.innerHTML = `<span style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;">Adversaire</span><br><span style="font-weight:900;font-size:1.1rem;">${opponent.name}</span> <span class="emerald" style="font-size:0.9rem;">❤️ ${opponent.hp}</span>`;
  const mana = me ? (me.mana||0) : 0;
  const maxMana = me ? (me.maxMana||10) : 10;
  let manaPips = '';
  for(let i=0;i<maxMana;i++) manaPips += `<div class="mana-pip ${i<mana?'filled':''}"></div>`;
  infoEl.innerHTML = `<span style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;">Toi</span><br><span style="font-weight:900;font-size:1.1rem;">${me?me.name:''}</span> <span style="color:#ef4444;font-size:0.9rem;">❤️ ${me?me.hp:'-'}</span><div class="mana-bar" style="justify-content:center;margin-top:6px;">${manaPips}</div>`;

  handEl.innerHTML = '';
  if (me){ me.hand.forEach(card=>{ if (!card) return; const c = document.createElement('div'); c.className='btn-card hand-card'; c.dataset.cardId = card.id; c.addEventListener('pointerdown', (ev)=>{ const affordable = (me.mana || 0) >= card.cost; if (!affordable) return; document.body.classList.add('is-dragging'); draggingCardId = card.id; draggingEmoji = card.emoji || '❓'; dragPos = { x: ev.clientX, y: ev.clientY }; }); c.ondragstart = (ev)=>ev.preventDefault(); const affordable = (me.mana || 0) >= card.cost; if (!affordable) c.classList.add('card-unaffordable'); 
  // Afficher l'image si disponible
  const cardImage = card.link ? `<img src="${card.link}" style="width:100%; height:100%; object-fit:cover; border-radius:4px; display:block;">` : `<div class="card-emoji">${card.emoji||''}</div>`;
  c.innerHTML = `<div class="card-cost">${card.cost}</div>${cardImage}<div class="card-name">${card.name}</div>`; 
  c.onclick = ()=>{ if (affordable && !justDragged) playCard(card.id); }; handEl.appendChild(c); }); }
}

async function playCard(cardId, targetPos){
  if (!currentRoom) return; if (!localPlayerId) return alert('You must join first');
  
  // Validate placement zone for units only
  const me = currentRoom.players.find(p => p.id === localPlayerId);
  const card = me?.hand.find(c => c.id === cardId);
  
  if (card && card.type === 'unit' && targetPos) {
    if (!isValidPlacement(me, targetPos)) {
      alert('Tu ne peux placer des cartes que sur ta zone de jeu!');
      return;
    }
  }
  
  const payload = { roomId: currentRoom.id, playerId: localPlayerId, cardId };
  if (targetPos) payload.targetPos = targetPos;
  try{
    const token = window.BrainrotAuth?.getToken?.() || '';
    const res = await fetch('https://bstests.leogib.fr/game/play', { method: 'POST', headers: {'Content-Type':'application/json', 'Authorization': `Bearer ${token}`}, body: JSON.stringify(payload) });
    if (!res.ok){ const err = await res.json().catch(()=>({error:'play failed'})); alert('Play failed: '+(err && err.error?err.error:res.status)); }
  } catch(e){ console.error(e); }
}

function isValidPlacement(player, targetPos) {
  if (!player || !targetPos) return true;
  
  const CANVAS_W = 900;
  const CANVAS_H = 400;
  const playerIndex = currentRoom.players.indexOf(player);
  
  let validZone;
  if (player.view === 'vertical') {
    validZone = playerIndex === 0 
      ? { x: 0, y: 0, w: CANVAS_W, h: CANVAS_H / 2 }
      : { x: 0, y: CANVAS_H / 2, w: CANVAS_W, h: CANVAS_H / 2 };
  } else {
    validZone = playerIndex === 0 
      ? { x: 0, y: 0, w: CANVAS_W / 2, h: CANVAS_H }
      : { x: CANVAS_W / 2, y: 0, w: CANVAS_W / 2, h: CANVAS_H };
  }
  
  return targetPos.x >= validZone.x && 
         targetPos.x < (validZone.x + validZone.w) &&
         targetPos.y >= validZone.y && 
         targetPos.y < (validZone.y + validZone.h);
}

let pendingTouchCard = null;
handEl.addEventListener('click', (ev)=>{ const cardEl = ev.target.closest('.btn-card'); if (!cardEl) return; const id = cardEl.dataset.cardId; if (!id) return; pendingTouchCard = id; });
canvas.addEventListener('click', (ev)=>{ if (!pendingTouchCard) return; const rect = canvas.getBoundingClientRect(); const scaleX = canvas.width / rect.width; const scaleY = canvas.height / rect.height; const x = (ev.clientX - rect.left) * scaleX; const y = (ev.clientY - rect.top) * scaleY; playCard(pendingTouchCard, { x: Math.round(x), y: Math.round(y) }); pendingTouchCard = null; });

async function fetchAvailableCards(userId) {
  try {
    const res = await fetch('https://bstests.leogib.fr/game/available-cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.cards || [];
  } catch (e) {
    console.error('Erreur fetch cards:', e);
    return [];
  }
}

function loadSavedDeck() {
  try {
    return JSON.parse(localStorage.getItem('brainrot_saved_deck') || '[]');
  } catch { return []; }
}

function saveDeckToStorage(keys) {
  localStorage.setItem('brainrot_saved_deck', JSON.stringify(keys));
}

function renderDeckSelector(availableCards) {
  const deckList = document.getElementById('deck-list');
  deckList.innerHTML = '';

  if (!availableCards || availableCards.length === 0) {
    deckList.innerHTML = '<p style="grid-column:1/-1; text-align:center; color:var(--text-muted);">Pas de cartes disponibles. Utilise un deck aléatoire.</p>';
    return;
  }

  const grouped = {};
  availableCards.forEach(entry => {
    const card = entry.card || {};
    const key = `${card.name}_${card.type || 'unit'}`;
    if (!grouped[key]) grouped[key] = { ...entry, card };
  });

  const savedKeys = loadSavedDeck();

  updateSavedDeckCount(savedKeys.length);

  Object.entries(grouped).forEach(([key, entry]) => {
    const card = entry.card;
    const cardEl = document.createElement('div');
    cardEl.className = 'deck-card btn-card';
    cardEl.dataset.key = key;

    const typeLabel = card.type === 'spell' ? '🔮 Sort' : '⚔️ Unité';
    const inSaved = savedKeys.includes(key);

    // Afficher image si disponible, sinon emoji
    const cardImage = card.link ? `<img src="${card.link}" style="width:60px; height:60px; object-fit:cover; border-radius:4px; display:block; margin:0 auto;">` : `<div class="card-emoji">${card.emoji || '🃏'}</div>`;

    cardEl.innerHTML = `
      <div class="deck-star" style="display:${inSaved ? 'flex' : 'none'}">⭐</div>
      ${cardImage}
      <div class="card-name">${card.name}</div>
      <div class="card-cost-label">Coût: <span class="card-cost">${card.cost || 1}</span></div>
      <div class="card-type">${typeLabel}</div>
      <button class="deck-add-btn ${inSaved ? 'deck-add-btn--remove' : ''}" type="button">${inSaved ? '★ Retirer du deck' : '☆ Ajouter au deck'}</button>
    `;
    
    if (!card.link) {
      console.warn('Carte sans lien:', card.name, card);
    }

    const refreshCard = () => {
      const inDeckNow = savedKeys.includes(key);
      const selectedNow = selectedDeck.some(c => `${c.card.name}_${c.card.type || 'unit'}` === key);
      cardEl.classList.toggle('selected', selectedNow);
      const star = cardEl.querySelector('.deck-star');
      const btn = cardEl.querySelector('.deck-add-btn');
      if (star) star.style.display = inDeckNow ? 'flex' : 'none';
      if (btn) {
        btn.textContent = inDeckNow ? '★ Retirer du deck' : '☆ Ajouter au deck';
        btn.classList.toggle('deck-add-btn--remove', inDeckNow);
      }
    };

    cardEl.addEventListener('click', (e) => {
      if (e.target.closest('.deck-add-btn')) return;
      const inSelected = selectedDeck.some(c => `${c.card.name}_${c.card.type || 'unit'}` === key);
      if (inSelected) {
        const idx = selectedDeck.findIndex(c => `${c.card.name}_${c.card.type || 'unit'}` === key);
        if (idx !== -1) selectedDeck.splice(idx, 1);
      } else {
        if (selectedDeck.length < 10) selectedDeck.push(entry);
      }
      refreshCard();
      updateDeckCounter();
    });

    const btn = cardEl.querySelector('.deck-add-btn');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = savedKeys.indexOf(key);
      if (idx !== -1) {
        savedKeys.splice(idx, 1);
      } else {
        if (savedKeys.length < 10) savedKeys.push(key);
      }
      saveDeckToStorage(savedKeys);
      updateSavedDeckCount(savedKeys.length);
      refreshCard();
    });

    deckList.appendChild(cardEl);
  });

  const useSavedBtn = document.getElementById('use-saved-deck');
  if (useSavedBtn) {
    useSavedBtn.onclick = () => {
      const keys = loadSavedDeck();
      if (keys.length === 0) {
        alert('Aucun deck sauvegardé. Ajoute des cartes avec ☆ sur chaque carte !');
        return;
      }
      selectedDeck = [];
      keys.forEach(k => {
        if (grouped[k]) selectedDeck.push(grouped[k]);
      });
      document.querySelectorAll('.deck-card').forEach(el => {
        const k = el.dataset.key;
        el.classList.toggle('selected', selectedDeck.some(c => `${c.card.name}_${c.card.type || 'unit'}` === k));
      });
      updateDeckCounter();
    };
  }

  updateDeckCounter();
}

function updateSavedDeckCount(count) {
  const el = document.getElementById('saved-deck-count');
  if (el) el.textContent = count > 0 ? `(${count}/10 cartes)` : '(aucun deck sauvegardé)';
}

function updateDeckCounter() {
  const confirmBtn = document.getElementById('confirm-deck');
  const isComplete = selectedDeck.length === 10;
  confirmBtn.disabled = !isComplete;
  confirmBtn.innerHTML = `⚔️ Commencer le combat (${selectedDeck.length}/10)<div class="shine"></div>`;
  confirmBtn.classList.toggle('btn-disabled', !isComplete);
}

async function showDeckSelector() {
  let fetchedCards = [];
  try {
    const url = 'https://bstests.leogib.fr/game/getCard';
    const res = await fetch(url, { method: 'GET' });
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.result)) {
        fetchedCards = data.result;
      } else if (Array.isArray(data)) {
        fetchedCards = data;
      } else {
        console.warn('Unexpected /game/getCard shape', data);
      }
    } else {
      console.warn('getCard responded with', res.status);
    }
  } catch (e) {
    console.error('Erreur fetch /game/getCard:', e);
  }

  const normalized = (fetchedCards && fetchedCards.length)
    ? fetchedCards.map((card, idx) => ({
        cardId: (card.name ? card.name.replace(/\s+/g, '_') : ('card_' + idx)) + '_' + idx,
        quantity: 1,
        card: card
      }))
    : [
      { cardId: '1', quantity: 3, card: { name: 'Fireball', cost: 4, type: 'spell', emoji: '🔥', damage: 5 } },
      { cardId: '2', quantity: 2, card: { name: 'Meteor', cost: 5, type: 'spell', emoji: '☄️', damage: 7 } },
      { cardId: '3', quantity: 4, card: { name: 'Bear', cost: 3, type: 'unit', emoji: '🐻', hp: 6, dmg: 2 } },
      { cardId: '4', quantity: 5, card: { name: 'Goblin', cost: 2, type: 'unit', emoji: '🦊', hp: 3, dmg: 1 } },
      { cardId: '5', quantity: 3, card: { name: 'Knight', cost: 3, type: 'unit', emoji: '⚔️', hp: 5, dmg: 2 } },
      { cardId: '6', quantity: 4, card: { name: 'Archer', cost: 2, type: 'unit', emoji: '🏹', hp: 3, dmg: 2 } },
      { cardId: '7', quantity: 2, card: { name: 'Dragon', cost: 7, type: 'unit', emoji: '🐲', hp: 10, dmg: 4 } },
      { cardId: '8', quantity: 3, card: { name: 'Mage', cost: 4, type: 'unit', emoji: '🪄', hp: 4, dmg: 3 } },
      { cardId: '9', quantity: 3, card: { name: 'Bomber', cost: 4, type: 'unit', emoji: '💣', hp: 5, dmg: 4 } },
      { cardId: '10', quantity: 2, card: { name: 'Frost', cost: 3, type: 'spell', emoji: '❄️', damage: 2 } }
    ];

  console.log('Cartes chargées:', normalized);
  selectedDeck = [];
  renderDeckSelector(normalized);
  lobbyEl.style.display = 'none';
  deckSelectorEl.style.display = 'block';
}

document.getElementById('confirm-deck').addEventListener('click', async () => {
  if (selectedDeck.length === 0) {
    alert('Sélectionne au moins une carte!');
    return;
  }

  const name = playerPseudo;
  const room = roomInput.value || 'room1';
  currentRoomId = room;

  try {
    const token = window.BrainrotAuth?.getToken?.() || '';
    const res = await fetch('https://bstests.leogib.fr/game/join', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        roomId: room,
        name,
        playerId: localPlayerId,
        selectedCards: selectedDeck,
        view: 'horizontal'
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'join failed' }));
      alert('Join failed: ' + (err && err.error ? err.error : res.status));
      return;
    }

    const data = await res.json();
    localPlayerId = data.playerId;
    localStorage.setItem('playerId', localPlayerId);
    currentRoom = data.room;
    
    // Marquer le deck comme ready pour ce joueur
    const acceptRes = await fetch('https://bstests.leogib.fr/game/accept-invitation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        roomId: room,
        playerId: localPlayerId
      })
    });

    // Afficher le modal d'invitation
    deckSelectorEl.style.display = 'none';
    showInvitationModal(data);
    
    // Commencer à écouter les événements
    startEventSource(room);
  } catch (e) {
    console.error('Join error:', e);
    alert('Erreur de connexion');
  }
});

function showInvitationModal(joinData) {
  isInvitationAccepted = false;
  isInvitationWaiting = false;
  
  const invModal = document.getElementById('invitation-modal');
  const title = document.getElementById('invitation-title');
  const message = document.getElementById('invitation-message');
  const buttons = document.getElementById('invitation-buttons');
  const acceptBtn = document.getElementById('accept-invitation-btn');
  const rejectBtn = document.getElementById('reject-invitation-btn');
  const waitingBtn = document.getElementById('waiting-btn');
  
  // Si on est le premier joueur (on invite)
  if (joinData.waitingForOpponent) {
    isInvitationWaiting = true;
    title.textContent = '🎮 Partie créée';
    message.textContent = `Tu as créé une arène. En attente qu'un ami accepte ton invitation...`;
    acceptBtn.style.display = 'none';
    rejectBtn.style.display = 'none';
    waitingBtn.style.display = 'flex';
  } else {
    // Si on est le deuxième joueur (on accepte)
    title.textContent = '📨 Nouvelle invitation';
    message.textContent = `${joinData.invitation?.fromName || 'Un joueur'} t'invite à une partie. Acceptes-tu ?`;
    acceptBtn.style.display = 'block';
    rejectBtn.style.display = 'block';
    waitingBtn.style.display = 'none';
    
    acceptBtn.onclick = async () => {
      await handleAcceptInvitation(joinData);
    };
    
    rejectBtn.onclick = async () => {
      await handleRejectInvitation(joinData);
    };
  }
  
  invModal.style.display = 'flex';
}

async function handleAcceptInvitation(joinData) {
  isInvitationAccepted = true;
  const acceptBtn = document.getElementById('accept-invitation-btn');
  const rejectBtn = document.getElementById('reject-invitation-btn');
  const title = document.getElementById('invitation-title');
  const message = document.getElementById('invitation-message');
  const waitingBtn = document.getElementById('waiting-btn');
  
  acceptBtn.disabled = true;
  rejectBtn.disabled = true;
  
  try {
    const token = window.BrainrotAuth?.getToken?.() || '';
    const res = await fetch('https://bstests.leogib.fr/game/accept-invitation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        roomId: currentRoomId,
        playerId: localPlayerId
      })
    });

    if (!res.ok) {
      alert('Erreur en acceptant l\'invitation');
      return;
    }

    title.textContent = '✅ Invitation acceptée';
    message.textContent = 'Connecté avec ' + (joinData.invitation?.fromName || 'l\'autre joueur') + '. En attente de démarrage...';
    acceptBtn.style.display = 'none';
    rejectBtn.style.display = 'none';
    waitingBtn.style.display = 'flex';
  } catch (e) {
    console.error('Accept error:', e);
    alert('Erreur de connexion');
  }
}

async function handleRejectInvitation(joinData) {
  try {
    const token = window.BrainrotAuth?.getToken?.() || '';
    await fetch('https://bstests.leogib.fr/game/reject-invitation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        roomId: currentRoomId,
        playerId: localPlayerId
      })
    });

    // Retourner au lobby
    invitationModal.style.display = 'none';
    lobbyEl.style.display = 'block';
  } catch (e) {
    console.error('Reject error:', e);
  }
}