/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Play, Pause, RotateCcw, ArrowLeft, ArrowRight, ArrowDown, ArrowUp } from 'lucide-react';

// --- Constants ---
const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;

const COLORS = {
  I: '#00f0f0', // Cyan
  J: '#0000f0', // Blue
  L: '#f0a000', // Orange
  O: '#f0f000', // Yellow
  S: '#00f000', // Green
  T: '#a000f0', // Purple
  Z: '#f00000', // Red
};

const SHAPES = {
  I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
  J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
  L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
  O: [[1, 1], [1, 1]],
  S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
  T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
  Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
};

type PieceType = keyof typeof SHAPES;

interface Piece {
  pos: { x: number; y: number };
  shape: number[][];
  type: PieceType;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nextCanvasRef = useRef<HTMLCanvasElement>(null);
  
  // Game State Refs (to avoid re-renders in the loop)
  const boardRef = useRef<string[][]>(Array.from({ length: ROWS }, () => Array(COLS).fill('')));
  const pieceRef = useRef<Piece | null>(null);
  const nextPieceRef = useRef<PieceType | null>(null);
  const scoreRef = useRef(0);
  const highScoreRef = useRef(Number(localStorage.getItem('tetrisHighScore')) || 0);
  const linesRef = useRef(0);
  const levelRef = useRef(1);
  const gameOverRef = useRef(false);
  const pausedRef = useRef(false);
  const dropCounterRef = useRef(0);
  const lastTimeRef = useRef(0);
  const dropIntervalRef = useRef(1000);

  // React State for UI
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(highScoreRef.current);
  const [level, setLevel] = useState(1);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // --- Helpers ---
  const createPiece = (type: PieceType): Piece => ({
    pos: { x: Math.floor(COLS / 2) - Math.floor(SHAPES[type][0].length / 2), y: 0 },
    shape: SHAPES[type],
    type,
  });

  const getRandomPieceType = (): PieceType => {
    const types = Object.keys(SHAPES) as PieceType[];
    return types[Math.floor(Math.random() * types.length)];
  };

