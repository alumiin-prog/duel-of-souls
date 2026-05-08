const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const startOverlay = document.getElementById('start-overlay');
const gameoverOverlay = document.getElementById('gameover-overlay');
const exitOverlay = document.getElementById('exit-overlay');
const playerDisplay = document.getElementById('player-score');
const cpuDisplay = document.getElementById('cpu-score');

// Constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 500;
const PADDLE_WIDTH = 12;
const BALL_SIZE = 10;
const BALL_SPEED_INCREMENT = 0.2;
const PLAYER_SPEED = 8;

const DIFFICULTY_CONFIGS = {
    easy: {
        ballSpeed: 4,
        cpuSpeed: 3,
        paddleHeight: 120
    },
    medium: {
        ballSpeed: 6,
        cpuSpeed: 5,
        paddleHeight: 100
    },
    hard: {
        ballSpeed: 8,
        cpuSpeed: 7.5,
        paddleHeight: 80
    }
};

// State
let currentDifficulty = 'medium';
let targetScore = 5;
let paddleHeight = DIFFICULTY_CONFIGS.medium.paddleHeight;
let initialBallSpeed = DIFFICULTY_CONFIGS.medium.ballSpeed;
let cpuSpeed = DIFFICULTY_CONFIGS.medium.cpuSpeed;

let playerY = CANVAS_HEIGHT / 2 - paddleHeight / 2;
let cpuY = CANVAS_HEIGHT / 2 - paddleHeight / 2;
let ballX = CANVAS_WIDTH / 2;
let ballY = CANVAS_HEIGHT / 2;
let ballDX = initialBallSpeed;
let ballDY = initialBallSpeed;
let playerScore = 0;
let cpuScore = 0;
let speedMultiplier = 1;
let gameActive = false;

// Audio System
let audioCtx = null;
function playBounceSound(freq = 440) {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        // Use 'sine' or 'triangle' for a smoother, more "magical" sound
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.5, audioCtx.currentTime + 0.1);
        
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.15);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) {
        console.warn("Audio Context blocked or failed:", e);
    }
}

// New visual state
let trail = [];
let particles = [];

const keys = {};

function resetBall(direction) {
    ballX = CANVAS_WIDTH / 2;
    ballY = CANVAS_HEIGHT / 2;
    speedMultiplier = 1;
    ballDX = (initialBallSpeed + Math.random() * 2) * direction;
    ballDY = (Math.random() - 0.5) * 10;
    trail = [];
}

function spawnParticles(x, y, color) {
    for (let i = 0; i < 15; i++) {
        particles.push({
            x,
            y,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8,
            life: 1,
            decay: 0.01 + Math.random() * 0.02,
            size: 1 + Math.random() * 3,
            color: color || (Math.random() > 0.5 ? '#d4af37' : '#ffffff') // Gold or White magical dust
        });
    }
}

function startGame() {
    const customInput = document.getElementById('custom-score-input');
    if (customInput.value) {
        targetScore = parseInt(customInput.value) || 5;
    }

    const config = DIFFICULTY_CONFIGS[currentDifficulty];
    initialBallSpeed = config.ballSpeed;
    cpuSpeed = config.cpuSpeed;
    paddleHeight = config.paddleHeight;

    playerScore = 0;
    cpuScore = 0;
    playerDisplay.innerText = 0;
    cpuDisplay.innerText = 0;
    
    playerY = CANVAS_HEIGHT / 2 - paddleHeight / 2;
    cpuY = CANVAS_HEIGHT / 2 - paddleHeight / 2;
    
    trail = [];
    particles = [];
    gameActive = true;
    startOverlay.classList.add('hidden');
    gameoverOverlay.classList.add('hidden');
    resetBall(Math.random() > 0.5 ? 1 : -1);
}

function gameOver() {
    gameActive = false;
    gameoverOverlay.classList.remove('hidden');
    document.getElementById('result-title').innerText = playerScore > cpuScore ? 'Superiority Confirmed' : 'System Failure';
    document.getElementById('result-score').innerText = `Final Metrics: ${playerScore} - ${cpuScore}`;
}

