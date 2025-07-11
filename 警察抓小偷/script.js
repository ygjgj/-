// 游戏状态
const gameState = {
    map: [],
    rows: 10,
    cols: 10,
    police: { x: 0, y: 0, strategy: "pursue", history: [] },
    thieves: [],
    obstacles: [],
    pathHistory: [],
    turn: 0,
    captured: 0,
    gameRunning: false,
    gameInterval: null,
    thiefActionLog: [],
    strategyChangeCounter: 0
};

// DOM元素
const mapDisplay = document.getElementById('map-display');
const rowsInput = document.getElementById('rows');
const colsInput = document.getElementById('cols');
const obstacleDensity = document.getElementById('obstacle-density');
const thiefCountInput = document.getElementById('thief-count');
const generateBtn = document.getElementById('generate-btn');
const startBtn = document.getElementById('start-btn');
const resetBtn = document.getElementById('reset-btn');
const turnCount = document.getElementById('turn-count');
const capturedCount = document.getElementById('captured-count');
const totalThieves = document.getElementById('total-thieves');
const policePos = document.getElementById('police-pos');
const gameStatus = document.getElementById('game-status');
const thiefAction = document.getElementById('thief-action');
const policeStrategy = document.getElementById('police-strategy');
const thiefStrategy = document.getElementById('thief-strategy');
const pathHistory = document.getElementById('path-history');
const loopStatus = document.getElementById('loop-status');

// 生成随机地图
function generateMap() {
    gameState.rows = parseInt(rowsInput.value);
    gameState.cols = parseInt(colsInput.value);
    const density = parseFloat(obstacleDensity.value);
    const thiefCount = parseInt(thiefCountInput.value);
    
    // 重置游戏状态
    resetGameState(thiefCount);
    
    // 初始化地图网格
    initializeGrid();
    
    // 添加障碍物
    generateObstacles(density);
    
    // 添加小偷
    generateThieves(thiefCount);
    
    // 设置警察起点
    setPoliceStart();
}

function resetGameState(thiefCount) {
    gameState.map = [];
    gameState.police = { x: 0, y: 0, strategy: "pursue", history: [] };
    gameState.thieves = [];
    gameState.obstacles = [];
    gameState.pathHistory = [{x: 0, y: 0}];
    gameState.turn = 0;
    gameState.captured = 0;
    gameState.thiefActionLog = [];
    gameState.strategyChangeCounter = 0;
    
    totalThieves.textContent = thiefCount;
    capturedCount.textContent = '0';
    turnCount.textContent = '0';
    policePos.textContent = '(0, 0)';
    gameStatus.textContent = '等待开始';
    thiefAction.textContent = '未开始';
    policeStrategy.textContent = '待机';
    thiefStrategy.textContent = '待机';
    pathHistory.textContent = '0';
    loopStatus.textContent = '正常';
}

function initializeGrid() {
    mapDisplay.style.gridTemplateColumns = `repeat(${gameState.cols}, var(--cell-size))`;
    mapDisplay.innerHTML = '';
    
    for (let i = 0; i < gameState.rows; i++) {
        const row = [];
        for (let j = 0; j < gameState.cols; j++) {
            row.push(0);
            const cell = document.createElement('div');
            cell.className = 'cell empty';
            cell.dataset.x = i;
            cell.dataset.y = j;
            mapDisplay.appendChild(cell);
        }
        gameState.map.push(row);
    }
}

function generateObstacles(density) {
    const totalCells = gameState.rows * gameState.cols;
    const obstacleCount = Math.floor(totalCells * density);
    
    for (let i = 0; i < obstacleCount; i++) {
        const x = Math.floor(Math.random() * gameState.rows);
        const y = Math.floor(Math.random() * gameState.cols);
        
        if ((x !== 0 || y !== 0) && gameState.map[x][y] === 0) {
            gameState.map[x][y] = 1;
            gameState.obstacles.push({x, y});
            const cell = document.querySelector(`.cell[data-x="${x}"][data-y="${y}"]`);
            cell.className = 'cell obstacle';
        }
    }
}

