const mapInput = document.querySelector('#mapInput');
const solutionInput = document.querySelector('#solutionInput');
const mapSizeChip = document.querySelector('#mapSizeChip');
const commandCountChip = document.querySelector('#commandCountChip');
const mapCanvas = document.querySelector('#mapCanvas');
const statusCard = document.querySelector('#statusCard');
const statusPill = document.querySelector('#statusPill');
const statusMessage = document.querySelector('#statusMessage');
const statusDetails = document.querySelector('#statusDetails');
const statusTimestamp = document.querySelector('#statusTimestamp');
const metricSteps = document.querySelector('#metricSteps');
const metricGems = document.querySelector('#metricGems');
const metricSwitches = document.querySelector('#metricSwitches');
const metricErrors = document.querySelector('#metricErrors');
const issueList = document.querySelector('#issueList');
const logList = document.querySelector('#logList');
const runButton = document.querySelector('#runButton');
const downloadReportButton = document.querySelector('#downloadReportButton');
const expandLogButton = document.querySelector('#expandLogButton');
const collapseLogButton = document.querySelector('#collapseLogButton');
const loadSampleButton = document.querySelector('#loadSampleButton');
const clearInputsButton = document.querySelector('#clearInputsButton');
const previewNote = document.querySelector('#previewNote');

const legend = {
  stop: '止',
  gem: '♦',
  switchOpen: '〇',
  switchClosed: '●',
  arrows: ['↑', '↓', '←', '→'],
};

const SAMPLE_MAP = `止	止	止	→			♦
止	止	止	止	止	止	W1
止	止	止	止	止	W1	止
	止	止	止	止		止
♦			W2	止		止
止	止	止	止	W2	♦	止`;

const SAMPLE_SOLUTION = `moveForward()
moveForward()
moveForward()
collectGem()
turnRight()
moveForward()
moveForward()
moveForward()
moveForward()
collectGem()
turnRight()
moveForward()
moveForward()
moveForward()
moveForward()
collectGem()`;

const Command = {
  MOVE_FORWARD: 'moveForward',
  TURN_LEFT: 'turnLeft',
  TURN_RIGHT: 'turnRight',
  COLLECT_GEM: 'collectGem',
  TOGGLE_SWITCH: 'toggleSwitch',
};

const directionVectors = {
  up: { row: -1, col: 0 },
  down: { row: 1, col: 0 },
  left: { row: 0, col: -1 },
  right: { row: 0, col: 1 },
};

const rotations = ['up', 'right', 'down', 'left'];

const startArrowToDirection = {
  [legend.arrows[0]]: 'up',
  [legend.arrows[1]]: 'down',
  [legend.arrows[2]]: 'left',
  [legend.arrows[3]]: 'right',
};

const statusLabels = {
  idle: '未検証',
  success: '成功',
  failure: '失敗',
  error: 'エラー',
};

const summaryMessages = {
  idle: 'マップとコードを入力し、下の「検証を実行」を押してください。',
  success: '模範解答はマップ上で正常に実行されました。',
  failure: '模範解答に問題があります。詳細を確認してください。',
  error: '解析時にエラーが発生しました。入力内容をご確認ください。',
};

const detailMessages = {
  idle: 'サンプルデータを読み込むと動作イメージを確認できます。',
  success: 'ジェムとスイッチはすべて期待通りです。ログから実行内容を確認できます。',
  failure: '不足しているアクションやマップ上の不整合を確認し、模範解答を調整してください。',
  error: 'タブ区切りの形式や正しい命令で構成されているかチェックしてください。',
};

