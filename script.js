const boardElement = document.getElementById('board');
const messageElement = document.getElementById('message');
const hudElement = document.getElementById('hud');
const powerupsPanel = document.getElementById('powerups-panel');
const minesLeftElement = document.getElementById('mines-left');
const timerElement = document.getElementById('timer');
const livesElement = document.getElementById('lives');
const highscoreElement = document.getElementById('highscore');
const wrapper = document.getElementById('game-wrapper');
const radarBtn = document.getElementById('radar-btn');
const boardContainer = document.getElementById('board-container');
const livesToggle = document.getElementById('lives-toggle');

// Elementos del Modal
const gameModal = document.getElementById('game-modal');
const modalTitle = document.getElementById('modal-title');
const modalIcon = document.getElementById('modal-icon');
const modalText = document.getElementById('modal-text');
const nextLevelBtn = document.getElementById('next-level-btn');

let board = [], currentConfig = { rows: 0, cols: 0, mines: 0, name: '' };
let minesLeft = 0, cellsRevealed = 0, lives = 1, seconds = 0;
let gameOver = false, firstClick = false, isPaused = false, radarUsed = false;
let timerInterval, touchTimer;

// --- Sistema de Audio ---
let audioCtx = null;
let soundEnabled = true;

function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}
function playTone(freq, type, duration) {
    if (!soundEnabled) return;
    initAudio();
    const osc = audioCtx.createOscillator();
    osc.type = type; osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    osc.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + duration);
}
function sfxDig() { playTone(150, 'triangle', 0.1); }
function sfxFlag() { playTone(600, 'sine', 0.1); }
function sfxExplosion() { playTone(100, 'sawtooth', 0.4); }
function sfxWin() { playTone(800, 'square', 0.1); setTimeout(() => playTone(1200, 'square', 0.2), 100); }

function toggleSound() {
    soundEnabled = !soundEnabled;
    document.getElementById('sound-btn').textContent = soundEnabled ? '🔊 SONIDO' : '🔇 MUDO';
}

// --- Menús y Modales ---
function closeModal() {
    gameModal.classList.add('hidden');
}

function goToNextLevel() {
    if (currentConfig.name === 'Facil') setupGame(16, 16, 40, 'Medio');
    else if (currentConfig.name === 'Medio') setupGame(16, 30, 99, 'Dificil');
}

function setupCustom() {
    const r = parseInt(document.getElementById('c-rows').value) || 10;
    const c = parseInt(document.getElementById('c-cols').value) || 10;
    const m = parseInt(document.getElementById('c-mines').value) || 15;
    setupGame(r, c, m, 'Custom');
}

function setupGame(r, c, m, name) {
    currentConfig = { rows: r, cols: c, mines: m, name: name };
    restartGame();
}

function restartGame() {
    clearInterval(timerInterval);
    seconds = 0; isPaused = false; gameOver = false; firstClick = false; cellsRevealed = 0; radarUsed = false;
    board = []; minesLeft = currentConfig.mines;
    
    lives = livesToggle.checked ? 3 : 1;
    
    updateHUD();
    livesElement.textContent = lives;
    timerElement.textContent = '⏱️ 000';
    messageElement.textContent = 'Excava con cuidado...';
    
    document.getElementById('pause-overlay').classList.add('hidden');
    hudElement.classList.remove('hidden');
    powerupsPanel.classList.remove('hidden');
    boardContainer.classList.remove('hidden'); 
    document.getElementById('restart-btn').classList.add('hidden');
    
    radarBtn.disabled = false; radarBtn.textContent = '🔍 RADAR (1)';
    
    let record = localStorage.getItem(`minesweeper_${currentConfig.name}`);
    highscoreElement.textContent = record ? record + 's' : '---';

    boardElement.style.gridTemplateColumns = `repeat(${currentConfig.cols}, 30px)`;
    boardElement.innerHTML = '';

    for (let r = 0; r < currentConfig.rows; r++) {
        let row = [];
        for (let c = 0; c < currentConfig.cols; c++) {
            row.push({ isMine: false, isRevealed: false, isFlagged: false, neighbors: 0 });
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.dataset.r = r; cell.dataset.c = c;
            
            cell.addEventListener('mousedown', (e) => {
                if (e.button === 0) revealCell(r, c);
                if (e.button === 2) toggleFlag(r, c);
            });
            cell.addEventListener('contextmenu', e => e.preventDefault());
            
            cell.addEventListener('touchstart', (e) => {
                e.preventDefault();
                touchTimer = setTimeout(() => toggleFlag(r, c), 500);
            });
            cell.addEventListener('touchend', (e) => {
                e.preventDefault();
                clearTimeout(touchTimer);
                if(!board[r][c].isFlagged && !board[r][c].isRevealed) revealCell(r, c);
            });

            boardElement.appendChild(cell);
        }
        board.push(row);
    }
}