  const collide = (board: string[][], piece: Piece) => {
    const { shape, pos } = piece;
    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[y].length; x++) {
        if (shape[y][x] !== 0 && (board[y + pos.y]?.[x + pos.x] !== '' || y + pos.y >= ROWS || x + pos.x < 0 || x + pos.x >= COLS)) {
          return true;
        }
      }
    }
    return false;
  };

  const merge = (board: string[][], piece: Piece) => {
    piece.shape.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value !== 0) {
          board[y + piece.pos.y][x + piece.pos.x] = piece.type;
        }
      });
    });
  };

  const rotate = (matrix: number[][]) => {
    const result = matrix[0].map((_, colIndex) => matrix.map(row => row[colIndex]).reverse());
    return result;
  };

  const clearLines = () => {
    let linesCleared = 0;
    outer: for (let y = ROWS - 1; y >= 0; y--) {
      for (let x = 0; x < COLS; x++) {
        if (boardRef.current[y][x] === '') continue outer;
      }
      const row = boardRef.current.splice(y, 1)[0].fill('');
      boardRef.current.unshift(row);
      y++;
      linesCleared++;
    }

    if (linesCleared > 0) {
      const points = [0, 100, 300, 500, 800][linesCleared] * levelRef.current;
      scoreRef.current += points;
      linesRef.current += linesCleared;
      
      if (scoreRef.current > highScoreRef.current) {
        highScoreRef.current = scoreRef.current;
        localStorage.setItem('tetrisHighScore', String(highScoreRef.current));
        setHighScore(highScoreRef.current);
      }

      if (linesRef.current >= levelRef.current * 10) {
        levelRef.current++;
        dropIntervalRef.current = Math.max(100, 1000 - (levelRef.current - 1) * 100);
        setLevel(levelRef.current);
      }
      
      setScore(scoreRef.current);
    }
  };

  const resetGame = () => {
    boardRef.current = Array.from({ length: ROWS }, () => Array(COLS).fill(''));
    scoreRef.current = 0;
    linesRef.current = 0;
    levelRef.current = 1;
    dropIntervalRef.current = 1000;
    gameOverRef.current = false;
    pausedRef.current = false;
    nextPieceRef.current = getRandomPieceType();
    pieceRef.current = createPiece(getRandomPieceType());
    
    setScore(0);
    setLevel(1);
    setIsGameOver(false);
    setIsPaused(false);
  };

  const drop = () => {
    if (gameOverRef.current || pausedRef.current) return;
    
    const p = pieceRef.current!;
    p.pos.y++;
    if (collide(boardRef.current, p)) {
      p.pos.y--;
      merge(boardRef.current, p);
      clearLines();
      
      const nextType = nextPieceRef.current!;
      nextPieceRef.current = getRandomPieceType();
      pieceRef.current = createPiece(nextType);
      
      if (collide(boardRef.current, pieceRef.current)) {
        gameOverRef.current = true;
        setIsGameOver(true);
      }
    }
    dropCounterRef.current = 0;
  };

  const hardDrop = () => {
    if (gameOverRef.current || pausedRef.current) return;
    const p = pieceRef.current!;
    while (!collide(boardRef.current, p)) {
      p.pos.y++;
    }
    p.pos.y--;
    drop();
  };

  const move = (dir: number) => {
    if (gameOverRef.current || pausedRef.current) return;
    const p = pieceRef.current!;
    p.pos.x += dir;
    if (collide(boardRef.current, p)) {
      p.pos.x -= dir;
    }
  };

  const playerRotate = () => {
    if (gameOverRef.current || pausedRef.current) return;
    const p = pieceRef.current!;
    const pos = p.pos.x;
    let offset = 1;
    p.shape = rotate(p.shape);
    while (collide(boardRef.current, p)) {
      p.pos.x += offset;
      offset = -(offset + (offset > 0 ? 1 : -1));
      if (offset > p.shape[0].length) {
        p.shape = rotate(rotate(rotate(p.shape))); // Rotate back
        p.pos.x = pos;
        return;
      }
    }
  };

  const getGhostPiece = (): Piece => {
    const p = pieceRef.current!;
    const ghost = { ...p, pos: { ...p.pos } };
    while (!collide(boardRef.current, ghost)) {
      ghost.pos.y++;
    }
    ghost.pos.y--;
    return ghost;
  };

  // --- Rendering ---
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Grid Lines (subtle)
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * BLOCK_SIZE, 0);
      ctx.lineTo(x * BLOCK_SIZE, ROWS * BLOCK_SIZE);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * BLOCK_SIZE);
      ctx.lineTo(COLS * BLOCK_SIZE, y * BLOCK_SIZE);
      ctx.stroke();
    }

    // Draw Board
    boardRef.current.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value !== '') {
          drawBlock(ctx, x, y, COLORS[value as PieceType]);
        }
      });
    });

    // Draw Ghost
    if (pieceRef.current && !gameOverRef.current && !pausedRef.current) {
      const ghost = getGhostPiece();
      ghost.shape.forEach((row, y) => {
        row.forEach((value, x) => {
          if (value !== 0) {
            drawBlock(ctx, x + ghost.pos.x, y + ghost.pos.y, COLORS[ghost.type], true);
          }
        });
      });

      // Draw Current Piece
      pieceRef.current.shape.forEach((row, y) => {
        row.forEach((value, x) => {
          if (value !== 0) {
            drawBlock(ctx, x + pieceRef.current!.pos.x, y + pieceRef.current!.pos.y, COLORS[pieceRef.current!.type]);
          }
        });
      });
    }

    // Draw Next Piece Preview
    const nextCanvas = nextCanvasRef.current;
    if (nextCanvas && nextPieceRef.current) {
      const nCtx = nextCanvas.getContext('2d');
      if (nCtx) {
        nCtx.fillStyle = '#111';
        nCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
        const shape = SHAPES[nextPieceRef.current];
        const color = COLORS[nextPieceRef.current];
        const offsetX = (nextCanvas.width - shape[0].length * 20) / 2;
        const offsetY = (nextCanvas.height - shape.length * 20) / 2;
        shape.forEach((row, y) => {
          row.forEach((value, x) => {
            if (value !== 0) {
              drawBlock(nCtx, x, y, color, false, 20, offsetX, offsetY);
            }
          });
        });
      }
    }
  }, []);

  const drawBlock = (
    ctx: CanvasRenderingContext2D, 
    x: number, 
    y: number, 
    color: string, 
    isGhost = false, 
    size = BLOCK_SIZE,
    offsetX = 0,
    offsetY = 0
  ) => {
    const px = x * size + offsetX;
    const py = y * size + offsetY;

    if (isGhost) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 2, py + 2, size - 4, size - 4);
      ctx.fillStyle = `${color}22`;
      ctx.fillRect(px + 2, py + 2, size - 4, size - 4);
    } else {
      // Main block
      ctx.fillStyle = color;
      ctx.fillRect(px + 1, py + 1, size - 2, size - 2);
      
      // Highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fillRect(px + 1, py + 1, size - 2, size / 4);
      
      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(px + 1, py + size - size / 4, size - 2, size / 4);
      
      // Glow
      ctx.shadowBlur = 10;
      ctx.shadowColor = color;
      ctx.strokeStyle = color;
      ctx.strokeRect(px + 1, py + 1, size - 2, size - 2);
      ctx.shadowBlur = 0;
    }
  };

  // --- Game Loop ---
  useEffect(() => {
    resetGame();

    const update = (time = 0) => {
      const deltaTime = time - lastTimeRef.current;
      lastTimeRef.current = time;

      if (!pausedRef.current && !gameOverRef.current) {
        dropCounterRef.current += deltaTime;
        if (dropCounterRef.current > dropIntervalRef.current) {
          drop();
        }
      }

      draw();
      requestAnimationFrame(update);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameOverRef.current) return;

      switch (e.key) {
        case 'ArrowLeft': move(-1); break;
        case 'ArrowRight': move(1); break;
        case 'ArrowDown': drop(); break;
        case 'ArrowUp': playerRotate(); break;
        case ' ': e.preventDefault(); hardDrop(); break;
        case 'p':
        case 'P':
          pausedRef.current = !pausedRef.current;
          setIsPaused(pausedRef.current);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    requestAnimationFrame(update);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [draw]);

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans flex flex-col items-center justify-center p-4 overflow-hidden">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 text-center"
      >
        <h1 className="text-5xl font-black tracking-tighter italic uppercase bg-gradient-to-r from-cyan-400 via-purple-500 to-red-500 bg-clip-text text-transparent">
          Neon Tetris
        </h1>
        <p className="text-zinc-500 text-xs uppercase tracking-[0.3em] mt-1 font-mono">High Performance Arcade</p>
      </motion.div>

      <div className="flex flex-col md:flex-row gap-8 items-start">
        {/* Left Sidebar: Stats */}
        <div className="flex flex-col gap-4 w-full md:w-48 order-2 md:order-1">
          <StatCard label="Score" value={score} icon={<Trophy className="w-4 h-4 text-yellow-500" />} />
          <StatCard label="High Score" value={highScore} icon={<Trophy className="w-4 h-4 text-cyan-500" />} />
          <StatCard label="Level" value={level} />
          
          <div className="mt-4 p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800/50 backdrop-blur-sm">
            <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-3 font-semibold">Controls</p>
            <div className="space-y-2 text-xs font-mono text-zinc-400">
              <div className="flex justify-between"><span>Move</span> <span className="text-zinc-200">Arrows</span></div>
              <div className="flex justify-between"><span>Rotate</span> <span className="text-zinc-200">Up</span></div>
              <div className="flex justify-between"><span>Drop</span> <span className="text-zinc-200">Space</span></div>
              <div className="flex justify-between"><span>Pause</span> <span className="text-zinc-200">P</span></div>
            </div>
          </div>
        </div>

        {/* Main Game Board */}
        <div className="relative order-1 md:order-2">
          <div className="p-2 rounded-3xl bg-zinc-900 border-4 border-zinc-800 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
            <canvas
              ref={canvasRef}
              width={COLS * BLOCK_SIZE}
              height={ROWS * BLOCK_SIZE}
              className="rounded-xl"
            />
          </div>

          {/* Overlays */}
          <AnimatePresence>
            {isPaused && !isGameOver && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-3xl"
              >
                <div className="text-center">
                  <Pause className="w-16 h-16 text-cyan-400 mx-auto mb-4 animate-pulse" />
                  <h2 className="text-3xl font-black uppercase italic">Paused</h2>
                  <p className="text-zinc-400 text-sm mt-2">Press 'P' to resume</p>
                </div>
              </motion.div>
            )}

            {isGameOver && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 backdrop-blur-md rounded-3xl"
              >
                <div className="text-center p-8">
                  <h2 className="text-5xl font-black uppercase italic text-red-500 mb-2">Game Over</h2>
                  <p className="text-zinc-400 mb-6">Final Score: <span className="text-white font-bold">{score}</span></p>
                  <button
                    onClick={resetGame}
                    className="group relative px-8 py-4 bg-white text-black font-black uppercase italic rounded-full overflow-hidden transition-transform active:scale-95"
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      <RotateCcw className="w-5 h-5" />
                      Try Again
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Sidebar: Next Piece */}
        <div className="flex flex-col gap-4 w-full md:w-48 order-3">
          <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800/50 backdrop-blur-sm">
            <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-3 font-semibold">Next Piece</p>
            <div className="flex justify-center">
              <canvas
                ref={nextCanvasRef}
                width={100}
                height={100}
                className="rounded-lg bg-zinc-950"
              />
            </div>
          </div>

          {/* Mobile Controls (Only visible on small screens) */}
          <div className="md:hidden grid grid-cols-3 gap-2 mt-4">
            <div />
            <ControlButton icon={<ArrowUp />} onClick={playerRotate} />
            <div />
            <ControlButton icon={<ArrowLeft />} onClick={() => move(-1)} />
            <ControlButton icon={<ArrowDown />} onClick={drop} />
            <ControlButton icon={<ArrowRight />} onClick={() => move(1)} />
            <div />
            <ControlButton icon={<Play className="w-4 h-4" />} onClick={() => { pausedRef.current = !pausedRef.current; setIsPaused(pausedRef.current); }} className="col-span-1" />
            <div />
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-12 text-zinc-600 text-[10px] uppercase tracking-[0.4em] font-mono">
        &copy; 2024 Neon Tetris Engine v1.0
      </footer>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number | string; icon?: React.ReactNode }) {
  return (
    <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800/50 backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">{label}</p>
      </div>
      <p className="text-2xl font-black font-mono tracking-tighter">{value}</p>
    </div>
  );
}

function ControlButton({ icon, onClick, className = "" }: { icon: React.ReactNode; onClick: () => void; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={`p-4 bg-zinc-800 rounded-xl flex items-center justify-center active:bg-zinc-700 transition-colors ${className}`}
    >
      {icon}
    </button>
  );
}
