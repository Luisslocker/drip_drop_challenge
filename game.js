// Drip Drop Challenge — Luis’s Locker Edition
// Ghost x Luis’s Locker
// - Title menu (Play / How to Play)
// - Corner controls (bottom-left/right)
// - Fullscreen toggle
// - LL-branded paddle (uses assets/logo.png if present)
// - Collect "alien-octopus drip" (assets/drip.png)
// - Retro pixel octopus background (assets/bg_octopus.png, rendered pixelated)
// - Local best score

(() => {
  // ---------- DOM ----------
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const menu = document.getElementById('menu');
  const startBtn = document.getElementById('start-btn');
  const howBtn = document.getElementById('how-btn');
  const howPanel = document.getElementById('how-panel');

  const hud = document.getElementById('hud');
  const scoreEl = document.getElementById('score');
  const livesEl = document.getElementById('lives');
  const bestEl  = document.getElementById('best');
  const fullscreenBtn = document.getElementById('fullscreen-btn');

  const controls = document.getElementById('controls');
  const btnLeft = document.getElementById('btn-left');
  const btnRight = document.getElementById('btn-right');

  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlay-title');
  const overlaySub = document.getElementById('overlay-sub');
  const btnRestart = document.getElementById('btn-restart');

  // stop iOS scrolling while playing
  document.addEventListener('touchmove', (e) => {
    if (state.playing) e.preventDefault();
  }, { passive:false });

  // ---------- Assets ----------
  const assets = {
    logo: loadImage('assets/logo.png'),        // LL mark (paddle/text)
    drip: loadImage('assets/drip.png'),        // collectible
    bg:   loadImage('assets/bg_octopus.png')   // pixel art background
  };

  function loadImage(src){
    const img = new Image();
    img.src = src;
    img.crossOrigin = 'anonymous';
    return img;
  }

  // ---------- Game State ----------
  const state = {
    scene: 'menu',        // 'menu' | 'play' | 'paused' | 'over'
    playing: false,
    w: canvas.width,
    h: canvas.height,
    score: 0,
    lives: 3,
    best: parseInt(localStorage.getItem('ddc_best') || '0', 10),
    speed: 2,
    keys: new Set(),
    leftHeld: false,
    rightHeld: false
  };
  bestEl.textContent = state.best;

  const player = {
    x: canvas.width/2,
    y: canvas.height - 82,
    w: 64, h: 22,
    speed: 5,
    power: 0   // frames remaining for power mode
  };

  const droplets = [];
  const hazards = [];
  let lastSpawn = 0;

  // ---------- Input ----------
  window.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') state.keys.add('left');
    if (e.code === 'ArrowRight'|| e.code === 'KeyD') state.keys.add('right');
    if (e.code === 'Space' || e.code === 'KeyP') togglePause();
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') state.keys.delete('left');
    if (e.code === 'ArrowRight'|| e.code === 'KeyD') state.keys.delete('right');
  });

  // Corner buttons
  btnLeft.addEventListener('pointerdown', () => { state.leftHeld = true; });
  btnLeft.addEventListener('pointerup',   () => { state.leftHeld = false; });
  btnRight.addEventListener('pointerdown',() => { state.rightHeld = true; });
  btnRight.addEventListener('pointerup',  () => { state.rightHeld = false; });

  // Menu
  startBtn.addEventListener('click', startGame);
  howBtn.addEventListener('click', () => {
    const hidden = howPanel.hasAttribute('hidden');
    if (hidden) howPanel.removeAttribute('hidden');
    else howPanel.setAttribute('hidden','');
  });

  // Overlay + restart
  overlay.addEventListener('click', () => {
    if (state.scene === 'paused') togglePause();
  });
  btnRestart.addEventListener('click', () => {
    restart();
    startGame();
  });

  // Fullscreen
  fullscreenBtn.addEventListener('click', async () => {
    try {
      if (!document.fullscreenElement) {
        await canvas.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (e) {}
  });

  function startGame(){
    menu.style.display = 'none';
    hud.hidden = false;
    controls.hidden = false;
    document.body.classList.add('lock-scroll');

    state.scene = 'play';
    state.playing = true;

    restart(true);
  }

  function restart(keepUI=false){
    state.score = 0;
    state.lives = 3;
    state.speed = 2;
    droplets.length = 0;
    hazards.length = 0;
    player.x = canvas.width/2;
    player.power = 0;
    scoreEl.textContent = '0';
    livesEl.textContent = '3';
    if (!keepUI) overlay.hidden = true;
  }

  function togglePause(){
    if (state.scene !== 'play' && state.scene !== 'paused') return;
    state.playing = !state.playing;
    state.scene = state.playing ? 'play' : 'paused';
    overlay.hidden = state.playing;
    overlayTitle.textContent = state.playing ? 'Paused' : 'Paused';
    overlaySub.textContent = 'Tap to resume';
  }

  function gameOver(){
    state.scene = 'over';
    state.playing = false;
    if (state.score > state.best){
      state.best = state.score;
      localStorage.setItem('ddc_best', String(state.best));
      bestEl.textContent = state.best;
    }
    overlayTitle.textContent = 'Game Over';
    overlaySub.textContent = 'Tap Restart';
    overlay.hidden = false;
  }

  // ---------- Utils ----------
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const rand = (a,b)=>Math.random()*(b-a)+a;

  function collideRectCircle(rx, ry, rw, rh, cx, cy, cr){
    const nx = clamp(cx, rx, rx+rw);
    const ny = clamp(cy, ry, ry+rh);
    const dx = cx - nx, dy = cy - ny;
    return (dx*dx + dy*dy) <= cr*cr;
  }

  // ---------- Spawning ----------
  function spawn(dt){
    lastSpawn += dt;
    const interval = Math.max(360 - state.speed*22, 120);
    if (lastSpawn > interval){
      lastSpawn = 0;
      if (Math.random() < 0.7){
        // drip
        droplets.push({
          x: rand(24, state.w-24),
          y: -24,
          r: rand(10,15),
          vy: rand(1.6,2.6) + state.speed*0.3,
          glow: Math.random() < 0.18
        });
      } else {
        // hazard block
        hazards.push({
          x: rand(30, state.w-30),
          y: -32,
          w: rand(22,30),
          h: rand(20,28),
          vy: rand(1.8,2.8) + state.speed*0.35
        });
      }
    }
  }

  // ---------- Draw ----------
  function drawBackground(){
    // pixelated octopus bg if available
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (assets.bg && assets.bg.complete){
      const iw = assets.bg.naturalWidth || 240;
      const ih = assets.bg.naturalHeight || 320;
      // cover canvas
      const scale = Math.max(canvas.width/iw, canvas.height/ih);
      const w = iw*scale, h = ih*scale;
      const x = (canvas.width - w)/2;
      const y = (canvas.height - h)/2;
      ctx.drawImage(assets.bg, x, y, w, h);
    } else {
      // fallback gradient
      const g = ctx.createLinearGradient(0,0,0,canvas.height);
      g.addColorStop(0, '#0ea5e9');
      g.addColorStop(1, '#1e293b');
      ctx.fillStyle = g;
      ctx.fillRect(0,0,canvas.width,canvas.height);
    }
    ctx.restore();
  }

  function drawPlayer(){
    const {x,y,w,h} = player;
    ctx.save();
    ctx.translate(x,y);

    // body pill
    const r = 10;
    roundRect(ctx, -w/2, -h/2, w, h, r);
    ctx.fillStyle = player.power>0 ? '#22d3ee' : '#ef4444';
    ctx.fill();
    ctx.globalAlpha = .25;
    ctx.fillStyle = '#fff';
    roundRect(ctx, -w/2+4, -h/2+3, w-8, h-8, r-4);
    ctx.fill();
    ctx.globalAlpha = 1;

    // LL logo on top if available
    if (assets.logo && assets.logo.complete){
      const s = 0.16; // scale for logo
      const lw = assets.logo.naturalWidth*s;
      const lh = assets.logo.naturalHeight*s;
      ctx.drawImage(assets.logo, -lw/2, -lh/2, lw, lh);
    } else {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('LL', 0, 0);
    }

    ctx.restore();
  }

  function roundRect(ctx,x,y,w,h,r){
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y, x+w,y+h, r);
    ctx.arcTo(x+w,y+h, x,y+h, r);
    ctx.arcTo(x,y+h, x,y, r);
    ctx.arcTo(x,y, x+w,y, r);
    ctx.closePath();
  }

  function drawDroplets(){
    for (const d of droplets){
      if (assets.drip && assets.drip.complete){
        const s = (d.r*2) / (assets.drip.naturalWidth || 32);
        const w = (assets.drip.naturalWidth||32)*s;
        const h = (assets.drip.naturalHeight||32)*s;
        ctx.save();
        ctx.imageSmoothingEnabled = false; // keep pixel look
        ctx.drawImage(assets.drip, d.x-w/2, d.y-h/2, w, h);
        ctx.restore();
      } else {
        // fallback bubble
        ctx.save();
        ctx.translate(d.x,d.y);
        const grad = ctx.createRadialGradient(0,0,2, 0,0, d.r+1);
        grad.addColorStop(0, d.glow ? '#67e8f9' : '#e0f2fe');
        grad.addColorStop(1, d.glow ? '#22d3ee' : '#93c5fd');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0,0,d.r,0,Math.PI*2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  function drawHazards(){
    ctx.save();
    for (const h of hazards){
      ctx.translate(h.x, h.y);
      ctx.fillStyle = '#0b1220';
      roundRect(ctx, -h.w/2, -h.h/2, h.w, h.h, 6);
      ctx.fill();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setTransform(1,0,0,1,0,0);
    }
    ctx.restore();
  }

  // floating callouts (minimal)
  const callouts = [];
  function say(text, color='#e5e7eb'){
    callouts.push({text, x: canvas.width/2, y: 130, a:1, color});
  }
  function drawCallouts(){
    for (let i=callouts.length-1;i>=0;i--){
      const c = callouts[i];
      c.y -= 0.2; c.a -= 0.01;
      if (c.a <= 0){ callouts.splice(i,1); continue; }
      ctx.save();
      ctx.globalAlpha = c.a;
      ctx.fillStyle = c.color;
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(c.text, c.x, c.y);
      ctx.restore();
    }
  }

  // ---------- Loop ----------
  let last = 0;
  requestAnimationFrame(tick);
  function tick(t){
    requestAnimationFrame(tick);
    const dt = last ? (t - last) : 16;
    last = t;

    if (state.scene === 'menu'){
      // draw a subtle animated background behind menu
      drawBackground();
      return;
    }

    // Active scenes: play/paused/over still render
    drawBackground();

    if (state.playing){
      update(dt);
    }

    render();
  }

  function update(dt){
    // input
    let vx = 0;
    if (state.keys.has('left') || state.leftHeld)  vx -= player.speed;
    if (state.keys.has('right')|| state.rightHeld) vx += player.speed;
    player.x = clamp(player.x + vx, player.w/2 + 8, state.w - player.w/2 - 8);

    spawn(dt);

    // droplets
    for (let i=droplets.length-1;i>=0;i--){
      const d = droplets[i];
      d.y += d.vy;
      if (collideRectCircle(player.x - player.w/2, player.y - player.h/2, player.w, player.h, d.x, d.y, d.r)){
        droplets.splice(i,1);
        state.score += d.glow ? 5 : 1;
        scoreEl.textContent = state.score;
        if (d.glow){
          player.power = Math.min(player.power + 600, 1200);
          say('LL POWER-UP ACTIVATED', '#67e8f9');
        } else if (state.score % 10 === 0){
          say('DRIP SECURED', '#a7f3d0');
        }
      } else if (d.y - d.r > state.h){
        droplets.splice(i,1);
      }
    }

    // hazards
    for (let i=hazards.length-1;i>=0;i--){
      const h = hazards[i];
      h.y += h.vy;
      const collided = collideRectCircle(player.x - player.w/2, player.y - player.h/2, player.w, player.h, h.x, h.y, Math.max(h.w,h.h)/2);
      if (collided){
        hazards.splice(i,1);
        if (player.power > 0){
          state.score += 2;
          scoreEl.textContent = state.score;
          say('SHIELDED BY LL', '#fef08a');
        } else {
          state.lives -= 1;
          livesEl.textContent = state.lives;
          say('HIT! STAY LOCKED IN', '#fecaca');
          if (state.lives <= 0){
            gameOver();
          }
        }
      } else if (h.y - h.h/2 > state.h){
        hazards.splice(i,1);
      }
    }

    if (player.power > 0) player.power -= dt;
    state.speed = 2 + Math.min(6, Math.floor(state.score/20));
  }

  function render(){
    drawDroplets();
    drawHazards();
    drawPlayer();
    drawCallouts();
  }

})();