// --- Lógica Principal ---
function placeMines(firstR, firstC) {
    let minesPlaced = 0;
    while (minesPlaced < currentConfig.mines) {
        let r = Math.floor(Math.random() * currentConfig.rows);
        let c = Math.floor(Math.random() * currentConfig.cols);
        if (!board[r][c].isMine && !(r === firstR && c === firstC)) {
            board[r][c].isMine = true;
            minesPlaced++;
        }
    }
}

function calculateNeighbors() {
    for (let r = 0; r < currentConfig.rows; r++) {
        for (let c = 0; c < currentConfig.cols; c++) {
            if (board[r][c].isMine) continue;
            let count = 0;
            for (let i = -1; i <= 1; i++) {
                for (let j = -1; j <= 1; j++) {
                    if (r+i >= 0 && r+i < currentConfig.rows && c+j >= 0 && c+j < currentConfig.cols) {
                        if (board[r+i][c+j].isMine) count++;
                    }
                }
            }
            board[r][c].neighbors = count;
        }
    }
}

function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (!isPaused && !gameOver) {
            seconds++;
            timerElement.textContent = `⏱️ ${seconds.toString().padStart(3, '0')}`;
        }
    }, 1000);
}

function togglePause() {
    if (gameOver || !firstClick) return;
    isPaused = !isPaused;
    document.getElementById('pause-overlay').classList.toggle('hidden');
    document.getElementById('pause-btn').textContent = isPaused ? '▶️ REANUDAR' : '⏸️ PAUSA';
}

function useRadar() {
    if (gameOver || isPaused || radarUsed || !firstClick) return;
    let safeCells = [];
    for (let r = 0; r < currentConfig.rows; r++) {
        for (let c = 0; c < currentConfig.cols; c++) {
            if (!board[r][c].isMine && !board[r][c].isRevealed && !board[r][c].isFlagged) {
                safeCells.push({r, c});
            }
        }
    }
    if (safeCells.length > 0) {
        let randomCell = safeCells[Math.floor(Math.random() * safeCells.length)];
        revealCell(randomCell.r, randomCell.c);
        radarUsed = true;
        radarBtn.disabled = true;
        radarBtn.textContent = '🔍 USADO';
    }
}

function triggerShake() {
    wrapper.classList.remove('shake');
    void wrapper.offsetWidth; 
    wrapper.classList.add('shake');
}

function revealCell(r, c) {
    if (gameOver || isPaused || board[r][c].isRevealed || board[r][c].isFlagged) return;

    if (!firstClick) {
        initAudio();
        firstClick = true; placeMines(r, c); calculateNeighbors(); startTimer();
    }

    const cellData = board[r][c];
    const cellElement = document.querySelector(`[data-r="${r}"][data-c="${c}"]`);
    
    cellData.isRevealed = true;
    cellElement.classList.add('revealed');

    if (cellData.isMine) {
        lives--;
        livesElement.textContent = lives;
        triggerShake();
        sfxExplosion();
        cellElement.textContent = '💥';
        cellElement.style.backgroundColor = '#d32f2f';
        
        if (lives <= 0) {
            endGame(false);
        } else {
            messageElement.textContent = `¡Cuidado! Te quedan ${lives} vidas.`;
        }
        return;
    }

    sfxDig();
    cellsRevealed++;

    if (cellData.neighbors > 0) {
        cellElement.textContent = cellData.neighbors;
        cellElement.classList.add(`num-${cellData.neighbors}`);
    } else {
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                if (r+i >= 0 && r+i < currentConfig.rows && c+j >= 0 && c+j < currentConfig.cols) {
                    revealCell(r+i, c+j);
                }
            }
        }
    }
    checkWin();
}