const formatTimestamp = () => {
  return new Intl.DateTimeFormat('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date());
};

const toRoman = (num) => {
  if (num <= 0) return '';
  const romanMap = [
    { value: 1000, symbol: 'M' },
    { value: 900, symbol: 'CM' },
    { value: 500, symbol: 'D' },
    { value: 400, symbol: 'CD' },
    { value: 100, symbol: 'C' },
    { value: 90, symbol: 'XC' },
    { value: 50, symbol: 'L' },
    { value: 40, symbol: 'XL' },
    { value: 10, symbol: 'X' },
    { value: 9, symbol: 'IX' },
    { value: 5, symbol: 'V' },
    { value: 4, symbol: 'IV' },
    { value: 1, symbol: 'I' },
  ];

  let remaining = num;
  let result = '';

  for (const { value, symbol } of romanMap) {
    while (remaining >= value) {
      result += symbol;
      remaining -= value;
    }
  }

  return result;
};

const sanitize = (value) => value.replace(/\t/g, '\t');

const splitLines = (value) => {
  return value
    .split(/[\r\n]+/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);
};

const parseMap = (mapText) => {
  const rowsRaw = splitLines(mapText);
  if (!rowsRaw.length) {
    throw new Error('マップが空です。');
  }

  const rows = rowsRaw.map((row) => row.split('\t'));
  const columnCount = Math.max(...rows.map((row) => row.length));

  const grid = [];
  const portalGroups = new Map();
  let startPosition = null;
  const gemPositions = new Set();
  const switchPositions = new Map();

  rows.forEach((rowValues, rowIndex) => {
    const gridRow = [];
    for (let colIndex = 0; colIndex < columnCount; colIndex += 1) {
      const token = rowValues[colIndex] ?? '';
      const cell = {
        token,
        row: rowIndex,
        col: colIndex,
        type: 'floor',
        isStart: false,
        direction: null,
        hasGem: false,
        switchState: 'none',
        warpId: null,
      };

      if (!token || token === '') {
        cell.type = 'floor';
      } else if (token === legend.stop) {
        cell.type = 'wall';
      } else if (legend.arrows.includes(token)) {
        cell.isStart = true;
        cell.direction = startArrowToDirection[token];
        startPosition = { ...cell };
      } else if (token === legend.gem) {
        cell.hasGem = true;
        gemPositions.add(`${rowIndex},${colIndex}`);
      } else if (token === legend.switchOpen) {
        cell.switchState = 'open';
        switchPositions.set(`${rowIndex},${colIndex}`, 'open');
      } else if (token === legend.switchClosed) {
        cell.switchState = 'closed';
        switchPositions.set(`${rowIndex},${colIndex}`, 'closed');
      } else if (/^W\d+$/.test(token)) {
        const warpNumber = Number.parseInt(token.substring(1), 10);
        cell.warpId = warpNumber;
        const group = portalGroups.get(warpNumber) ?? [];
        group.push({ row: rowIndex, col: colIndex });
        portalGroups.set(warpNumber, group);
      } else {
        cell.type = 'floor';
      }

      gridRow.push(cell);
    }
    grid.push(gridRow);
  });

  if (!startPosition) {
    throw new Error('初期配置（↑↓←→のいずれか）がマップ内に必要です。');
  }

  portalGroups.forEach((positions, warpId) => {
    if (positions.length !== 2) {
      throw new Error(`ワープポータル W${warpId} は 2 箇所で指定してください（現在: ${positions.length} 箇所）。`);
    }
  });

  return {
    grid,
    rows: rows.length,
    columns: columnCount,
    start: startPosition,
    gems: gemPositions,
    switches: switchPositions,
    portals: portalGroups,
  };
};

const mapCommandLine = (line) => line.replace(/\s+/g, '');

const parseCommands = (solutionText) => {
  const lines = splitLines(solutionText);
  if (!lines.length) {
    throw new Error('模範解答が空です。');
  }

  const commands = [];

  const normalizeCommand = (instruction) => {
    const signature = instruction.replace(/\s+/g, '');
    const base = signature.replace(/\(.*\)/, '');
    if (!Object.values(Command).includes(base)) {
      throw new Error(`未知の命令です: ${instruction}`);
    }
    return base;
  };

  const parseLoopBlock = (count, blockLines) => {
    const iterations = Number.parseInt(count, 10);
    if (!Number.isInteger(iterations) || iterations <= 0) {
      throw new Error(`for ループの回数を正しく指定してください（現在: ${count}）。`);
    }

    const innerCommands = blockLines.map((line) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) {
        return null;
      }
      if (trimmedLine.startsWith('for ')) {
        throw new Error('for ループの入れ子は現在サポートされていません。');
      }
      const type = normalizeCommand(mapCommandLine(trimmedLine));
      return { type };
    }).filter(Boolean);

    for (let iteration = 0; iteration < iterations; iteration += 1) {
      innerCommands.forEach((command) => commands.push({ ...command }));
    }
  };

  let index = 0;
  while (index < lines.length) {
    const rawLine = lines[index];
    const trimmed = rawLine.trim();

    if (trimmed.startsWith('for ')) {
      const loopMatch = trimmed.match(/for\s+(\d+)\s+times\s*\{/i);
      if (!loopMatch) {
        throw new Error(`for ループの構文を解析できません: ${rawLine}`);
      }

      const [, count] = loopMatch;
      const blockLines = [];
      index += 1;
      let depth = 1;

      while (index < lines.length && depth > 0) {
        const line = lines[index].trim();
        if (line === '}') {
          depth -= 1;
          if (depth === 0) {
            index += 1;
            break;
          }
        } else {
          blockLines.push(lines[index]);
          index += 1;
        }
      }

      if (depth !== 0) {
        throw new Error('for ループに対応する閉じカッコが見つかりません。');
      }

      parseLoopBlock(count, blockLines);
      continue;
    }

    const instruction = mapCommandLine(trimmed);
    const type = normalizeCommand(instruction);
    commands.push({ type });
    index += 1;
  }

  return commands;
};

