// Drip Drop Challenge – minimal HTML5 Canvas game
// Author: Ghost for Luis's Locker
// Features:
// - Player (LL power-up cube you control) collects droplets, avoids hazards
// - Temporary power-up mode
// - HUD with score/lives, localStorage best score
// - Mobile buttons + keyboard
// - Beep SFX via WebAudio, plus voice-y text callouts on key events

(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const scoreEl = document.getElementById('score');
  const livesEl = document.getElementById('lives');
  const bestEl  = document.getElementById('best');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlay-title');
  const overlaySub = document.getElementById('overlay-sub');
  const btnRestart = document.getElementById('btn-restart');
  const btnLeft = document.getElementById('btn-left');
  const btnRight = document.getElementById('btn-right');
  const btnPause = document.getElementById('btn-pause');

  // ---- utils
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => Math.random() * (b - a) + a;

  // ---- audio (simple beeps with WebAudio so we don't need asset files)
  let audioCtx;
  function beep(freq=440, dur=0.08, type='square', gain=0.03) {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      g.gain.value = gain;
      osc.connect(g).connect(audioCtx.destination);
      osc.start();
      setTimeout(() => { osc.stop(); }, dur * 1000);
    } catch (e) {}
  }

  // ---- world
  const world = {
    w: canvas.width,
    h: canvas.height,
    gravity: 0.08,
    speed: 2,
    playing: true,
    score: 0,
    lives: 3,
    best: parseInt(localStorage.getItem('ddc_best') || '0', 10)
  };
  bestEl.textContent = world.best;

  // ---- player
  const player = {
    x: canvas.width/2, y: canvas.height - 80, w: 64, h: 20,
    speed: 5, vx: 0,
    power: 0, // frames remaining for power mode
  };

  // ---- droplet & hazard pools
  const droplets = [];
  const hazards = [];
  let lastSpawn = 0;

  // ---- input
  const keys = new Set();
  window.addEventListener('keydown', (e)=>{
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.add('left');
    if (e.code === 'ArrowRight'|| e.code === 'KeyD') keys.add('right');
    if (e.code === 'Space' || e.code === 'KeyP') togglePause();
  });
  window.addEventListener('keyup', (e)=>{
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.delete('left');
    if (e.code === 'ArrowRight'|| e.code === 'KeyD') keys.delete('right');
  });
  btnLeft.addEventListener('pointerdown', ()=>keys.add('left'));
  btnRight.addEventListener('pointerdown', ()=>keys.add('right'));
  btnLeft.addEventListener('pointerup', ()=>keys.delete('left'));
  btnRight.addEventListener('pointerup', ()=>keys.delete('right'));
  btnPause.addEventListener('click', togglePause);
  overlay.addEventListener('click', togglePause);
  btnRestart.addEventListener('click', restart);

  function togglePause() {
    world.playing = !world.playing;
    overlay.hidden = world.playing;
    overlayTitle.textContent = world.lives <= 0 ? 'Game Over' : (world.playing ? '':'Paused');
    overlaySub.textContent = world.lives <= 0 ? 'Tap to restart or press ⏯' : 'Tap to resume';
  }

  function restart(){
    world.score = 0;
    world.lives = 3;
    world.speed = 2;
    droplets.length = 0;
    hazards.length = 0;
    player.x = canvas.width/2;
    player.power = 0;
    scoreEl.textContent = '0';
    livesEl.textContent = '3';
    world.playing = true;
    overlay.hidden = true;
  }

  function spawnThings(dt) {
    lastSpawn += dt;
    const interval = Math.max(350 - world.speed*20, 120);
    if (lastSpawn > interval) {
      lastSpawn = 0;
      // 70% droplet, 30% hazard
      if (Math.random() < 0.7) {
        droplets.push({
          x: rand(20, world.w-20),
          y: -20,
          r: rand(8,14),
          vy: rand(1.5, 2.5) + world.speed*0.3,
          glow: Math.random() < 0.15 // special droplet activates power
        });
      } else {
        hazards.push({
          x: rand(20, world.w-20),
          y: -28,
          w: rand(20,30), h: rand(18,26),
          vy: rand(1.8, 2.8) + world.speed*0.35
        });
      }
    }
  }

  function collideRectCircle(rx, ry, rw, rh, cx, cy, cr){
    const nx = clamp(cx, rx, rx+rw);
    const ny = clamp(cy, ry, ry+rh);
    const dx = cx - nx, dy = cy - ny;
    return (dx*dx + dy*dy) <= cr*cr;
  }

  // "voice" callouts: just floating text for flavor
  const callouts = [];
  function say(text, color = '#e2e8f0'){
    callouts.push({text, x: canvas.width/2, y: 140, a: 1, color});
  }

  let lastTime = 0;
  function loop(t){
    requestAnimationFrame(loop);
    const dt = lastTime ? (t-lastTime) : 16;
    lastTime = t;
    if (!world.playing) {
      draw();
      return;
    }

    // input
    player.vx = 0;
    if (keys.has('left')) player.vx -= player.speed;
    if (keys.has('right')) player.vx += player.speed;
    player.x = clamp(player.x + player.vx, player.w/2 + 8, world.w - player.w/2 - 8);

    spawnThings(dt);

    // update droplets
    for (let i=droplets.length-1;i>=0;i--){
      const d = droplets[i];
      d.y += d.vy;
      if (collideRectCircle(player.x - player.w/2, player.y - player.h/2, player.w, player.h, d.x, d.y, d.r)){
        droplets.splice(i,1);
        world.score += d.glow ? 5 : 1;
        scoreEl.textContent = world.score;
        beep(d.glow ? 880 : 660, 0.07, 'square', 0.035);
        if (d.glow){
          player.power = Math.min(player.power + 600, 1200); // ~10–20s
          say('LL POWER-UP ACTIVATED', '#67e8f9');
        } else if (world.score % 10 === 0) {
          say('DRIP SECURED', '#a7f3d0');
        }
      } else if (d.y - d.r > world.h) {
        droplets.splice(i,1);
      }
    }

    // update hazards
    for (let i=hazards.length-1;i>=0;i--){
      const h = hazards[i];
      h.y += h.vy;
      // treat hazard as rounded rect collision against player rect (approx via circle samples)
      const collided = collideRectCircle(player.x - player.w/2, player.y - player.h/2, player.w, player.h, h.x, h.y, Math.max(h.w,h.h)/2);
      if (collided){
        hazards.splice(i,1);
        if (player.power > 0){
          // shred hazard while powered
          world.score += 2;
          scoreEl.textContent = world.score;
          beep(240, 0.06, 'sawtooth', 0.03);
          say('SHIELDED BY LL', '#fef08a');
        } else {
          world.lives -= 1;
          livesEl.textContent = world.lives;
          beep(140, 0.12, 'sine', 0.05);
          say('HIT! STAY LOCKED IN', '#fecaca');
          if (world.lives <= 0){
            // update best
            if (world.score > world.best){
              world.best = world.score;
              localStorage.setItem('ddc_best', String(world.best));
              bestEl.textContent = world.best;
            }
            overlayTitle.textContent = 'Game Over';
            overlaySub.textContent = 'Tap to restart or press ⏯';
            overlay.hidden = false;
            world.playing = false;
          }
        }
      } else if (h.y - h.h/2 > world.h){
        hazards.splice(i,1);
      }
    }

    // decay power
    if (player.power > 0) player.power -= dt;

    // dynamic difficulty
    world.speed = 2 + Math.min(6, Math.floor(world.score/20));

    draw();
  }

  function drawBackground(){
    // water ripple lines
    ctx.save();
    const g = ctx.createLinearGradient(0,0,0,canvas.height);
    g.addColorStop(0, '#0ea5e9');
    g.addColorStop(1, '#1e293b');
    ctx.fillStyle = g;
    ctx.fillRect(0,0,canvas.width,canvas.height);

    ctx.globalAlpha = 0.12;
    ctx.lineWidth = 2;
    for(let i=0;i<16;i++){
      ctx.beginPath();
      const y = (i*46 + (performance.now()/30) % 46);
      ctx.arc(canvas.width/2, y, 320, Math.PI, 0);
      ctx.strokeStyle = '#e0f2fe';
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPlayer(){
    // paddle-like capsule with LL badge (power-up you control)
    const {x,y,w,h} = player;
    ctx.save();
    ctx.translate(x, y);
    const r = 10;
    // body
    ctx.fillStyle = player.power>0 ? '#22d3ee' : '#e11d48';
    roundRect(ctx, -w/2, -h/2, w, h, r);
    ctx.fill();
    // inner shine
    ctx.globalAlpha = .25;
    ctx.fillStyle = '#fff';
    roundRect(ctx, -w/2+4, -h/2+2, w-8, h-8, r-4);
    ctx.fill();
    ctx.globalAlpha = 1;
    // LL letters
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('LL', 0, 0);
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r){
    ctx.beginPath();
    ctx.moveTo(x+r, y);
    ctx.arcTo(x+w, y, x+w, y+h, r);
    ctx.arcTo(x+w, y+h, x, y+h, r);
    ctx.arcTo(x, y+h, x, y, r);
    ctx.arcTo(x, y, x+w, y, r);
    ctx.closePath();
  }

  function drawDroplets(){
    for (const d of droplets){
      ctx.save();
      ctx.translate(d.x, d.y);
      const c1 = d.glow ? '#67e8f9' : '#e0f2fe';
      const c2 = d.glow ? '#22d3ee' : '#93c5fd';
      const grad = ctx.createRadialGradient(0,0,2, 0,0, d.r+1);
      grad.addColorStop(0, c1);
      grad.addColorStop(1, c2);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0,0,d.r,0,Math.PI*2);
      ctx.fill();
      // sheen
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.ellipse(-d.r*0.3, -d.r*0.4, d.r*0.25, d.r*0.18, -0.5, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawHazards(){
    ctx.save();
    for (const h of hazards){
      ctx.translate(h.x, h.y);
      ctx.fillStyle = '#0f172a';
      roundRect(ctx, -h.w/2, -h.h/2, h.w, h.h, 6);
      ctx.fill();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setTransform(1,0,0,1,0,0); // reset
    }
    ctx.restore();
  }

  function drawHUD(){
    // floating callouts
    for (let i=callouts.length-1;i>=0;i--){
      const c = callouts[i];
      c.y -= 0.2;
      c.a -= 0.01;
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

  function draw(){
    drawBackground();
    drawDroplets();
    drawHazards();
    drawPlayer();
    drawHUD();
  }

  // start
  requestAnimationFrame(loop);
})();