function toggleFlag(r, c) {
    if (gameOver || isPaused || board[r][c].isRevealed) return;
    initAudio();
    sfxFlag();

    const cellData = board[r][c];
    const cellElement = document.querySelector(`[data-r="${r}"][data-c="${c}"]`);

    if (!cellData.isFlagged) {
        cellData.isFlagged = true; cellElement.textContent = '🚩'; minesLeft--;
    } else {
        cellData.isFlagged = false; cellElement.textContent = ''; minesLeft++;
    }
    updateHUD();
}

function updateHUD() {
    minesLeftElement.textContent = minesLeft >= 0 ? minesLeft.toString().padStart(3, '0') : minesLeft.toString().padStart(4, '0');
}

function endGame(win) {
    gameOver = true; clearInterval(timerInterval);
    document.getElementById('restart-btn').classList.remove('hidden');

    let isNewRecord = false;

    if (win) {
        sfxWin();
        messageElement.textContent = '¡NIVEL SUPERADO! 🎉';
        messageElement.style.color = '#2ecc71';
        
        let prevRecord = localStorage.getItem(`minesweeper_${currentConfig.name}`);
        if (!prevRecord || seconds < parseInt(prevRecord)) {
            localStorage.setItem(`minesweeper_${currentConfig.name}`, seconds);
            highscoreElement.textContent = seconds + 's';
            isNewRecord = true;
        }
    } else {
        messageElement.textContent = '¡FIN DEL JUEGO! 💀';
        messageElement.style.color = '#e74c3c';
        
        // Mostrar bombas al perder
        for (let r = 0; r < currentConfig.rows; r++) {
            for (let c = 0; c < currentConfig.cols; c++) {
                let elem = document.querySelector(`[data-r="${r}"][data-c="${c}"]`);
                if (board[r][c].isMine && !board[r][c].isFlagged && !board[r][c].isRevealed) {
                    elem.textContent = '💣'; elem.classList.add('revealed');
                } else if (!board[r][c].isMine && board[r][c].isFlagged) {
                    elem.textContent = '❌';
                }
            }
        }
    }

    // Esperar 800ms antes de mostrar el modal para que el jugador vea el tablero
    setTimeout(() => {
        gameModal.classList.remove('hidden');
        
        if (win) {
            modalTitle.textContent = '¡VICTORIA!';
            modalTitle.style.color = '#2ecc71';
            modalIcon.textContent = '🏆';
            modalIcon.className = 'modal-icon icon-bounce';
            modalText.textContent = isNewRecord ? `¡Nuevo récord: ${seconds}s!` : `Tiempo: ${seconds}s. ¡Bien hecho!`;
            
            // Efecto de Confeti 🎉
            confetti({
                particleCount: 150,
                spread: 80,
                origin: { y: 0.6 }
            });

            // Mostrar botón "Siguiente" si aplica
            if (currentConfig.name === 'Facil' || currentConfig.name === 'Medio') {
                nextLevelBtn.classList.remove('hidden');
            } else {
                nextLevelBtn.classList.add('hidden');
            }

        } else {
            modalTitle.textContent = '¡DERROTA!';
            modalTitle.style.color = '#e74c3c';
            modalIcon.textContent = '💀';
            modalIcon.className = 'modal-icon icon-shake';
            modalText.textContent = 'Un monstruo te ha atrapado...';
            nextLevelBtn.classList.add('hidden');
        }
    }, 800);
}

function checkWin() {
    let nonMineCells = currentConfig.rows * currentConfig.cols - currentConfig.mines;
    if (cellsRevealed === nonMineCells) endGame(true);
}