const getCell = (grid, row, col) => {
  if (row < 0 || row >= grid.length) return null;
  const rowCells = grid[row];
  if (!rowCells) return null;
  if (col < 0 || col >= rowCells.length) return null;
  return rowCells[col];
};

const resolveWarp = (portals, warpId, current) => {
  const positions = portals.get(warpId);
  if (!positions) return null;
  return positions.find((pos) => pos.row !== current.row || pos.col !== current.col) ?? null;
};

const rotateDirection = (current, turn) => {
  const currentIndex = rotations.indexOf(current);
  if (currentIndex === -1) return current;
  const delta = turn === 'left' ? -1 : 1;
  const nextIndex = (currentIndex + delta + rotations.length) % rotations.length;
  return rotations[nextIndex];
};

const simulateCommands = (mapData, commands) => {
  const logEntries = [];
  const errors = [];
  const visitedPath = new Set();
  let gemsCollected = 0;
  const remainingGems = new Set(mapData.gems);
  const switchesState = new Map(mapData.switches);

  let currentRow = mapData.start.row;
  let currentCol = mapData.start.col;
  let facing = mapData.start.direction;
  let halted = false;

  const recordLog = (message, kind = 'info') => {
    logEntries.push({ message, kind, position: { row: currentRow, col: currentCol }, facing });
  };

  const recordError = (message) => {
    errors.push(message);
    recordLog(message, 'error');
  };

  recordLog(`スタート位置 (${currentRow + 1}, ${currentCol + 1}) から ${facing} 向きで開始します。`, 'success');

  commands.forEach((command, index) => {
    if (halted) {
      return;
    }

    const humanIndex = index + 1;
    const cellKey = `${currentRow},${currentCol}`;
    visitedPath.add(cellKey);

    if (command.type === Command.MOVE_FORWARD) {
      const vector = directionVectors[facing];
      const targetRow = currentRow + vector.row;
      const targetCol = currentCol + vector.col;
      const targetCell = getCell(mapData.grid, targetRow, targetCol);

      if (!targetCell) {
        recordError(`コマンド ${humanIndex}: マップの外に移動しようとしました。`);
        halted = true;
        return;
      }

      if (targetCell.type === 'wall') {
        recordError(`コマンド ${humanIndex}: 通行不可のマス(止) に衝突しました。`);
        halted = true;
        return;
      }

      currentRow = targetRow;
      currentCol = targetCol;
      recordLog(`コマンド ${humanIndex}: (${currentRow + 1}, ${currentCol + 1}) に移動しました。`);

      if (targetCell.warpId) {
        const destination = resolveWarp(mapData.portals, targetCell.warpId, targetCell);
        if (!destination) {
          recordError(`コマンド ${humanIndex}: ワープ W${targetCell.warpId} の遷移先が見つかりません。`);
          halted = true;
          return;
        }
        currentRow = destination.row;
        currentCol = destination.col;
        recordLog(`ワープ W${targetCell.warpId} を通過し、(${currentRow + 1}, ${currentCol + 1}) に移動しました。`, 'success');
      }
    } else if (command.type === Command.TURN_LEFT || command.type === Command.TURN_RIGHT) {
      const turnDirection = command.type === Command.TURN_LEFT ? 'left' : 'right';
      facing = rotateDirection(facing, turnDirection);
      recordLog(`コマンド ${humanIndex}: ${turnDirection === 'left' ? '左' : '右'}へ回転し、向きは ${facing} になりました。`);
    } else if (command.type === Command.COLLECT_GEM) {
      const gemKey = `${currentRow},${currentCol}`;
      if (!remainingGems.has(gemKey)) {
        recordError(`コマンド ${humanIndex}: 床にジェムが存在しません。`);
        halted = true;
        return;
      }
      remainingGems.delete(gemKey);
      gemsCollected += 1;
      recordLog(`コマンド ${humanIndex}: ジェムを回収しました (合計 ${gemsCollected})。`, 'success');
    } else if (command.type === Command.TOGGLE_SWITCH) {
      const switchKey = `${currentRow},${currentCol}`;
      if (!switchesState.has(switchKey)) {
        recordError(`コマンド ${humanIndex}: スイッチが存在しません。`);
        halted = true;
        return;
      }
      const currentState = switchesState.get(switchKey);
      const nextState = currentState === 'open' ? 'closed' : 'open';
      switchesState.set(switchKey, nextState);
      recordLog(`コマンド ${humanIndex}: スイッチを ${nextState === 'open' ? '開けました' : '閉じました'}。`, 'info');
    }
  });

  const unresolvedSwitches = Array.from(switchesState.values()).filter((state) => state !== 'open').length;
  const openSwitches = switchesState.size - unresolvedSwitches;

  if (remainingGems.size > 0) {
    errors.push(`未回収のジェムが ${remainingGems.size} 個あります。`);
  }

  if (unresolvedSwitches > 0) {
    errors.push(`開状態になっていないスイッチが ${unresolvedSwitches} 個あります。`);
  }

  return {
    logs: logEntries,
    errors,
    visitedPath,
    gemsCollected,
    totalGems: mapData.gems.size,
    switchesOpen: openSwitches,
    totalSwitches: mapData.switches.size,
  };
};