function generateThieves(thiefCount) {
    for (let i = 0; i < thiefCount; i++) {
        let x, y;
        do {
            x = Math.floor(Math.random() * gameState.rows);
            y = Math.floor(Math.random() * gameState.cols);
        } while (
            (x === 0 && y === 0) ||
            gameState.map[x][y] !== 0 ||
            gameState.thieves.some(t => t.x === x && t.y === y)
        );
        
        gameState.thieves.push({ 
            x, 
            y, 
            captured: false,
            id: i + 1,
            lastAction: "等待开始",
            strategy: "escape",
            history: []
        });
        
        const cell = document.querySelector(`.cell[data-x="${x}"][data-y="${y}"]`);
        cell.className = 'cell thief';
    }
}

function setPoliceStart() {
    const policeCell = document.querySelector(`.cell[data-x="0"][data-y="0"]`);
    policeCell.className = 'cell police';
}

// 改进的寻路算法 - 结合A*和BFS
function findPath(start, end, strategy = "pursue") {
    // 记录警察位置历史
    gameState.police.history.push({x: start.x, y: start.y});
    if (gameState.police.history.length > 10) {
        gameState.police.history.shift();
    }
    
    const openSet = [{
        x: start.x,
        y: start.y,
        g: 0,
        h: heuristic(start, end),
        parent: null
    }];
    openSet[0].f = openSet[0].g + openSet[0].h;
    
    const closedSet = new Set();
    const directions = [
        { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
        { dx: 0, dy: 1 }, { dx: 0, dy: -1 }
    ];
    
    while (openSet.length > 0) {
        // 按f值排序
        openSet.sort((a, b) => a.f - b.f);
        const current = openSet.shift();
        
        // 到达目标
        if (current.x === end.x && current.y === end.y) {
            return reconstructPath(current).slice(0, 1);
        }
        
        closedSet.add(`${current.x},${current.y}`);
        
        // 探索相邻单元格
        for (const dir of directions) {
            const nx = current.x + dir.dx;
            const ny = current.y + dir.dy;
            const key = `${nx},${ny}`;
            
            if (
                nx >= 0 && nx < gameState.rows &&
                ny >= 0 && ny < gameState.cols &&
                gameState.map[nx][ny] !== 1 &&
                !closedSet.has(key)
            ) {
                let gScore = current.g + 1;
                let existing = openSet.find(node => node.x === nx && node.y === ny);
                
                if (!existing) {
                    existing = {
                        x: nx,
                        y: ny,
                        g: Infinity,
                        h: heuristic({x: nx, y: ny}, end),
                        parent: null
                    };
                    openSet.push(existing);
                }
                
                if (gScore < existing.g) {
                    existing.g = gScore;
                    existing.f = existing.g + existing.h;
                    existing.parent = current;
                }
            }
        }
    }
    
    // 如果没有路径，使用BFS作为后备方案
    return bfsPath(start, end);
}

function reconstructPath(node) {
    const path = [];
    while (node.parent) {
        path.unshift({x: node.x, y: node.y});
        node = node.parent;
    }
    return path;
}

function bfsPath(start, end) {
    const queue = [{ x: start.x, y: start.y, path: [] }];
    const visited = new Set([`${start.x},${start.y}`]);
    const directions = [
        { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
        { dx: 0, dy: 1 }, { dx: 0, dy: -1 }
    ];
    
    while (queue.length > 0) {
        const { x, y, path } = queue.shift();
        
        if (x === end.x && y === end.y) {
            return path.slice(0, 1);
        }
        
        for (const dir of directions) {
            const nx = x + dir.dx;
            const ny = y + dir.dy;
            const key = `${nx},${ny}`;
            
            if (
                nx >= 0 && nx < gameState.rows &&
                ny >= 0 && ny < gameState.cols &&
                !visited.has(key) &&
                gameState.map[nx][ny] !== 1
            ) {
                visited.add(key);
                queue.push({
                    x: nx,
                    y: ny,
                    path: [...path, {x: nx, y: ny}]
                });
            }
        }
    }
    return [];
}

function heuristic(a, b) {
    // 曼哈顿距离
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

// 改进的小偷移动算法
function moveThief(thief) {
    if (thief.captured) return thief;
    
    // 记录历史位置
    thief.history.push({x: thief.x, y: thief.y});
    if (thief.history.length > 10) {
        thief.history.shift();
    }
    
    const directions = [
        { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
        { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
        { dx: 1, dy: 1 }, { dx: 1, dy: -1 },
        { dx: -1, dy: 1 }, { dx: -1, dy: -1 }
    ];
    
    let actionLog = `小偷${thief.id}：`;
    let moved = false;
    
    // 小偷每回合移动2步
    for (let step = 0; step < 2; step++) {
        let bestMove = null;
        let bestScore = -Infinity;
        
        // 评估每个可能移动方向
        for (const dir of directions) {
            const nx = thief.x + dir.dx;
            const ny = thief.y + dir.dy;
            
            if (
                nx >= 0 && nx < gameState.rows &&
                ny >= 0 && ny < gameState.cols &&
                gameState.map[nx][ny] !== 1 &&
                !gameState.thieves.some(t => !t.captured && t !== thief && t.x === nx && t.y === ny)
            ) {
                // 碰撞检测：目标位置是否有警察
                if (nx === gameState.police.x && ny === gameState.police.y) {
                    thief.captured = true;
                    gameState.captured++;
                    capturedCount.textContent = gameState.captured;
                    
                    const cell = document.querySelector(
                        `.cell[data-x="${thief.x}"][data-y="${thief.y}"]`
                    );
                    cell.classList.add('capture-animation');
                    
                    thief.lastAction = `被捕！位置(${thief.x},${thief.y})`;
                    return thief;
                }
                
                // 计算移动得分
                const distanceToPolice = Math.abs(nx - gameState.police.x) + Math.abs(ny - gameState.police.y);
                const distanceToEdge = Math.min(
                    nx, gameState.rows - nx - 1, 
                    ny, gameState.cols - ny - 1
                );
                
                let score = distanceToPolice * 2; // 优先远离警察
                score += distanceToEdge * 0.5; // 其次靠近地图边缘
                score += Math.random() * 3; // 添加随机性
                
                // 避免重复路线惩罚
                const isRepeating = thief.history.some(pos => pos.x === nx && pos.y === ny);
                if (isRepeating) score -= 5;
                
                if (score > bestScore) {
                    bestScore = score;
                    bestMove = { x: nx, y: ny, dir };
                }
            }
        }
        
        // 执行最佳移动
        if (bestMove) {
            const dx = bestMove.x - thief.x;
            const dy = bestMove.y - thief.y;
            let direction = "";
            
            if (dx === 1 && dy === 0) direction = "↓";
            else if (dx === -1 && dy === 0) direction = "↑";
            else if (dx === 0 && dy === 1) direction = "→";
            else if (dx === 0 && dy === -1) direction = "←";
            else if (dx === 1 && dy === 1) direction = "↘";
            else if (dx === 1 && dy === -1) direction = "↙";
            else if (dx === -1 && dy === 1) direction = "↗";
            else if (dx === -1 && dy === -1) direction = "↖";
            
            actionLog += `${direction} `;
            thief.x = bestMove.x;
            thief.y = bestMove.y;
            moved = true;
        }
    }
    
    if (!moved) actionLog += "被困 ";
    thief.lastAction = actionLog;
    
    // 随机切换策略防止模式化
    if (Math.random() < 0.1) {
        thief.strategy = ["escape", "confuse", "hide"][Math.floor(Math.random() * 3)];
        thiefStrategy.textContent = thief.strategy;
        thiefStrategy.className = `strategy-tag ${thief.strategy}`;
    }
    
    return thief;
}

// 循环检测
function detectRouteLoop() {
    // 每10回合检测一次
    if (gameState.turn % 10 !== 0) return false;
    
    // 检查警察路径
    const policeHistory = gameState.police.history;
    if (policeHistory.length < 8) return false;
    
    // 检查是否出现重复模式
    const pattern1 = `${policeHistory[0].x},${policeHistory[0].y}`;
    const pattern2 = `${policeHistory[1].x},${policeHistory[1].y}`;
    const pattern3 = `${policeHistory[2].x},${policeHistory[2].y}`;
    
    let matchCount = 0;
    for (let i = 3; i < policeHistory.length; i += 3) {
        if (`${policeHistory[i].x},${policeHistory[i].y}` === pattern1 &&
            `${policeHistory[i+1].x},${policeHistory[i+1].y}` === pattern2 &&
            `${policeHistory[i+2].x},${policeHistory[i+2].y}` === pattern3) {
            matchCount++;
        }
    }
    
    // 如果匹配次数超过阈值，触发策略变更
    if (matchCount >= 2) {
        loopStatus.textContent = "检测到循环模式";
        loopStatus.className = "warning";
        
        // 随机切换警察策略
        const strategies = ["pursue", "block", "intercept"];
        gameState.police.strategy = strategies[Math.floor(Math.random() * strategies.length)];
        policeStrategy.textContent = gameState.police.strategy;
        policeStrategy.className = `strategy-tag ${gameState.police.strategy}`;
        
        gameState.strategyChangeCounter++;
        return true;
    }
    
    loopStatus.textContent = "正常";
    loopStatus.className = "";
    return false;
}

// 游戏主循环
function gameLoop() {
    gameState.turn++;
    turnCount.textContent = gameState.turn;
    pathHistory.textContent = gameState.police.history.length;
    gameStatus.textContent = '进行中';
    
    // 重置小偷行动日志
    gameState.thiefActionLog = [];
    
    // 移动小偷
    for (let i = 0; i < gameState.thieves.length; i++) {
        if (!gameState.thieves[i].captured) {
            gameState.thieves[i] = moveThief(gameState.thieves[i]);
            gameState.thiefActionLog.push(gameState.thieves[i].lastAction);
            
            if (gameState.thiefActionLog.length > 0) {
                thiefAction.textContent = gameState.thiefActionLog.join(' | ');
            }
            
            // 检查游戏胜利条件
            if (gameState.thieves[i].captured && 
                gameState.captured === gameState.thieves.length) {
                endGame(true);
                return;
            }
        }
    }
    
    // 检测并处理循环
    detectRouteLoop();
    
    // 移动警察
    const activeThieves = gameState.thieves.filter(t => !t.captured);
    if (activeThieves.length === 0) {
        endGame(true);
        return;
    }
    
    // 找到最近的小偷
    let closestThief = null;
    let minDistance = Infinity;
    
    for (const thief of activeThieves) {
        const distance = Math.abs(thief.x - gameState.police.x) + 
                       Math.abs(thief.y - gameState.police.y);
        
        if (distance < minDistance) {
            minDistance = distance;
            closestThief = thief;
        }
    }
    
    // 根据策略选择目标
    let targetThief = closestThief;
    
    // 拦截策略：预测小偷移动方向
    if (gameState.police.strategy === "intercept" && closestThief.history.length >= 3) {
        const lastPos = closestThief.history[closestThief.history.length - 1];
        const prevPos = closestThief.history[closestThief.history.length - 3];
        
        const dx = lastPos.x - prevPos.x;
        const dy = lastPos.y - prevPos.y;
        
        // 预测下一步位置
        const predictedX = closestThief.x + dx;
        const predictedY = closestThief.y + dy;
        
        if (predictedX >= 0 && predictedX < gameState.rows &&
            predictedY >= 0 && predictedY < gameState.cols) {
            targetThief = {x: predictedX, y: predictedY};
        }
    }
    
    // 计算警察移动路径
    const nextStep = findPath(gameState.police, targetThief, gameState.police.strategy)[0];
    if (nextStep) {
        gameState.police.x = nextStep.x;
        gameState.police.y = nextStep.y;
        gameState.pathHistory.push({x: nextStep.x, y: nextStep.y});
        policePos.textContent = `(${nextStep.x}, ${nextStep.y})`;
    }
    
    // 更新地图显示
    updateMapDisplay();
}

// 更新地图显示
function updateMapDisplay() {
    const cells = document.querySelectorAll('.cell');
    cells.forEach(cell => {
        const x = parseInt(cell.dataset.x);
        const y = parseInt(cell.dataset.y);
        
        if (gameState.map[x][y] === 1) {
            cell.className = 'cell obstacle';
        } else {
            cell.className = 'cell empty';
        }
        cell.classList.remove('capture-animation');
    });
    
    gameState.pathHistory.forEach(point => {
        const cell = document.querySelector(`.cell[data-x="${point.x}"][data-y="${point.y}"]`);
        if (cell && !cell.classList.contains('police') && !cell.classList.contains('thief')) {
            cell.classList.add('path');
        }
    });
    
    const policeCell = document.querySelector(
        `.cell[data-x="${gameState.police.x}"][data-y="${gameState.police.y}"]`
    );
    if (policeCell) {
        policeCell.className = 'cell police';
    }
    
    gameState.thieves.forEach(thief => {
        const thiefCell = document.querySelector(
            `.cell[data-x="${thief.x}"][data-y="${thief.y}"]`
        );
        if (thiefCell) {
            if (!thief.captured) {
                thiefCell.className = 'cell thief';
            } else {
                thiefCell.className = 'cell';
                thiefCell.style.backgroundColor = '#9e9e9e';
            }
        }
    });
}

// 开始游戏
function startGame() {
    if (gameState.gameRunning) return;
    
    gameState.gameRunning = true;
    startBtn.textContent = '暂停';
    gameStatus.textContent = '进行中';
    policeStrategy.textContent = gameState.police.strategy;
    policeStrategy.className = `strategy-tag ${gameState.police.strategy}`;
    
    if (gameState.thieves.length > 0) {
        thiefStrategy.textContent = gameState.thieves[0].strategy;
        thiefStrategy.className = `strategy-tag ${gameState.thieves[0].strategy}`;
    }
    
    gameState.gameInterval = setInterval(() => {
        gameLoop();
    }, 1000);
}

// 暂停游戏
function pauseGame() {
    if (!gameState.gameRunning) return;
    
    gameState.gameRunning = false;
    clearInterval(gameState.gameInterval);
    startBtn.textContent = '继续';
    gameStatus.textContent = '已暂停';
}

// 结束游戏
function endGame(success) {
    clearInterval(gameState.gameInterval);
    gameState.gameRunning = false;
    startBtn.textContent = '开始模拟';
    
    if (success) {
        gameStatus.textContent = `游戏胜利！用时${gameState.turn}回合`;
        alert(`恭喜！警察在${gameState.turn}回合内抓住了所有小偷！`);
    } else {
        gameStatus.textContent = '游戏结束';
    }
}

// 重置游戏
function resetGame() {
    clearInterval(gameState.gameInterval);
    gameState.gameRunning = false;
    startBtn.textContent = '开始模拟';
    generateMap();
}

// 事件监听器
generateBtn.addEventListener('click', resetGame);
startBtn.addEventListener('click', () => {
    if (gameState.gameRunning) {
        pauseGame();
    } else {
        startGame();
    }
});
resetBtn.addEventListener('click', resetGame);

// 初始化游戏
window.addEventListener('DOMContentLoaded', resetGame);