function handleExit() {
    // Attempt to close window
    window.close();
    
    // Fallback if browser blocks window.close()
    setTimeout(() => {
        gameoverOverlay.classList.add('hidden');
        exitOverlay.classList.remove('hidden');
    }, 100);
}

function returnToMenu() {
    exitOverlay.classList.add('hidden');
    startOverlay.classList.remove('hidden');
}

function update() {
    if (!gameActive) return;

    // Particles update
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;
        if (p.life <= 0) particles.splice(i, 1);
    }

    // Player logic
    if (keys['ArrowUp']) playerY = Math.max(0, playerY - PLAYER_SPEED);
    if (keys['ArrowDown']) playerY = Math.min(CANVAS_HEIGHT - paddleHeight, playerY + PLAYER_SPEED);

    // CPU logic
    const cpuCenter = cpuY + paddleHeight / 2;
    if (cpuCenter < ballY - 10) cpuY = Math.min(CANVAS_HEIGHT - paddleHeight, cpuY + cpuSpeed);
    else if (cpuCenter > ballY + 10) cpuY = Math.max(0, cpuY - cpuSpeed);

    // Trail logic
    trail.push({ x: ballX, y: ballY });
    if (trail.length > 10) trail.shift();

    // Ball logic
    ballX += ballDX * speedMultiplier;
    ballY += ballDY * speedMultiplier;

    if (ballY <= 0 || ballY >= CANVAS_HEIGHT) {
        ballDY *= -1;
        spawnParticles(ballX, ballY, 'rgba(255, 245, 225, 0.6)');
        playBounceSound(220); // Lower beep for wall
        ballY = ballY <= 0 ? 1 : CANVAS_HEIGHT - 1;
    }

    // Collisions
    if (ballX <= 20 + PADDLE_WIDTH && ballX >= 20 && ballY >= playerY && ballY <= playerY + paddleHeight) {
        // Force direction away from paddle and reset position to paddle edge
        ballDX = Math.abs(ballDX) + BALL_SPEED_INCREMENT;
        ballX = 20 + PADDLE_WIDTH + 1; // Move ball just past the paddle edge
        ballDY = (ballY - (playerY + paddleHeight / 2)) * 0.2;
        speedMultiplier += 0.05;
        spawnParticles(ballX, ballY, '#fff5e1');
        playBounceSound(440); // Standard beep for paddle
    }

    if (ballX >= CANVAS_WIDTH - 20 - PADDLE_WIDTH && ballX <= CANVAS_WIDTH - 20 && ballY >= cpuY && ballY <= cpuY + paddleHeight) {
        // Force direction away from paddle and reset position to paddle edge
        ballDX = -(Math.abs(ballDX) + BALL_SPEED_INCREMENT);
        ballX = CANVAS_WIDTH - 20 - PADDLE_WIDTH - 1; // Move ball just past the paddle edge
        ballDY = (ballY - (cpuY + paddleHeight / 2)) * 0.2;
        speedMultiplier += 0.05;
        spawnParticles(ballX, ballY, '#fff5e1');
        playBounceSound(440); // Standard beep for paddle
    }

    // Scoring
    if (ballX < 0) {
        cpuScore++;
        cpuDisplay.innerText = cpuScore;
        if (cpuScore >= targetScore) gameOver(); else resetBall(1);
    } else if (ballX > CANVAS_WIDTH) {
        playerScore++;
        playerDisplay.innerText = playerScore;
        if (playerScore >= targetScore) gameOver(); else resetBall(-1);
    }
}