const renderMapPreview = (mapData, visitedPath = new Set()) => {
  if (!mapCanvas) return;
  mapCanvas.textContent = '';
  mapCanvas.style.setProperty('--cols', String(mapData.columns));

  mapData.grid.forEach((row) => {
    row.forEach((cell) => {
      const cellElement = document.createElement('div');
      cellElement.classList.add('map-cell');
      cellElement.dataset.type = cell.type;

      if (cell.isStart) {
        cellElement.dataset.start = 'true';
        cellElement.dataset.direction = cell.direction;
        cellElement.textContent = cell.token;
      } else if (cell.hasGem) {
        cellElement.dataset.gem = 'true';
      } else if (cell.switchState === 'open') {
        cellElement.dataset.switch = 'open';
      } else if (cell.switchState === 'closed') {
        cellElement.dataset.switch = 'closed';
      } else if (cell.warpId) {
        cellElement.dataset.warp = `W${cell.warpId}`;
      } else if (cell.token && cell.token.trim()) {
        cellElement.textContent = sanitize(cell.token);
      }

      const key = `${cell.row},${cell.col}`;
      if (visitedPath.has(key)) {
        cellElement.dataset.path = 'true';
      }

      mapCanvas.appendChild(cellElement);
    });
  });
};

const updateStatusCard = (status, details = []) => {
  statusCard.dataset.status = status;
  statusPill.textContent = statusLabels[status];
  statusMessage.textContent = summaryMessages[status];
  statusDetails.textContent = detailMessages[status];
  statusTimestamp.textContent = formatTimestamp();

  issueList.textContent = '';

  if (details.length === 0) {
    issueList.hidden = true;
    return;
  }

  issueList.hidden = false;
  details.forEach((detail, index) => {
    const item = document.createElement('li');
    item.textContent = `${toRoman(index + 1)}. ${detail}`;
    issueList.appendChild(item);
  });
};

const updateMetrics = ({ steps, gemsCollected, totalGems, switchesOpen, totalSwitches, errors }) => {
  metricSteps.textContent = String(steps);
  metricGems.textContent = `${gemsCollected} / ${totalGems}`;
  metricSwitches.textContent = `${switchesOpen} / ${totalSwitches}`;
  metricErrors.textContent = String(errors);
};

const appendLogEntry = ({ message, kind, position, facing }) => {
  const item = document.createElement('li');
  item.classList.add('log-entry');
  item.dataset.kind = kind;

  const heading = document.createElement('strong');
  heading.textContent = `${kind === 'error' ? '⚠' : kind === 'success' ? '✅' : '•'} ${kind.toUpperCase()}`;
  const body = document.createElement('span');
  const coordText = position ? `位置 (${position.row + 1}, ${position.col + 1})` : '';
  const facingText = facing ? `／向き ${facing}` : '';

  body.textContent = `${message}${coordText || facingText ? ` (${[coordText, facingText].filter(Boolean).join(' ')})` : ''}`;

  item.append(heading, body);
  logList.appendChild(item);
};

const resetLog = () => {
  logList.textContent = '';
};

const setMapCounts = (mapData) => {
  mapSizeChip.textContent = `${mapData.rows} × ${mapData.columns}`;
};

const setCommandCount = (commands) => {
  commandCountChip.textContent = `${commands.length} コマンド`;
};

