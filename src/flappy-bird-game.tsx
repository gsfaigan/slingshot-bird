import { useState, useEffect, useRef } from 'react';

interface Pipe {
  worldX: number;
  baseTopHeight: number;
  topHeight: number;
  baseWorldX: number;
  passed: boolean;
  id: number;
  screenId: number;
  isGoalPipe: boolean;
  movePattern: string;
  moveOffset: number;
  pipeGap: number;
}

interface Coin {
  id: string;
  worldX: number;
  worldY: number;
  pipeId: number;
}

interface Point {
  x: number;
  y: number;
}

const FlappyBird = () => {
  const [birdY, setBirdY] = useState(350);
  const [birdX, setBirdX] = useState(150);
  const [velocityX, setVelocityX] = useState(0);
  const [velocityY, setVelocityY] = useState(0);
  const [cameraX, setCameraX] = useState(0);
  const [pipes, setPipes] = useState<Pipe[]>([]);
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState('start');
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('slingshotBirdHighScore');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [isDragging, setIsDragging] = useState(false);
  const [isFlying, setIsFlying] = useState(false);
  const [currentMouse, setCurrentMouse] = useState({ x: 150, y: 350 });
  const [trajectoryPoints, setTrajectoryPoints] = useState<Point[]>([]);
  const [explosionScale, setExplosionScale] = useState(1);
  const [explosionPos, setExplosionPos] = useState({ x: 0, y: 0 });
  const [coins, setCoins] = useState<Coin[]>([]);
  const [birdSizeMultiplier, setBirdSizeMultiplier] = useState(1);
  const collectedCoinsRef = useRef(new Set<string>());
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 150, y: 350 });
  const currentMouseRef = useRef({ x: 150, y: 350 });
  const [colorIndex, setColorIndex] = useState(0);
  
  const colorPalettes = [
    { bgFrom: '#87ceeb', bgTo: '#87ceeb', sky: '#d4e9f7', pipe: '#4ade80', pipeBorder: '#22c55e', pipeAccent: '#86efac' },
    { bgFrom: '#f9a8d4', bgTo: '#f9a8d4', sky: '#fae8ff', pipe: '#fb7185', pipeBorder: '#f43f5e', pipeAccent: '#fda4af' },
    { bgFrom: '#93c5fd', bgTo: '#93c5fd', sky: '#e0f2fe', pipe: '#2dd4bf', pipeBorder: '#14b8a6', pipeAccent: '#5eead4' },
    { bgFrom: '#fde68a', bgTo: '#fde68a', sky: '#fef3c7', pipe: '#fbbf24', pipeBorder: '#f59e0b', pipeAccent: '#fcd34d' },
    { bgFrom: '#86efac', bgTo: '#86efac', sky: '#d1fae5', pipe: '#a3e635', pipeBorder: '#84cc16', pipeAccent: '#bef264' },
    { bgFrom: '#a5b4fc', bgTo: '#a5b4fc', sky: '#dbeafe', pipe: '#818cf8', pipeBorder: '#6366f1', pipeAccent: '#a5b4fc' },
    { bgFrom: '#fca5a5', bgTo: '#fca5a5', sky: '#fce7f3', pipe: '#f87171', pipeBorder: '#ef4444', pipeAccent: '#fca5a5' },
    { bgFrom: '#d8b4fe', bgTo: '#d8b4fe', sky: '#fae8ff', pipe: '#c084fc', pipeBorder: '#a855f7', pipeAccent: '#d8b4fe' },
    { bgFrom: '#5eead4', bgTo: '#5eead4', sky: '#d1fae5', pipe: '#34d399', pipeBorder: '#10b981', pipeAccent: '#6ee7b7' },
    { bgFrom: '#fed7aa', bgTo: '#fed7aa', sky: '#fee2e2', pipe: '#fb923c', pipeBorder: '#f97316', pipeAccent: '#fdba74' }
  ];
  
  const currentColors = colorPalettes[colorIndex % colorPalettes.length];
  
  const gameWidth = 800;
  const gameHeight = 700;
  const baseBirdSize = 30;
  const pipeWidth = 80;
  const pipeGap = 200;
  const gravity = 0.4;
  const pipeSpacing = 500;
  
  const gameLoopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const lastPassedPipeRef = useRef(-1);

  // Save high score to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('slingshotBirdHighScore', highScore.toString());
  }, [highScore]);

  const generatePipes = () => {
    const initialPipes = [];
    const initialCoins = [];
    let pipeId = 0;
    
    for (let screen = 0; screen < 30; screen++) {
      const screenStartX = 600 + screen * pipeSpacing;
      
      // Determine how many pipes for this screen
      let numPipesInScreen = 1;
      if (screen >= 20) {
        numPipesInScreen = 4; // Lots of pipes after 20
      } else if (screen >= 15) {
        numPipesInScreen = 2; // Multiple pipes after 15
      }
      
      for (let pipeInScreen = 0; pipeInScreen < numPipesInScreen; pipeInScreen++) {
        // Increase gap for harder levels
        const dynamicPipeGap = screen >= 20 ? 260 : screen >= 15 ? 240 : pipeGap;
        
        const minHeight = 180;
        const maxHeight = gameHeight - dynamicPipeGap - 180;
        const height = Math.floor(Math.random() * (maxHeight - minHeight) + minHeight);
        
        let movePattern = 'none';
        if (screen >= 20) {
          // After 20 points: all pipes move in sin wave (vertical)
          movePattern = 'vertical';
        } else if (screen >= 10) {
          movePattern = 'both';
        } else if (screen >= 5) {
          movePattern = Math.random() > 0.5 ? 'vertical' : 'horizontal';
        }
        
        // Space pipes within the screen
        const pipeOffsetInScreen = pipeInScreen * (pipeSpacing / numPipesInScreen);
        const worldX = screenStartX + pipeOffsetInScreen;
        
        initialPipes.push({
          worldX: worldX,
          baseTopHeight: height,
          topHeight: height,
          baseWorldX: worldX,
          passed: false,
          id: pipeId,
          screenId: screen, // Track which screen this pipe belongs to
          isGoalPipe: pipeInScreen === numPipesInScreen - 1, // Only last pipe in screen is goal
          movePattern: movePattern,
          moveOffset: Math.random() * Math.PI * 2,
          pipeGap: dynamicPipeGap
        });
        
        // Only add coins for the first pipe in screens with multiple pipes (after level 15)
        const shouldAddCoins = screen < 15 || pipeInScreen === 0;
        
        if (shouldAddCoins) {
          const coinStartX = worldX + pipeWidth + 50;
          const gapCenterY = height + dynamicPipeGap / 2;
          const numCoins = 5;
          
          // Randomize coin pattern for screens 15+
          const patternOffset = screen >= 15 ? Math.random() * Math.PI * 2 : 0;
          
          for (let j = 0; j < numCoins; j++) {
            const coinX = coinStartX + (j * 60);
            const offsetY = Math.sin((j / numCoins) * Math.PI * 2 + patternOffset) * 40;
            
            initialCoins.push({
              id: `${pipeId}-${j}`,
              worldX: coinX,
              worldY: gapCenterY + offsetY,
              pipeId: pipeId
            });
          }
        }
        
        pipeId++;
      }
    }
    
    return { pipes: initialPipes, coins: initialCoins };
  };

  const startGame = () => {
    setBirdY(350);
    setBirdX(150);
    setVelocityX(0);
    setVelocityY(0);
    setCameraX(0);
    const { pipes, coins } = generatePipes();
    setPipes(pipes);
    setCoins(coins);
    setScore(0);
    setColorIndex(0);
    setGameState('playing');
    setIsDragging(false);
    setIsFlying(false);
    setTrajectoryPoints([]);
    setExplosionScale(1);
    setBirdSizeMultiplier(1);
    collectedCoinsRef.current = new Set();
    lastPassedPipeRef.current = -1;
  };



  const triggerExplosion = () => {
    setExplosionPos({ x: birdX - cameraX, y: birdY });
    setGameState('exploding');
    setExplosionScale(1);
    
    const explosionAnim = setInterval(() => {
      setExplosionScale(s => {
        const newScale = s + 1;
        if (newScale >= 15) {
          clearInterval(explosionAnim);
          setTimeout(() => {
            setGameState('gameOver');
            const newHighScore = Math.max(score, highScore);
            if (newHighScore > highScore) setHighScore(newHighScore);
            setIsFlying(false);
          }, 40);
        }
        return newScale;
      });
    }, 10);
  };

  useEffect(() => {
    const animatePipes = setInterval(() => {
      if (gameState !== 'playing') return;
      
      setPipes(currentPipes => 
        currentPipes.map(pipe => {
          if (pipe.movePattern === 'none') return pipe;
          
          const time = Date.now() / 1000 + pipe.moveOffset;
          let newPipe = { ...pipe };
          
          if (pipe.movePattern === 'vertical' || pipe.movePattern === 'both') {
            newPipe.topHeight = pipe.baseTopHeight + Math.sin(time * 1.5) * 60;
          }
          
          if (pipe.movePattern === 'horizontal' || pipe.movePattern === 'both') {
            newPipe.worldX = pipe.baseWorldX + Math.sin(time * 1.2) * 40;
          }
          
          return newPipe;
        })
      );
    }, 50);
    
    return () => clearInterval(animatePipes);
  }, [gameState]);

  const calculateTrajectory = (startX: number, startY: number, velX: number, velY: number) => {
    const points = [];
    let x = startX;
    let y = startY;
    let vx = velX;
    let vy = velY;
    
    for (let i = 0; i < 60; i++) {
      points.push({ x, y });
      x += vx;
      y += vy;
      vy += gravity;
      
      if (y > gameHeight || y < 0) break;
    }
    
    return points;
  };

  const handleMouseDown = (e: MouseEvent) => {
    if (gameState !== 'playing' || isFlying) return;
    
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const birdSize = baseBirdSize * birdSizeMultiplier;
    const screenBirdX = birdX - cameraX;
    const dx = mouseX - screenBirdX;
    const dy = mouseY - birdY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < birdSize * 2) {
      isDraggingRef.current = true;
      setIsDragging(true);
      dragStartRef.current = { x: screenBirdX, y: birdY };
      currentMouseRef.current = { x: mouseX, y: mouseY };
      setCurrentMouse({ x: mouseX, y: mouseY });
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDraggingRef.current || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    currentMouseRef.current = { x: mouseX, y: mouseY };
    setCurrentMouse({ x: mouseX, y: mouseY });
    
    const pullX = dragStartRef.current.x - mouseX;
    const pullY = dragStartRef.current.y - mouseY;
    const power = 0.15;
    
    const trajectory = calculateTrajectory(
      birdX,
      birdY,
      pullX * power,
      pullY * power
    );
    setTrajectoryPoints(trajectory);
  };

  const handleMouseUp = () => {
    if (!isDraggingRef.current) return;
    
    const pullX = dragStartRef.current.x - currentMouseRef.current.x;
    const pullY = dragStartRef.current.y - currentMouseRef.current.y;
    
    const power = 0.15;
    setVelocityX(pullX * power);
    setVelocityY(pullY * power);
    
    isDraggingRef.current = false;
    setIsDragging(false);
    setIsFlying(true);
    setTrajectoryPoints([]);
  };

  useEffect(() => {
    if (gameState !== 'playing') return;
    
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [gameState, isFlying, birdSizeMultiplier, birdX, birdY, cameraX]);



  useEffect(() => {
    if (!isFlying || gameState !== 'playing') return;

    gameLoopRef.current = setInterval(() => {
      setVelocityY(v => v + gravity);
      setBirdY(y => y + velocityY);
      setBirdX(x => x + velocityX);
      
      setVelocityX(vx => vx * 0.995);
    }, 20);

    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, [isFlying, gameState, velocityX, velocityY]);

  useEffect(() => {
    if (!isFlying || gameState !== 'playing') return;

    const birdSize = baseBirdSize * birdSizeMultiplier;
    const birdLeft = birdX - birdSize / 2;
    const birdRight = birdX + birdSize / 2;
    const birdTop = birdY - birdSize / 2;
    const birdBottom = birdY + birdSize / 2;

    if (birdTop <= 0 || birdBottom >= gameHeight - 64) {
      triggerExplosion();
      return;
    }

    coins.forEach(coin => {
      if (!collectedCoinsRef.current.has(coin.id)) {
        const coinSize = 20;
        const coinLeft = coin.worldX - coinSize / 2;
        const coinRight = coin.worldX + coinSize / 2;
        const coinTop = coin.worldY - coinSize / 2;
        const coinBottom = coin.worldY + coinSize / 2;
        
        if (birdRight > coinLeft && birdLeft < coinRight &&
            birdBottom > coinTop && birdTop < coinBottom) {
          collectedCoinsRef.current.add(coin.id);
          setBirdSizeMultiplier(prev => Math.max(0.4, prev - 0.08));
        }
      }
    });

    let shouldStop = false;

    pipes.forEach(pipe => {
      const pipeLeft = pipe.worldX;
      const pipeRight = pipe.worldX + pipeWidth;
      const stopLineX = pipeRight + 96;
      
      if (birdRight > pipeLeft && birdLeft < pipeRight) {
        if (birdTop < pipe.topHeight || birdBottom > pipe.topHeight + pipe.pipeGap) {
          triggerExplosion();
        }
      }

      // Only check goal line for pipes marked as goal pipes
      if (pipe.isGoalPipe && !pipe.passed && birdLeft >= stopLineX && pipe.screenId > lastPassedPipeRef.current) {
        pipe.passed = true;
        lastPassedPipeRef.current = pipe.screenId;
        setScore(s => s + 1);
        setColorIndex(c => c + 1);
        
        setBirdSizeMultiplier(prev => Math.min(2.5, prev + 0.25));
        
        shouldStop = true;
      }
    });

    if (shouldStop) {
      setIsFlying(false);
      setVelocityX(0);
      setVelocityY(0);
      
      if (score + 1 >= 30) {
        setGameState('win');
        const newHighScore = Math.max(score + 1, highScore);
        if (newHighScore > highScore) setHighScore(newHighScore);
        return;
      }
      
      const targetCameraX = birdX - 150;
      const smoothScroll = setInterval(() => {
        setCameraX(current => {
          const diff = targetCameraX - current;
          if (Math.abs(diff) < 1) {
            clearInterval(smoothScroll);
            return targetCameraX;
          }
          return current + diff * 0.1;
        });
      }, 16);
    }
  }, [birdY, birdX, pipes, coins, isFlying, gameState, score, highScore, birdSizeMultiplier]);

  return (
    <div 
      className="flex items-center justify-center min-h-screen transition-all duration-1000"
      style={{
        background: `linear-gradient(to bottom, ${currentColors.bgFrom}, ${currentColors.bgTo})`
      }}
    >
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-4 drop-shadow-lg">Slingshot Bird</h1>
        
        <div 
          ref={canvasRef}
          className="relative border-4 border-yellow-600 rounded-lg overflow-hidden transition-all duration-1000"
          style={{ 
            width: gameWidth, 
            height: gameHeight, 
            cursor: isDragging ? 'grabbing' : 'grab',
            backgroundColor: currentColors.sky
          }}
        >
          <div 
            className="absolute inset-0 transition-transform duration-100"
            style={{ transform: `translateX(-${cameraX}px)` }}
          >
            {isDragging && (
              <svg className="absolute inset-0 pointer-events-none" width={gameWidth + cameraX + 1000} height={gameHeight}>
                <line 
                  x1={birdX} 
                  y1={birdY} 
                  x2={currentMouse.x + cameraX} 
                  y2={currentMouse.y} 
                  stroke="rgba(139, 69, 19, 0.8)" 
                  strokeWidth="4"
                />
                {trajectoryPoints.map((point, i) => (
                  <circle
                    key={i}
                    cx={point.x}
                    cy={point.y}
                    r={3}
                    fill={`rgba(255, 255, 255, ${0.8 - i * 0.012})`}
                  />
                ))}
              </svg>
            )}

            <div 
              className="absolute bg-yellow-400 rounded-full border-2 border-yellow-600 shadow-lg transition-opacity duration-300"
              style={{ 
                left: birdX - (baseBirdSize * birdSizeMultiplier) / 2, 
                top: birdY - (baseBirdSize * birdSizeMultiplier) / 2,
                width: baseBirdSize * birdSizeMultiplier,
                height: baseBirdSize * birdSizeMultiplier,
                transform: isFlying ? `rotate(${Math.atan2(velocityY, velocityX) * 180 / Math.PI}deg)` : 'rotate(0deg)',
                opacity: gameState === 'exploding' ? 0 : 1
              }}
            >
              <div className="absolute w-2 h-2 bg-black rounded-full" style={{ top: '20%', right: '25%' }}></div>
              <div className="absolute w-3 h-2 bg-orange-500 rounded-r-full" style={{ top: '40%', right: '-5%' }}></div>
            </div>

            {coins.map((coin) => (
              !collectedCoinsRef.current.has(coin.id) && (
                <div
                  key={coin.id}
                  className="absolute rounded-full bg-yellow-300 border-2 border-yellow-500 shadow-lg flex items-center justify-center font-bold text-yellow-700"
                  style={{
                    left: coin.worldX - 10,
                    top: coin.worldY - 10,
                    width: 20,
                    height: 20,
                    fontSize: '12px'
                  }}
                >
                  $
                </div>
              )
            ))}

            {pipes.map((pipe, index) => (
              <div key={index}>
                <div 
                  className="absolute bg-green-600 border-4 border-green-800 shadow-lg"
                  style={{ 
                    left: pipe.worldX, 
                    top: 0, 
                    width: pipeWidth, 
                    height: pipe.topHeight 
                  }}
                >
                  <div className="absolute bottom-0 left-0 right-0 h-10 bg-green-500 border-t-2 border-green-700"></div>
                </div>
                
                <div 
                  className="absolute bg-green-600 border-4 border-green-800 shadow-lg"
                  style={{ 
                    left: pipe.worldX, 
                    top: pipe.topHeight + pipe.pipeGap, 
                    width: pipeWidth, 
                    height: gameHeight - pipe.topHeight - pipe.pipeGap 
                  }}
                >
                  <div className="absolute top-0 left-0 right-0 h-10 bg-green-500 border-b-2 border-green-700"></div>
                </div>
                
                {pipe.isGoalPipe && !pipe.passed && (
                  <>
                    <div 
                      className="absolute border-2 border-dashed border-yellow-400"
                      style={{
                        left: pipe.worldX,
                        top: pipe.topHeight,
                        width: pipeWidth,
                        height: pipe.pipeGap
                      }}
                    >
                      <div className="absolute inset-0 flex items-center justify-center text-yellow-400 text-2xl font-bold">
                        ★
                      </div>
                    </div>
                    
                    <div 
                      className="absolute border-l-4 border-dashed border-blue-400 opacity-70"
                      style={{
                        left: pipe.worldX + pipeWidth + 96,
                        top: 0,
                        height: gameHeight
                      }}
                    />
                  </>
                )}
              </div>
            ))}

            <div 
              className="absolute bottom-0 left-0 right-0 h-16 bg-amber-900 border-t-4 border-amber-950"
              style={{ width: gameWidth + cameraX + 5000 }}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-amber-800 to-amber-900"></div>
              <div className="absolute top-0 left-0 right-0 h-2 bg-green-700"></div>
            </div>
          </div>

          {gameState === 'exploding' && (
            <div 
              className="absolute inset-0 pointer-events-none flex items-center justify-center"
              style={{
                background: `radial-gradient(circle at ${explosionPos.x}px ${explosionPos.y}px, 
                  rgba(255, 200, 0, ${Math.min(explosionScale / 15, 0.8)}), 
                  transparent ${explosionScale * 50}px)`
              }}
            >
              <div 
                className="absolute rounded-full"
                style={{
                  left: explosionPos.x,
                  top: explosionPos.y,
                  width: explosionScale * 80,
                  height: explosionScale * 80,
                  transform: 'translate(-50%, -50%)',
                  background: 'radial-gradient(circle, rgba(255, 255, 255, 0.9) 0%, rgba(255, 200, 0, 0.8) 20%, rgba(255, 100, 0, 0.6) 40%, rgba(255, 50, 0, 0.3) 60%, transparent 100%)',
                  transition: 'all 0.05s ease-out'
                }}
              />
              {[...Array(12)].map((_, i) => (
                <div
                  key={i}
                  className="absolute rounded-full bg-orange-500"
                  style={{
                    left: explosionPos.x,
                    top: explosionPos.y,
                    width: 8,
                    height: 8,
                    transform: `translate(-50%, -50%) rotate(${i * 30}deg) translateY(-${explosionScale * 20}px)`,
                    opacity: Math.max(1 - explosionScale / 15, 0)
                  }}
                />
              ))}
            </div>
          )}

          {gameState !== 'start' && (
            <div className="absolute top-4 left-4 text-5xl font-bold text-white drop-shadow-lg z-10">
              {score}
            </div>
          )}

          {gameState === 'start' && (
            <div className="absolute inset-0 flex items-center justify-center bg-sky-400">
              <div className="absolute top-4 left-4 flex items-baseline gap-2 z-10">
                <span className="text-5xl font-bold text-white drop-shadow-lg">High Score:</span>
                <span className="text-5xl font-bold text-white drop-shadow-lg">{highScore}</span>
              </div>
              <div className="text-center px-8">
                <div className="mb-8">
                  <h2 className="text-5xl font-bold text-white drop-shadow-lg mb-2">Slingshot Bird</h2>
                  <p className="text-xl text-yellow-300 font-semibold">Reach 30 pipes to win!</p>
                </div>
                <div className="mb-6">
                  <h3 className="text-3xl font-bold text-white drop-shadow-lg mb-4">How to Play</h3>
                  <div className="text-center space-y-2 text-white text-lg drop-shadow">
                    <p>Drag the bird back like a slingshot</p>
                    <p>Release to launch through the gap</p>
                    <p>Touch the blue line to score</p>
                    <p>Collect coins to shrink smaller</p>
                    <p>Miss coins and grow bigger!</p>
                    <p>The difficulty will dynamically adjust</p>
                  </div>
                </div>
                <button 
                  onClick={startGame}
                  className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-4 px-10 rounded-full text-2xl shadow-2xl transform hover:scale-105 transition"
                >
                  Start Game
                </button>
              </div>
            </div>
          )}

          {gameState === 'gameOver' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-80 z-20">
              <div className="text-center bg-white p-10 rounded-2xl shadow-2xl">
                <p className="text-red-600 text-5xl font-bold mb-4">Game Over!</p>
                <p className="text-yellow-600 text-3xl mb-2">Score: {score}/30</p>
                {highScore > 0 && (
                  <p className="text-gray-600 text-2xl mb-6">High Score: {highScore}</p>
                )}
                <div className="space-y-4">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      startGame();
                    }}
                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-4 px-8 rounded-full text-2xl shadow-lg transform hover:scale-105 transition"
                  >
                    Try Again
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setGameState('start');
                    }}
                    className="w-full bg-gray-500 hover:bg-gray-600 text-white font-bold py-4 px-8 rounded-full text-2xl shadow-lg transform hover:scale-105 transition"
                  >
                    Main Menu
                  </button>
                </div>
              </div>
            </div>
          )}

          {gameState === 'win' && (
            <div className="absolute inset-0 flex items-center justify-center bg-yellow-400 z-20">
              <div className="text-center bg-white p-10 rounded-2xl shadow-2xl">
                <p className="text-green-600 text-6xl font-bold mb-4">YOU WIN!</p>
                <p className="text-gray-800 text-4xl mb-2">Perfect Score: 30/30</p>
                <p className="text-gray-600 text-2xl mb-8">You are a slingshot master!</p>
                <div className="space-y-4">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      startGame();
                    }}
                    className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 px-8 rounded-full text-2xl shadow-lg transform hover:scale-105 transition"
                  >
                    Play Again
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setGameState('start');
                    }}
                    className="w-full bg-gray-500 hover:bg-gray-600 text-white font-bold py-4 px-8 rounded-full text-2xl shadow-lg transform hover:scale-105 transition"
                  >
                    Main Menu
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <p className="text-white mt-4 text-lg drop-shadow">
          Drag and launch through 30 pipes to win!
        </p>
      </div>
    </div>
  );
};

export default FlappyBird;