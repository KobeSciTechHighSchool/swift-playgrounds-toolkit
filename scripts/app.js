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

const StatementKind = {
  COMMAND: 'command',
  LOOP: 'loop',
  CALL: 'call',
  CONDITIONAL: 'conditional',
};

const ExpressionKind = {
  IDENTIFIER: 'identifier',
  LITERAL: 'literal',
  NOT: 'not',
  AND: 'and',
  OR: 'or',
};

const BOOLEAN_SENSORS = new Set([
  'isOnGem',
  'isOnClosedSwitch',
  'isOnOpenSwitch',
  'isOnSwitch',
  'isOnPortal',
  'isBlocked',
  'isBlockedFront',
  'isBlockedAhead',
  'isBlockedLeft',
  'isBlockedRight',
  'isBlockedBack',
  'isFacingNorth',
  'isFacingSouth',
  'isFacingEast',
  'isFacingWest',
]);

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
  success: '解答はマップ上で正常に実行されました。',
  failure: '解答に問題があります。詳細を確認してください。',
  error: '解析時にエラーが発生しました。入力内容をご確認ください。',
};

const detailMessages = {
  idle: 'サンプルデータを読み込むと動作イメージを確認できます。',
  success: 'ジェムとスイッチはすべて期待通りです。ログから実行内容を確認できます。',
  failure: '不足しているアクションやマップ上の不整合を確認し、解答を調整してください。',
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

const preprocessSolutionTokens = (solutionText) => {
  const withoutBlockComments = solutionText.replace(/\/\*[\s\S]*?\*\//g, '');

  const cleanedLines = withoutBlockComments
    .split(/\r?\n/)
    .map((line) => line.replace(/\ufeff/g, ''))
    .map((line) => {
      const trimmedStart = line.trimStart();
      if (trimmedStart.startsWith('//')) {
        return '';
      }
      return line.replace(/\/\/.*$/u, '');
    });

  return cleanedLines
    .join('\n')
    .replace(/([{}])/g, '\n$1\n')
    .split(/[\r\n]+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
};

const parseCommands = (solutionText) => {
  const tokens = preprocessSolutionTokens(solutionText);
  if (!tokens.length) {
    throw new Error('解答が空です。');
  }

  const functions = new Map();
  let hasConditionals = false;

  const tokenizeCondition = (expression) => {
    const items = [];
    const pattern = /\s*(&&|\|\||!|\(|\)|[A-Za-z_][A-Za-z0-9_]*)\s*/gy;
    let index = 0;

    while (index < expression.length) {
      pattern.lastIndex = index;
      const match = pattern.exec(expression);
      if (!match || match.index !== index) {
        throw new Error(`条件式を解析できません: ${expression}`);
      }
      items.push(match[1]);
      index = pattern.lastIndex;
    }

    return items;
  };

  const parseConditionExpression = (rawExpression) => {
    const expression = rawExpression.trim();
    if (!expression) {
      throw new Error('if 文の条件が空です。');
    }

    const conditionTokens = tokenizeCondition(expression);
    let position = 0;

    const parsePrimary = () => {
      const token = conditionTokens[position];
      if (!token) {
        throw new Error(`条件式を解析できません: ${expression}`);
      }

      if (token === '(') {
        position += 1;
        const inner = parseOr();
        if (conditionTokens[position] !== ')') {
          throw new Error('括弧の対応が取れていません。');
        }
        position += 1;
        return inner;
      }

      if (token === 'true' || token === 'false') {
        position += 1;
        return { type: ExpressionKind.LITERAL, value: token === 'true' };
      }

      if (/^[A-Za-z_][A-Za-z0-9_]*$/u.test(token)) {
        if (!BOOLEAN_SENSORS.has(token) && token !== 'true' && token !== 'false') {
          throw new Error(`未知の条件式です: ${token}`);
        }
        position += 1;
        return { type: ExpressionKind.IDENTIFIER, name: token };
      }

      throw new Error(`条件式を解析できません: ${expression}`);
    };

    const parseNot = () => {
      if (conditionTokens[position] === '!') {
        position += 1;
        return { type: ExpressionKind.NOT, expression: parseNot() };
      }
      return parsePrimary();
    };

    const parseAnd = () => {
      let node = parseNot();
      while (conditionTokens[position] === '&&') {
        position += 1;
        node = { type: ExpressionKind.AND, left: node, right: parseNot() };
      }
      return node;
    };

    const parseOr = () => {
      let node = parseAnd();
      while (conditionTokens[position] === '||') {
        position += 1;
        node = { type: ExpressionKind.OR, left: node, right: parseAnd() };
      }
      return node;
    };

    const result = parseOr();
    if (position < conditionTokens.length) {
      throw new Error(`条件式の解析で未処理のトークンがあります: ${conditionTokens.slice(position).join(' ')}`);
    }
    return result;
  };

  const parseBlock = (startIndex) => {
    if (tokens[startIndex] !== '{') {
      throw new Error('開きカッコ { が必要です。');
    }

    const statements = [];
    let index = startIndex + 1;

    while (index < tokens.length && tokens[index] !== '}') {
      const nestedToken = tokens[index];
      if (/^func\s+/u.test(nestedToken)) {
        throw new Error('関数を他の関数やループの内部で定義することはできません。');
      }

      const { statement, nextIndex } = parseExecutableStatement(index);
      statements.push(statement);
      index = nextIndex;
    }

    if (index >= tokens.length || tokens[index] !== '}') {
      throw new Error('ブロックに対応する閉じカッコ } が見つかりません。');
    }

    return { statements, nextIndex: index + 1 };
  };

  const parseConditional = (currentIndex) => {
    hasConditionals = true;

    const branches = [];
    let index = currentIndex;
    let hasElse = false;

    const firstToken = tokens[index];
    if (!/^if\s+/u.test(firstToken)) {
      throw new Error(`if 文の解析に失敗しました: ${firstToken}`);
    }

    const conditionText = firstToken.replace(/^if\s+/u, '').trim();
    const condition = parseConditionExpression(conditionText);
    const firstBlock = parseBlock(index + 1);
    branches.push({ condition, statements: firstBlock.statements });
    index = firstBlock.nextIndex;

    while (index < tokens.length) {
      const token = tokens[index];
      if (/^else\s+if\s+/u.test(token)) {
        if (hasElse) {
          throw new Error('else の後に else if は使用できません。');
        }
        const elseIfCondition = token.replace(/^else\s+if\s+/u, '').trim();
        const parsedCondition = parseConditionExpression(elseIfCondition);
        const branchBlock = parseBlock(index + 1);
        branches.push({ condition: parsedCondition, statements: branchBlock.statements });
        index = branchBlock.nextIndex;
        continue;
      }

      if (token === 'else') {
        if (hasElse) {
          throw new Error('else は 1 回だけ使用できます。');
        }
        const elseBlock = parseBlock(index + 1);
        branches.push({ condition: null, statements: elseBlock.statements });
        index = elseBlock.nextIndex;
        hasElse = true;
        continue;
      }

      break;
    }

    return {
      statement: { kind: StatementKind.CONDITIONAL, branches },
      nextIndex: index,
    };
  };

  const parseExecutableStatement = (currentIndex) => {
    const token = tokens[currentIndex];
    if (!token) {
      throw new Error('命令の解析中に入力が終了しました。');
    }

    if (/^for\s+/i.test(token)) {
      const loopMatch = token.match(/^for\s+(\d+)\s+times$/i);
      if (!loopMatch) {
        throw new Error(`for ループの構文を解析できません: ${token}`);
      }

      const iterations = Number.parseInt(loopMatch[1], 10);
      if (!Number.isInteger(iterations) || iterations <= 0) {
        throw new Error(`for ループの回数を正しく指定してください（現在: ${loopMatch[1]}）。`);
      }

      const { statements, nextIndex } = parseBlock(currentIndex + 1);
      return {
        statement: { kind: StatementKind.LOOP, count: iterations, body: statements },
        nextIndex,
      };
    }

    if (/^if\s+/u.test(token)) {
      return parseConditional(currentIndex);
    }

    if (/^else\b/u.test(token)) {
      throw new Error('else は単独で使用できません。');
    }

    const normalized = token.replace(/\s+/g, '');

    if (/^\w+\(\)$/u.test(normalized)) {
      const base = normalized.replace(/\(.*\)$/u, '');
      if (Object.values(Command).includes(base)) {
        return {
          statement: { kind: StatementKind.COMMAND, type: base },
          nextIndex: currentIndex + 1,
        };
      }

      return {
        statement: { kind: StatementKind.CALL, name: base },
        nextIndex: currentIndex + 1,
      };
    }

    throw new Error(`未知の命令です: ${token}`);
  };

  const parseFunctionDefinition = (currentIndex) => {
    const token = tokens[currentIndex];
    const match = token.match(/^func\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(\s*\)$/u);
    if (!match) {
      throw new Error(`関数定義の構文を解析できません: ${token}`);
    }

    const name = match[1];
    if (Object.values(Command).includes(name)) {
      throw new Error(`命令と同じ名前の関数は定義できません: ${name}`);
    }

    if (functions.has(name)) {
      throw new Error(`関数 ${name} はすでに定義されています。`);
    }

    const { statements, nextIndex } = parseBlock(currentIndex + 1);
    functions.set(name, statements);
    return nextIndex;
  };

  const mainStatements = [];
  let cursor = 0;

  while (cursor < tokens.length) {
    const token = tokens[cursor];

    if (/^func\s+/u.test(token)) {
      cursor = parseFunctionDefinition(cursor);
      continue;
    }

    const { statement, nextIndex } = parseExecutableStatement(cursor);
    mainStatements.push(statement);
    cursor = nextIndex;
  }

  if (!mainStatements.length) {
    throw new Error('実行する命令が見つかりません。');
  }

  const estimateStatements = (statements, callStack = []) => {
    let total = 0;

    statements.forEach((statement) => {
      if (statement.kind === StatementKind.COMMAND) {
        total += 1;
        return;
      }

      if (statement.kind === StatementKind.LOOP) {
        total += statement.count * estimateStatements(statement.body, callStack);
        return;
      }

      if (statement.kind === StatementKind.CALL) {
        if (!functions.has(statement.name)) {
          throw new Error(`未定義の関数を呼び出しています: ${statement.name}()`);
        }

        if (callStack.includes(statement.name)) {
          throw new Error(`再帰的な関数呼び出しはサポートされていません: ${statement.name}()`);
        }

        const nextStack = [...callStack, statement.name];
        total += estimateStatements(functions.get(statement.name), nextStack);
        return;
      }

      if (statement.kind === StatementKind.CONDITIONAL) {
        if (!statement.branches.length) {
          return;
        }
        const branchCounts = statement.branches.map((branch) => estimateStatements(branch.statements, callStack));
        total += Math.max(...branchCounts);
      }
    });

    return total;
  };

  const estimatedCommands = estimateStatements(mainStatements);

  return {
    main: mainStatements,
    functions,
    estimatedCommands,
    hasConditionals,
  };
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

const simulateProgram = (mapData, program) => {
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
  let stepsExecuted = 0;

  const recordLog = (message, kind = 'info') => {
    logEntries.push({ message, kind, position: { row: currentRow, col: currentCol }, facing });
  };

  const recordError = (message) => {
    errors.push(message);
    recordLog(message, 'error');
  };

  recordLog(`スタート位置 (${currentRow + 1}, ${currentCol + 1}) から ${facing} 向きで開始します。`, 'success');

  const isDirectionBlocked = (direction) => {
    const vector = directionVectors[direction];
    if (!vector) {
      return true;
    }
    const targetRow = currentRow + vector.row;
    const targetCol = currentCol + vector.col;
    const targetCell = getCell(mapData.grid, targetRow, targetCol);
    if (!targetCell) {
      return true;
    }
    return targetCell.type === 'wall';
  };

  const evaluateSensor = (name) => {
    const cellKey = `${currentRow},${currentCol}`;
    const currentCell = getCell(mapData.grid, currentRow, currentCol);

    switch (name) {
      case 'isOnGem':
        return remainingGems.has(cellKey);
      case 'isOnClosedSwitch':
        return switchesState.get(cellKey) === 'closed';
      case 'isOnOpenSwitch':
        return switchesState.get(cellKey) === 'open';
      case 'isOnSwitch':
        return switchesState.has(cellKey);
      case 'isOnPortal':
        return Boolean(currentCell?.warpId);
      case 'isBlocked':
      case 'isBlockedFront':
      case 'isBlockedAhead':
        return isDirectionBlocked(facing);
      case 'isBlockedLeft':
        return isDirectionBlocked(rotateDirection(facing, 'left'));
      case 'isBlockedRight':
        return isDirectionBlocked(rotateDirection(facing, 'right'));
      case 'isBlockedBack': {
        const back = rotateDirection(rotateDirection(facing, 'left'), 'left');
        return isDirectionBlocked(back);
      }
      case 'isFacingNorth':
        return facing === 'up';
      case 'isFacingSouth':
        return facing === 'down';
      case 'isFacingEast':
        return facing === 'right';
      case 'isFacingWest':
        return facing === 'left';
      default:
        throw new Error(`未知の条件式です: ${name}`);
    }
  };

  const evaluateExpression = (expression) => {
    if (expression.type === ExpressionKind.LITERAL) {
      return expression.value;
    }
    if (expression.type === ExpressionKind.IDENTIFIER) {
      return evaluateSensor(expression.name);
    }
    if (expression.type === ExpressionKind.NOT) {
      return !evaluateExpression(expression.expression);
    }
    if (expression.type === ExpressionKind.AND) {
      if (!evaluateExpression(expression.left)) {
        return false;
      }
      return evaluateExpression(expression.right);
    }
    if (expression.type === ExpressionKind.OR) {
      if (evaluateExpression(expression.left)) {
        return true;
      }
      return evaluateExpression(expression.right);
    }

    throw new Error('未知の条件式を評価しようとしました。');
  };

  const executeCommand = (commandType) => {
    if (halted) {
      return;
    }

    const humanIndex = stepsExecuted + 1;
    stepsExecuted += 1;

    const cellKey = `${currentRow},${currentCol}`;
    visitedPath.add(cellKey);

    if (commandType === Command.MOVE_FORWARD) {
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
      return;
    }

    if (commandType === Command.TURN_LEFT || commandType === Command.TURN_RIGHT) {
      const turnDirection = commandType === Command.TURN_LEFT ? 'left' : 'right';
      facing = rotateDirection(facing, turnDirection);
      recordLog(`コマンド ${humanIndex}: ${turnDirection === 'left' ? '左' : '右'}へ回転し、向きは ${facing} になりました。`);
      return;
    }

    if (commandType === Command.COLLECT_GEM) {
      const gemKey = `${currentRow},${currentCol}`;
      if (!remainingGems.has(gemKey)) {
        recordError(`コマンド ${humanIndex}: 床にジェムが存在しません。`);
        halted = true;
        return;
      }
      remainingGems.delete(gemKey);
      gemsCollected += 1;
      recordLog(`コマンド ${humanIndex}: ジェムを回収しました (合計 ${gemsCollected})。`, 'success');
      return;
    }

    if (commandType === Command.TOGGLE_SWITCH) {
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
  };

  const executeStatements = (statements, callStack = []) => {
    for (const statement of statements) {
      if (halted) {
        return;
      }

      if (statement.kind === StatementKind.COMMAND) {
        executeCommand(statement.type);
        continue;
      }

      if (statement.kind === StatementKind.LOOP) {
        for (let iteration = 0; iteration < statement.count; iteration += 1) {
          if (halted) {
            break;
          }
          executeStatements(statement.body, callStack);
        }
        continue;
      }

      if (statement.kind === StatementKind.CALL) {
        if (!program.functions.has(statement.name)) {
          recordError(`未定義の関数を呼び出しています: ${statement.name}()`);
          halted = true;
          return;
        }

        if (callStack.includes(statement.name)) {
          recordError(`再帰的な関数呼び出しはサポートされていません: ${statement.name}()`);
          halted = true;
          return;
        }

        const nextStack = [...callStack, statement.name];
        executeStatements(program.functions.get(statement.name), nextStack);
        continue;
      }

      if (statement.kind === StatementKind.CONDITIONAL) {
        for (const branch of statement.branches) {
          if (halted) {
            return;
          }
          const conditionResult = branch.condition === null ? true : evaluateExpression(branch.condition);
          if (conditionResult) {
            executeStatements(branch.statements, callStack);
            break;
          }
        }
      }
    }
  };

  executeStatements(program.main);

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
    steps: stepsExecuted,
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

const setCommandCount = (count, hasConditionals = false) => {
  if (typeof count === 'number' && Number.isFinite(count)) {
    if (hasConditionals) {
      commandCountChip.textContent = `約 ${count} コマンド (条件で変動)`;
      return;
    }
    commandCountChip.textContent = `${count} コマンド`;
    return;
  }

  commandCountChip.textContent = hasConditionals ? '条件付き — コマンド' : '— コマンド';
};

const runValidation = () => {
  try {
    resetLog();

    const mapData = parseMap(mapInput.value);
    setMapCounts(mapData);
    renderMapPreview(mapData);

  const program = parseCommands(solutionInput.value);
  setCommandCount(program.estimatedCommands, program.hasConditionals);

  const simulation = simulateProgram(mapData, program);

    simulation.logs.forEach((entry) => appendLogEntry(entry));

    const hasErrors = simulation.errors.length > 0;
    const status = hasErrors ? 'failure' : 'success';
    updateStatusCard(status, simulation.errors);
    updateMetrics({
  steps: simulation.steps,
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
        const program = parseCommands(solutionInput.value);
        setCommandCount(program.estimatedCommands, program.hasConditionals);
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
      const program = parseCommands(solutionInput.value);
      setCommandCount(program.estimatedCommands, program.hasConditionals);
    } catch {
      // ignore
    }
  }
};

document.addEventListener('DOMContentLoaded', init);