const runValidation = () => {
  try {
    resetLog();

    const mapData = parseMap(mapInput.value);
    setMapCounts(mapData);
    renderMapPreview(mapData);

    const commands = parseCommands(solutionInput.value);
    setCommandCount(commands);

    const simulation = simulateCommands(mapData, commands);

    simulation.logs.forEach((entry) => appendLogEntry(entry));

    const hasErrors = simulation.errors.length > 0;
    const status = hasErrors ? 'failure' : 'success';
    updateStatusCard(status, simulation.errors);
    updateMetrics({
      steps: commands.length,
      gemsCollected: simulation.gemsCollected,
      totalGems: simulation.totalGems,
      switchesOpen: simulation.switchesOpen,
      totalSwitches: simulation.totalSwitches,
      errors: simulation.errors.length,
    });
    renderMapPreview(mapData, simulation.visitedPath);

    previewNote.textContent = hasErrors
      ? '訪問した経路を確認し、ログで問題のステップを参照してください。'
      : '訪問経路がハイライトされました。';
  } catch (error) {
    updateStatusCard('error', [error.message]);
    updateMetrics({ steps: 0, gemsCollected: 0, totalGems: 0, switchesOpen: 0, totalSwitches: 0, errors: 1 });
  }
};

const handleDownloadReport = () => {
  const report = {
    map: mapInput.value,
    solution: solutionInput.value,
    status: statusCard.dataset.status,
    timestamp: new Date().toISOString(),
    logs: Array.from(logList.children).map((item) => item.textContent),
  };

  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `swift-playground-report-${Date.now()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
};

const loadSample = () => {
  mapInput.value = SAMPLE_MAP;
  solutionInput.value = SAMPLE_SOLUTION;
  previewNote.textContent = 'サンプルマップを読み込みました。検証を実行して結果を確認してください。';
  runValidation();
};

const clearInputs = () => {
  mapInput.value = '';
  solutionInput.value = '';
  mapCanvas.textContent = '';
  mapCanvas.style.removeProperty('--cols');
  mapSizeChip.textContent = '0 × 0';
  commandCountChip.textContent = '0 コマンド';
  resetLog();
  updateStatusCard('idle');
  updateMetrics({ steps: 0, gemsCollected: 0, totalGems: 0, switchesOpen: 0, totalSwitches: 0, errors: 0 });
  previewNote.textContent = 'マップを編集するとリアルタイムで更新されます。';
};

const updateMapPreviewDebounced = (() => {
  let timer = null;
  return () => {
    if (timer) {
      window.clearTimeout(timer);
    }
    timer = window.setTimeout(() => {
      try {
        const mapData = parseMap(mapInput.value);
        setMapCounts(mapData);
        renderMapPreview(mapData);
      } catch {
        mapSizeChip.textContent = '— × —';
        mapCanvas.textContent = '';
      }
    }, 250);
  };
})();

const updateCommandCountDebounced = (() => {
  let timer = null;
  return () => {
    if (timer) {
      window.clearTimeout(timer);
    }
    timer = window.setTimeout(() => {
      try {
        const commands = parseCommands(solutionInput.value);
        setCommandCount(commands);
      } catch {
        commandCountChip.textContent = '— コマンド';
      }
    }, 250);
  };
})();

const toggleLogExpansion = (expand) => {
  logList.style.maxHeight = expand ? '520px' : '320px';
};

const init = () => {
  if (
    !mapInput ||
    !solutionInput ||
    !mapCanvas ||
    !mapSizeChip ||
    !commandCountChip ||
    !statusCard ||
    !statusPill ||
    !statusMessage ||
    !statusDetails
  ) {
    console.error('必要な DOM 要素が見つかりません。HTML を確認してください。');
    return;
  }

  updateStatusCard('idle');
  updateMetrics({ steps: 0, gemsCollected: 0, totalGems: 0, switchesOpen: 0, totalSwitches: 0, errors: 0 });

  mapInput.addEventListener('input', updateMapPreviewDebounced);
  solutionInput.addEventListener('input', updateCommandCountDebounced);

  const form = document.querySelector('#validatorForm');
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    runValidation();
  });

  loadSampleButton?.addEventListener('click', loadSample);
  clearInputsButton?.addEventListener('click', clearInputs);
  downloadReportButton?.addEventListener('click', handleDownloadReport);
  expandLogButton?.addEventListener('click', () => toggleLogExpansion(true));
  collapseLogButton?.addEventListener('click', () => toggleLogExpansion(false));

  // 初期レンダリング
  if (mapInput.value.trim().length > 0) {
    try {
      const mapData = parseMap(mapInput.value);
      renderMapPreview(mapData);
      setMapCounts(mapData);
    } catch {
      // ignore
    }
  }

  if (solutionInput.value.trim().length > 0) {
    try {
      const commands = parseCommands(solutionInput.value);
      setCommandCount(commands);
    } catch {
      // ignore
    }
  }
};

document.addEventListener('DOMContentLoaded', init);
