import React, { useState, useEffect, useCallback } from 'react';
import './App.css';

const App = () => {
  const [size, setSize] = useState(3);
  const [board, setBoard] = useState([]);
  const [isSolving, setIsSolving] = useState(false);
  const [moves, setMoves] = useState([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [graph, setGraph] = useState({ nodes: [], edges: [] });
  const [isSolvable, setIsSolvable] = useState(true);
  const [customMode, setCustomMode] = useState(false);
  const [selectedTile, setSelectedTile] = useState(null);

  // Создание решенного состояния
  const createSolvedBoard = useCallback((size) => {
    const total = size * size;
    const board = [];
    for (let i = 1; i < total; i++) {
      board.push(i);
    }
    board.push(0);
    return board;
  }, []);

  // Проверка решаемости
  const checkSolvability = useCallback((board) => {
    const boardSize = Math.sqrt(board.length);
    let inversions = 0;
    const boardWithoutZero = board.filter(tile => tile !== 0);
    
    for (let i = 0; i < boardWithoutZero.length; i++) {
      for (let j = i + 1; j < boardWithoutZero.length; j++) {
        if (boardWithoutZero[i] > boardWithoutZero[j]) {
          inversions++;
        }
      }
    }
    
    if (boardSize % 2 === 1) {
      return inversions % 2 === 0;
    } else {
      const emptyRow = Math.floor(board.indexOf(0) / boardSize);
      return (inversions + emptyRow) % 2 === 1;
    }
  }, []);

  // Поиск пустой клетки
  const findEmptyTile = (board) => board.indexOf(0);

  // Получение возможных ходов
  const getPossibleMoves = useCallback((board) => {
    const emptyIndex = findEmptyTile(board);
    const emptyRow = Math.floor(emptyIndex / size);
    const emptyCol = emptyIndex % size;
    const moves = [];

    const directions = [
      { row: -1, col: 0, name: '↑', priority: 4 },
      { row: 0, col: -1, name: '←', priority: 3 },
      { row: 1, col: 0, name: '↓', priority: 2 },
      { row: 0, col: 1, name: '→', priority: 1 }
    ];

    for (const dir of directions) {
      const newRow = emptyRow + dir.row;
      const newCol = emptyCol + dir.col;
      
      if (newRow >= 0 && newRow < size && newCol >= 0 && newCol < size) {
        const tileIndex = newRow * size + newCol;
        moves.push({
          index: tileIndex,
          direction: dir.name,
          priority: dir.priority
        });
      }
    }

    return moves.sort((a, b) => b.priority - a.priority);
  }, [size]);

  // Выполнение хода
  const makeMove = (board, tileIndex) => {
    const emptyIndex = findEmptyTile(board);
    const newBoard = [...board];
    [newBoard[tileIndex], newBoard[emptyIndex]] = [newBoard[emptyIndex], newBoard[tileIndex]];
    return newBoard;
  };

  // Перемешивание доски
  const shuffleBoard = useCallback((board) => {
    let currentBoard = [...board];
    const movesCount = size * size * 10;
    
    for (let i = 0; i < movesCount; i++) {
      const possibleMoves = getPossibleMoves(currentBoard);
      if (possibleMoves.length > 0) {
        const randomMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
        currentBoard = makeMove(currentBoard, randomMove.index);
      }
    }
    
    return currentBoard;
  }, [size, getPossibleMoves]);

  // Проверка решения
  const isSolved = useCallback((board) => {
    const solved = createSolvedBoard(size);
    return JSON.stringify(board) === JSON.stringify(solved);
  }, [size, createSolvedBoard]);

  // НОВАЯ эвристическая функция: МАНХЭТТЕНСКОЕ РАССТОЯНИЕ
  const calculateHeuristic = (board, depth = 0) => {
    let manhattanDistance = 0;
    let wrongTiles = 0;
    
    // Считаем манхэттенское расстояние и неправильные фишки
    for (let i = 0; i < board.length; i++) {
      const value = board[i];
      if (value !== 0) {
        const targetPosition = value - 1;
        const currentRow = Math.floor(i / size);
        const currentCol = i % size;
        const targetRow = Math.floor(targetPosition / size);
        const targetCol = targetPosition % size;
        
        // Манхэттенское расстояние
        const distance = Math.abs(currentRow - targetRow) + Math.abs(currentCol - targetCol);
        manhattanDistance += distance;
        
        // Считаем неправильные фишки для обратной совместимости
        if (i !== targetPosition) {
          wrongTiles++;
        }
      }
    }
    
    // Используем манхэттенское расстояние как основную эвристику
    // f = g + h, где g - глубина, h - манхэттенское расстояние
    return {
      g: wrongTiles, // Оставляем для обратной совместимости
      h: depth,      // Оставляем для обратной совместимости  
      f: depth + manhattanDistance, // f = g + h (глубина + манхэттен)
      display: `f=${depth + manhattanDistance}`,
      manhattan: manhattanDistance, // Добавляем для информации
      wrongTiles: wrongTiles        // Добавляем для информации
    };
  };

  // Поиск решения с манхэттенским расстоянием
  const findSolution = useCallback((startBoard) => {
    const visited = new Set();
    const queue = [{ 
      board: startBoard, 
      path: [], 
      depth: 0,
      boardString: JSON.stringify(startBoard),
      heuristic: calculateHeuristic(startBoard, 0),
      priority: calculateHeuristic(startBoard, 0).f
    }];
    
    const nodes = [{ 
      id: JSON.stringify(startBoard), 
      depth: 0,
      heuristic: calculateHeuristic(startBoard, 0),
      board: startBoard,
      isSolutionPath: false
    }];
    
    const edges = [];
    let solution = null;

    visited.add(JSON.stringify(startBoard));

    const startTime = Date.now();
    const TIME_LIMIT = 20000; // Увеличиваем время
    const MAX_NODES = 10000;   // Увеличиваем лимит узлов

    while (queue.length > 0 && !solution) {
      if (Date.now() - startTime > TIME_LIMIT) break;

      // Сортируем по f (приоритету) - чем меньше f, тем лучше
      queue.sort((a, b) => a.priority - b.priority);
      const current = queue.shift();

      if (isSolved(current.board)) {
        solution = current;
        
        // Помечаем узлы на пути решения
        const solutionPath = new Set();
        let pathNode = current.boardString;
        solutionPath.add(pathNode);
        
        // Восстанавливаем путь назад к началу
        while (pathNode) {
          const edge = edges.find(e => e.to === pathNode);
          if (edge) {
            pathNode = edge.from;
            solutionPath.add(pathNode);
          } else {
            break;
          }
        }
        
        // Обновляем узлы с пометкой о пути решения
        nodes.forEach(node => {
          if (solutionPath.has(node.id)) {
            node.isSolutionPath = true;
          }
        });
        
        break;
      }

      const possibleMoves = getPossibleMoves(current.board);

      for (const move of possibleMoves) {
        const newBoard = makeMove(current.board, move.index);
        const newBoardString = JSON.stringify(newBoard);

        if (!visited.has(newBoardString)) {
          visited.add(newBoardString);
          const newDepth = current.depth + 1;
          const heuristic = calculateHeuristic(newBoard, newDepth);
          const priority = heuristic.f; // f = глубина + манхэттен
          
          const newNode = {
            id: newBoardString,
            depth: newDepth,
            heuristic: heuristic,
            board: newBoard,
            isSolutionPath: false
          };
          nodes.push(newNode);

          edges.push({
            from: current.boardString,
            to: newBoardString,
            label: move.direction
          });

          queue.push({
            board: newBoard,
            path: [...current.path, move],
            depth: newDepth,
            boardString: newBoardString,
            heuristic: heuristic,
            priority: priority
          });

          if (nodes.length > MAX_NODES) {
            return { 
              solution: null, 
              nodes, 
              edges, 
              searchedNodes: nodes.length,
              timeExceeded: false,
              nodeLimitReached: true
            };
          }
        }
      }
    }

    return { 
      solution, 
      nodes, 
      edges, 
      searchedNodes: nodes.length,
      timeExceeded: !solution && Date.now() - startTime >= TIME_LIMIT,
      nodeLimitReached: nodes.length >= MAX_NODES
    };
  }, [getPossibleMoves, isSolved]);

  // Инициализация игры
  const initializeGame = useCallback(() => {
    const solvedBoard = createSolvedBoard(size);
    let newBoard;
    
    if (customMode) {
      newBoard = solvedBoard;
    } else {
      newBoard = shuffleBoard(solvedBoard);
    }
    
    setBoard(newBoard);
    setMoves([]);
    setCurrentMoveIndex(0);
    setGraph({ nodes: [], edges: [] });
    setIsSolving(false);
    setSelectedTile(null);
    
    const solvable = checkSolvability(newBoard);
    setIsSolvable(solvable);
    
    if (!solvable && !customMode) {
      setTimeout(() => initializeGame(), 100);
    }
  }, [size, createSolvedBoard, shuffleBoard, checkSolvability, customMode]);

  // Обработчик клика по плитке
  const handleTileClick = (index) => {
    if (isSolving) return;
    
    const emptyIndex = findEmptyTile(board);
    
    if (customMode) {
      if (selectedTile === null) {
        if (board[index] !== 0) {
          setSelectedTile(index);
        }
      } else {
        const newBoard = [...board];
        [newBoard[selectedTile], newBoard[emptyIndex]] = [newBoard[emptyIndex], newBoard[selectedTile]];
        setBoard(newBoard);
        setSelectedTile(null);
        
        const solvable = checkSolvability(newBoard);
        setIsSolvable(solvable);
        
        if (!solvable) {
          alert('❌ Эта расстановка не имеет решения! Измените расположение плиток.');
        }
      }
    } else {
      const clickedRow = Math.floor(index / size);
      const clickedCol = index % size;
      const emptyRow = Math.floor(emptyIndex / size);
      const emptyCol = emptyIndex % size;
      
      const isAdjacent = 
        (Math.abs(clickedRow - emptyRow) === 1 && clickedCol === emptyCol) ||
        (Math.abs(clickedCol - emptyCol) === 1 && clickedRow === emptyRow);
      
      if (isAdjacent) {
        const newBoard = makeMove(board, index);
        setBoard(newBoard);
      }
    }
  };

  // Запуск решения
  const startSolving = () => {
    if (!isSolvable) {
      alert('❌ Эта расстановка не имеет решения! Измените расположение плиток.');
      return;
    }
    
    setIsSolving(true);
    
    setTimeout(() => {
      const result = findSolution(board);
      setGraph(result);
      
      if (result.solution) {
        setMoves(result.solution.path || []);
        setCurrentMoveIndex(0);
      } else {
        setIsSolving(false);
        if (result.timeExceeded) {
          alert('⏰ Время поиска превышено.');
        } else if (result.nodeLimitReached) {
          alert('📊 Достигнут лимит исследуемых узлов.');
        } else {
          alert('❌ Решение не найдено.');
        }
      }
    }, 100);
  };

  // Воспроизведение решения
  useEffect(() => {
    if (isSolving && moves.length > 0 && currentMoveIndex < moves.length) {
      const timer = setTimeout(() => {
        const move = moves[currentMoveIndex];
        setBoard(prevBoard => makeMove(prevBoard, move.index));
        setCurrentMoveIndex(prev => prev + 1);
      }, 600);
      
      return () => clearTimeout(timer);
    } else if (currentMoveIndex >= moves.length && moves.length > 0) {
      setIsSolving(false);
    }
  }, [isSolving, moves, currentMoveIndex]);

  useEffect(() => {
    initializeGame();
  }, [initializeGame]);

  useEffect(() => {
    if (!customMode) {
      setSelectedTile(null);
    }
  }, [customMode]);

  // Рендер мини-доски для графа
  const renderMiniBoard = (board, size) => {
    const tileSize = 20;
    return (
      <div 
        className="mini-board"
        style={{
          gridTemplateColumns: `repeat(${size}, ${tileSize}px)`,
          gridTemplateRows: `repeat(${size}, ${tileSize}px)`,
          gap: '1px'
        }}
      >
        {board.map((num, idx) => {
          const isCorrect = num !== 0 && 
            Math.floor((num - 1) / size) === Math.floor(idx / size) && 
            (num - 1) % size === idx % size;
          
          return (
            <div 
              key={idx}
              className={`mini-tile ${num === 0 ? 'mini-empty' : ''} ${isCorrect ? 'mini-correct' : ''}`}
            >
              {num !== 0 ? num : ''}
            </div>
          );
        })}
      </div>
    );
  };

  // Рендер графика зависимости g от h
  const renderHeuristicChart = () => {
    if (!graph.solution || graph.nodes.length === 0) return null;

    // Собираем данные для графика из узлов на пути решения
    const solutionNodes = graph.nodes.filter(node => node.isSolutionPath)
      .sort((a, b) => a.depth - b.depth);
    
    if (solutionNodes.length === 0) return null;

    const dataPoints = solutionNodes.map(node => ({
      g: node.heuristic.g, // количество неправильных фишек
      h: node.heuristic.h, // глубина
      f: node.heuristic.f,
      depth: node.depth
    }));

    // Находим максимальные значения для масштабирования
    const maxG = Math.max(...dataPoints.map(d => d.g));
    const maxH = Math.max(...dataPoints.map(d => d.h));
    const maxF = Math.max(...dataPoints.map(d => d.f));

    const chartWidth = 400;
    const chartHeight = 300;
    const padding = 40;

    return (
      <div className="heuristic-chart">
        <h4>📈 График зависимости g от h</h4>
        <div className="chart-container">
          <svg width={chartWidth} height={chartHeight} className="chart-svg">
            {/* Оси */}
            <line 
              x1={padding} y1={chartHeight - padding} 
              x2={chartWidth - padding} y2={chartHeight - padding} 
              stroke="#333" strokeWidth="2" 
            />
            <line 
              x1={padding} y1={padding} 
              x2={padding} y2={chartHeight - padding} 
              stroke="#333" strokeWidth="2" 
            />
            
            {/* Подписи осей */}
            <text x={chartWidth / 2} y={chartHeight - 10} textAnchor="middle" fill="#333">
              h
            </text>
            <text x={10} y={chartHeight / 2} textAnchor="middle" fill="#333" transform={`rotate(-90, 10, ${chartHeight / 2})`}>
              g
            </text>

            {/* Сетка и метки */}
            {[0, 1, 2, 3, 4, 5].map(tick => {
              const x = padding + (tick / 5) * (chartWidth - 2 * padding);
              const y = chartHeight - padding - (tick / 5) * (chartHeight - 2 * padding);
              
              return (
                <g key={`grid-${tick}`}>
                  {/* Вертикальные линии сетки */}
                  <line 
                    x1={x} y1={padding} 
                    x2={x} y2={chartHeight - padding} 
                    stroke="#eee" strokeWidth="1" 
                  />
                  {/* Горизонтальные линии сетки */}
                  <line 
                    x1={padding} y1={y} 
                    x2={chartWidth - padding} y2={y} 
                    stroke="#eee" strokeWidth="1" 
                  />
                  {/* Метки на оси X */}
                  <text x={x} y={chartHeight - padding + 15} textAnchor="middle" fill="#666" fontSize="12">
                    {Math.round((tick / 5) * maxH)}
                  </text>
                  {/* Метки на оси Y */}
                  <text x={padding - 10} y={y} textAnchor="end" fill="#666" fontSize="12" dy="4">
                    {Math.round((tick / 5) * maxG)}
                  </text>
                </g>
              );
            })}

            {/* Точки данных */}
            {dataPoints.map((point, index) => {
              const x = padding + (point.h / maxH) * (chartWidth - 2 * padding);
              const y = chartHeight - padding - (point.g / maxG) * (chartHeight - 2 * padding);
              
              return (
                <g key={`point-${index}`}>
                  <circle 
                    cx={x} 
                    cy={y} 
                    r="4" 
                    fill="#4CAF50" 
                    stroke="#2E7D32" 
                    strokeWidth="1"
                  />
                  <text 
                    x={x} 
                    y={y - 8} 
                    textAnchor="middle" 
                    fill="#333" 
                    fontSize="10"
                  >
                    f={point.f}
                  </text>
                </g>
              );
            })}

            {/* Линия тренда */}
            {dataPoints.map((point, index) => {
              if (index === 0) return null;
              const prevPoint = dataPoints[index - 1];
              const x1 = padding + (prevPoint.h / maxH) * (chartWidth - 2 * padding);
              const y1 = chartHeight - padding - (prevPoint.g / maxG) * (chartHeight - 2 * padding);
              const x2 = padding + (point.h / maxH) * (chartWidth - 2 * padding);
              const y2 = chartHeight - padding - (point.g / maxG) * (chartHeight - 2 * padding);
              
              return (
                <line 
                  key={`line-${index}`}
                  x1={x1} 
                  y1={y1} 
                  x2={x2} 
                  y2={y2} 
                  stroke="#4CAF50" 
                  strokeWidth="2" 
                  strokeDasharray="5,5"
                />
              );
            })}
          </svg>
        </div>

        <div className="chart-stats">
          <p><strong>Начальное состояние:</strong> g={dataPoints[0].g}, h={dataPoints[0].h}, f={dataPoints[0].f}</p>
          <p><strong>Конечное состояние:</strong> g={dataPoints[dataPoints.length-1].g}, h={dataPoints[dataPoints.length-1].h}, f={dataPoints[dataPoints.length-1].f}</p>
          <p><strong>Изменение g:</strong> {dataPoints[0].g - dataPoints[dataPoints.length-1].g} фишек</p>
        </div>
      </div>
    );
  };

  // Рендер основной плитки
  const renderTile = (number, index) => {
    const isEmpty = number === 0;
    const tileSize = size === 4 ? 60 : 70;
    const isCorrectPosition = number !== 0 && 
      Math.floor((number - 1) / size) === Math.floor(index / size) && 
      (number - 1) % size === index % size;
    const isSelected = selectedTile === index;
    
    return (
      <div 
        key={index} 
        className={`tile ${isEmpty ? 'empty' : ''} ${isCorrectPosition ? 'correct' : ''} ${isSelected ? 'selected' : ''} ${customMode ? 'editable' : ''}`}
        onClick={() => handleTileClick(index)}
        style={{
          width: `${tileSize}px`,
          height: `${tileSize}px`,
          fontSize: `${tileSize * 0.4}px`
        }}
      >
        {!isEmpty ? number : ''}
      </div>
    );
  };

  // Рендер графа
  const renderGraphWithNewHeuristic = () => {
    if (graph.nodes.length === 0) return null;

    // Фильтруем узлы: показываем только путь решения
    const solutionNodes = graph.nodes.filter(node => node.isSolutionPath);
    const nodesByDepth = {};
    
    solutionNodes.forEach(node => {
      if (!nodesByDepth[node.depth]) {
        nodesByDepth[node.depth] = [];
      }
      nodesByDepth[node.depth].push(node);
    });

    const depths = Object.keys(nodesByDepth).sort((a, b) => a - b);

    return (
      <div className="state-graph">
        <div className="tree-container">
          {depths.map(depth => (
            <div key={depth} className="tree-level">
              <div className="level-label">Глубина {depth} (h={depth})</div>
              <div className="level-nodes">
                {nodesByDepth[depth].map((node, index) => {
                  const wrongTiles = node.heuristic.g;
                  
                  return (
                    <div 
                      key={node.id}
                      className="state-node solution-path"
                    >
                      <div className="node-header">
                        <div className="cost-info">
                          <span className="f-cost">f={node.heuristic.f} </span>
                          <span className="g-cost">g={wrongTiles}</span>
                        </div>
                      </div>
                      
                      {renderMiniBoard(node.board, size)}
                      
                      {/* Показываем направление хода */}
                      {graph.edges
                        .filter(edge => edge.to === node.id)
                        .map(edge => (
                          <div key={edge.from} className="incoming-arrow">
                            ← {edge.label}
                          </div>
                        ))}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {graph.solution && (
          <div className="solution-summary">
            <h4>Оптимальный путь решения</h4>
            <div className="solution-progress">
              <div className="progress-bar">
                <div 
                  className="progress-fill"
                  style={{width: `${((graph.nodes[0].heuristic.f - graph.solution.priority) / graph.nodes[0].heuristic.f) * 100}%`}}
                ></div>
              </div>
            </div>
            <div className="solution-details">
              <p><strong>Ходов:</strong> {moves.length}</p>
              <p><strong>Исследовано узлов:</strong> {graph.searchedNodes}</p>
            </div>
          </div>
        )}

        {/* Добавляем график */}
        {renderHeuristicChart()}
      </div>
    );
  };

  return (
    <div className="App">
      <div className="game-container">
        <h1>🧩 Пятнашки</h1>
        
        <div className="controls">
          <div className="control-group">
            <label>Размер: </label>
            {[2, 3, 4].map(s => (
              <button
                key={s}
                className={`size-btn ${size === s ? 'active' : ''}`}
                onClick={() => setSize(s)}
                disabled={isSolving}
              >
                {s}x{s}
              </button>
            ))}
          </div>

          <div className="control-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={customMode}
                onChange={(e) => setCustomMode(e.target.checked)}
                disabled={isSolving}
              />
              Ручная настройка
            </label>
          </div>

          <div className="action-controls">
            <button 
              onClick={initializeGame} 
              className="btn new-game"
              disabled={isSolving}
            >
              🎲 Новая игра
            </button>
            
            <button 
              onClick={startSolving} 
              className="btn solve"
              disabled={isSolving}
            >
              {isSolving ? '⚡ Решается...' : '🔍 Найти решение'}
            </button>
          </div>
        </div>

        {!isSolvable && (
          <div className="warning">
            ⚠️ Эта расстановка не имеет решения! Измените расположение плиток.
          </div>
        )}

        {customMode && (
          <div className="custom-mode-info">
            <p>🎮 Режим настройки: кликайте по плиткам для обмена с пустой клеткой</p>
            {selectedTile && <p>Выбрана плитка: {board[selectedTile]} - кликните на пустую клетку для обмена</p>}
          </div>
        )}

        <div className="game-info">
          <p className="status-message">
            {isSolving 
              ? `🔍 Поиск... (${currentMoveIndex + 1}/${moves.length})`
              : isSolved(board) 
                ? '🎉 Решено!' 
                : customMode
                  ? '⚙️ Настройте начальную позицию'
                  : 'Решите головоломку!'
            }
          </p>
        </div>

        <div className="board-container">
          <div 
            className="board"
            style={{ 
              gridTemplateColumns: `repeat(${size}, ${size === 4 ? 60 : 70}px)`,
              gridGap: '4px',
              padding: `${size === 4 ? 8 : 10}px`
            }}
          >
            {board.map((number, index) => renderTile(number, index))}
          </div>
        </div>

        {renderGraphWithNewHeuristic()}
      </div>
    </div>
  );
};

export default App;