function draw() {
    // Clear and Darken Court (Semi-transparent overlay for readability)
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = 'rgba(26, 20, 13, 0.7)'; 
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Decorative floor glow
    const floorGrad = ctx.createRadialGradient(
        CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 50,
        CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH / 2
    );
    floorGrad.addColorStop(0, 'rgba(45, 36, 23, 0.4)');
    floorGrad.addColorStop(1, 'rgba(26, 20, 13, 0)');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Vignette Effect
    const vignette = ctx.createRadialGradient(
        CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 0,
        CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH * 0.8
    );
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.7)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Center Line: Ancient Separation
    ctx.setLineDash([5, 15]);
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.15)';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(CANVAS_WIDTH / 2, 20); ctx.lineTo(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 20); ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 1;

    // Draw Particles: Magic Essence
    particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.shadowBlur = 10;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    // Paddle Drawer: Mystical Barriers / Weathered Artifacts
    const drawPaddle = (x, y, h, color) => {
        // Main body
        const grad = ctx.createLinearGradient(x, y, x + PADDLE_WIDTH, y + h);
        grad.addColorStop(0, '#3d3020');
        grad.addColorStop(0.5, '#5a4b37');
        grad.addColorStop(1, '#3d3020');
        
        ctx.fillStyle = grad;
        ctx.shadowBlur = 20;
        ctx.shadowColor = color;
        ctx.fillRect(x, y, PADDLE_WIDTH, h);
        
        // Glowing Edge
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, PADDLE_WIDTH, h);
        
        // Inner "Core" Glow
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.3;
        ctx.fillRect(x + 2, y + 5, PADDLE_WIDTH - 4, h - 10);
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1;
    };

    // Player Paddle (Golden Barrier)
    drawPaddle(20, playerY, paddleHeight, '#d4af37');

    // CPU Paddle (Starlight Barrier)
    drawPaddle(CANVAS_WIDTH - 20 - PADDLE_WIDTH, cpuY, paddleHeight, '#8e44ad');

    // Ball Trail: Ethereal Echo
    trail.forEach((pos, i) => {
        const ratio = (i + 1) / trail.length;
        ctx.fillStyle = `rgba(212, 175, 55, ${ratio * 0.2})`;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, (BALL_SIZE / 2) * ratio, 0, Math.PI * 2);
        ctx.fill();
    });

    // Ball: The "Ancient Soul Core"
    const ballGrad = ctx.createRadialGradient(
        ballX - BALL_SIZE / 4, ballY - BALL_SIZE / 4, 1,
        ballX, ballY, BALL_SIZE / 2
    );
    ballGrad.addColorStop(0, '#ffffff'); 
    ballGrad.addColorStop(0.5, '#f4e4bc'); 
    ballGrad.addColorStop(1, '#d4af37'); 
    
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#d4af37';
    ctx.fillStyle = ballGrad;
    ctx.beginPath(); 
    ctx.arc(ballX, ballY, BALL_SIZE / 2, 0, Math.PI * 2); 
    ctx.fill();

    ctx.shadowBlur = 0;
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

window.addEventListener('keydown', e => keys[e.key] = true);
window.addEventListener('keyup', e => keys[e.key] = false);

// Touch Controls
function handleTouch(e) {
    if (!gameActive) return;
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const touchX = touch.clientX - rect.left;
    
    // Only respond to touches on the left side of the screen
    if (touchX < rect.width / 2) {
        e.preventDefault(); // Stop scrolling when playing
        const touchY = touch.clientY - rect.top;
        const scaleY = CANVAS_HEIGHT / rect.height;
        const canvasY = touchY * scaleY;
        
        // Center the paddle on the touch point
        playerY = canvasY - paddleHeight / 2;
        playerY = Math.max(0, Math.min(CANVAS_HEIGHT - paddleHeight, playerY));
    }
}

canvas.addEventListener('touchstart', handleTouch, { passive: false });
canvas.addEventListener('touchmove', handleTouch, { passive: false });

// Difficulty Selection
document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentDifficulty = btn.dataset.diff;
    });
});

// Score Selection
document.querySelectorAll('.score-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.score-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        targetScore = parseInt(btn.dataset.score);
        document.getElementById('target-score-text').innerText = targetScore;
        // Clear custom input if a preset is selected
        document.getElementById('custom-score-input').value = '';
    });
});

// Custom score input logic
document.getElementById('custom-score-input').addEventListener('input', (e) => {
    if (e.target.value) {
        targetScore = parseInt(e.target.value) || 5;
        document.getElementById('target-score-text').innerText = targetScore;
    }
});

document.getElementById('custom-score-input').addEventListener('focus', () => {
    // Deactivate preset scores when custom is focused
    document.querySelectorAll('.score-btn').forEach(b => b.classList.remove('active'));
});

document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('restart-btn').addEventListener('click', startGame);
document.getElementById('exit-btn').addEventListener('click', handleExit);
document.getElementById('return-btn').addEventListener('click', returnToMenu);

loop();
