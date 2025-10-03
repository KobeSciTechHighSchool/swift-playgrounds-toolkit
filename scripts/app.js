const mapInput = document.querySelector('#mapInput');
const solutionInput = document.querySelector('#solutionInput');
const mapSizeChip = document.querySelector('#mapSizeChip');
const commandCountChip = document.querySelector('#commandCountChip');
const mapCanvas = document.querySelector('#mapCanvas');
const mapSizeForm = document.querySelector('#mapSizeForm');
const mapRowsInput = document.querySelector('#mapRowsInput');
const mapColsInput = document.querySelector('#mapColsInput');
const mapSizeApplyButton = document.querySelector('#mapSizeApplyButton');
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
const downloadReportButton = document.querySelector('#downloadReportButton');
const expandLogButton = document.querySelector('#expandLogButton');
const collapseLogButton = document.querySelector('#collapseLogButton');
const loadSampleButton = document.querySelector('#loadSampleButton');
const clearInputsButton = document.querySelector('#clearInputsButton');
const previewNote = document.querySelector('#previewNote');
const stepperCard = document.querySelector('#stepperCard');
const stepCounterChip = document.querySelector('#stepCounterChip');
const stepStatusHeading = document.querySelector('#stepStatusHeading');
const stepStatusMessage = document.querySelector('#stepStatusMessage');
const stepDetailMessage = document.querySelector('#stepDetailMessage');
const stepIndexLabel = document.querySelector('#stepIndexLabel');
const stepPositionLabel = document.querySelector('#stepPositionLabel');
const stepFacingLabel = document.querySelector('#stepFacingLabel');
const stepStartButton = document.querySelector('#stepStartButton');
const stepPrevButton = document.querySelector('#stepPrevButton');
const stepNextButton = document.querySelector('#stepNextButton');
const stepAutoButton = document.querySelector('#stepAutoButton');
const codePanel = document.querySelector('#codePanel');
const codePanelHint = document.querySelector('#codePanelHint');
const codeLineList = document.querySelector('#codeLineList');
const codePanelToggleButton = document.querySelector('#codePanelToggleButton');
const codePanelEditor = document.querySelector('#codePanelEditor');
const mapTextEditorButton = document.querySelector('#mapTextEditorButton');
const mapTextModal = document.querySelector('#mapTextModal');
const mapTextModalCloseButton = document.querySelector('#mapTextModalCloseButton');
const legendToggleButton = document.querySelector('#legendToggleButton');
const legendPopover = document.querySelector('#legendPopover');
const legendCloseButton = document.querySelector('#legendCloseButton');
const statusHeaderButton = document.querySelector('#statusHeaderButton');

const legend = {
  stop: '止',
  gem: '♦',
  switchOpen: '〇',
  switchClosed: '●',
  arrows: ['↑', '↓', '←', '→'],
};

const directionEmojiGlyphs = {
  up: '⬆️',
  down: '⬇️',
  left: '⬅️',
  right: '➡️',
};

const mapCellIcons = {
  wall: '🧱',
  floor: '▫️',
  gem: '💎',
  switchOpen: '🟢',
  switchClosed: '🔴',
  warp: '🌀',
  start: directionEmojiGlyphs,
  actor: directionEmojiGlyphs,
  unknown: '❔',
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

const ConditionPredicate = {
  IS_ON_GEM: 'isOnGem',
  IS_ON_OPEN_SWITCH: 'isOnOpenSwitch',
  IS_ON_CLOSED_SWITCH: 'isOnClosedSwitch',
  IS_ON_SWITCH: 'isOnSwitch',
  IS_BLOCKED: 'isBlocked',
  IS_BLOCKED_LEFT: 'isBlockedLeft',
  IS_BLOCKED_RIGHT: 'isBlockedRight',
};

const CONDITION_PREDICATES = new Set(Object.values(ConditionPredicate));

const CONDITION_OPERATOR_PRECEDENCE = {
  '||': 1,
  '&&': 2,
};

const tokenizeBooleanCondition = (source) => {
  const tokens = [];
  let index = 0;
  const input = source.trim();

  while (index < input.length) {
    const remaining = input.slice(index);

    if (/^\s+/u.test(remaining)) {
      index += remaining.match(/^\s+/u)[0].length;
      continue;
    }

    if (remaining.startsWith('&&')) {
      tokens.push('&&');
      index += 2;
      continue;
    }

    if (remaining.startsWith('||')) {
      tokens.push('||');
      index += 2;
      continue;
    }

    if (remaining.startsWith('!')) {
      tokens.push('!');
      index += 1;
      continue;
    }

    const char = remaining[0];
    if (char === '(' || char === ')') {
      tokens.push(char);
      index += 1;
      continue;
    }

    const identifierMatch = remaining.match(/^[A-Za-z_][A-Za-z0-9_]*/u);
    if (identifierMatch) {
      const identifier = identifierMatch[0];
      if (/^not$/iu.test(identifier)) {
        tokens.push('!');
      } else {
        tokens.push(identifier);
      }
      index += identifier.length;
      continue;
    }

    throw new Error(`条件式で使用できない記号です: ${char}`);
  }

  if (!tokens.length) {
    throw new Error('条件式を指定してください。');
  }

  return tokens;
};

const parseBooleanCondition = (source) => {
  const tokens = tokenizeBooleanCondition(source);
  let position = 0;

  const peek = () => tokens[position] ?? null;
  const consume = (expected) => {
    const token = tokens[position];
    if (expected && token !== expected) {
      throw new Error(`条件式の構文が正しくありません。期待: ${expected}, 実際: ${token ?? '終端'}`);
    }
    if (!token) {
      throw new Error('条件式が途中で終了しました。');
    }
    position += 1;
    return token;
  };

  const parseExpression = () => parseOr();

  const parseOr = () => {
    let node = parseAnd();
    while (peek() === '||') {
      consume('||');
      const right = parseAnd();
      node = { type: 'logical', operator: '||', left: node, right };
    }
    return node;
  };

  const parseAnd = () => {
    let node = parseUnary();
    while (peek() === '&&') {
      consume('&&');
      const right = parseUnary();
      node = { type: 'logical', operator: '&&', left: node, right };
    }
    return node;
  };

  const parseUnary = () => {
    const token = peek();
    if (token === '!') {
      consume('!');
      return { type: 'not', operand: parseUnary() };
    }

    if (token === '(') {
      consume('(');
      const expression = parseExpression();
      if (peek() !== ')') {
        throw new Error('条件式の括弧が閉じられていません。');
      }
      consume(')');
      return expression;
    }

    if (!token) {
      throw new Error('条件式が途中で終了しました。');
    }

    consume(token);
    const normalized = token.trim();
    if (!CONDITION_PREDICATES.has(normalized)) {
      throw new Error(`サポートされていない条件式です: ${token}`);
    }
    return { type: 'predicate', name: normalized };
  };

  const ast = parseExpression();

  if (position !== tokens.length) {
    throw new Error(`条件式で想定外のトークンを検出しました: ${tokens[position]}`);
  }

  return ast;
};

const shouldWrapConditionChild = (parentOperator, childNode) => {
  if (!childNode || childNode.type !== 'logical') {
    return false;
  }
  return CONDITION_OPERATOR_PRECEDENCE[childNode.operator] < CONDITION_OPERATOR_PRECEDENCE[parentOperator];
};

const formatBooleanCondition = (node) => {
  if (!node) {
    return '';
  }

  if (node.type === 'predicate') {
    return node.name;
  }

  if (node.type === 'not') {
    const formatted = formatBooleanCondition(node.operand);
    if (node.operand && node.operand.type === 'logical') {
      return `!(${formatted})`;
    }
    return `!${formatted}`;
  }

  if (node.type === 'logical') {
    const left = formatBooleanCondition(node.left);
    const right = formatBooleanCondition(node.right);
    const leftFormatted = shouldWrapConditionChild(node.operator, node.left) ? `(${left})` : left;
    const rightFormatted = shouldWrapConditionChild(node.operator, node.right) ? `(${right})` : right;
    return `${leftFormatted} ${node.operator} ${rightFormatted}`;
  }

  throw new Error('未知の条件式ノードです。');
};

const evaluateBooleanCondition = (node, predicateEvaluator) => {
  if (!node) {
    return false;
  }

  if (node.type === 'predicate') {
    return predicateEvaluator(node.name);
  }

  if (node.type === 'not') {
    return !evaluateBooleanCondition(node.operand, predicateEvaluator);
  }

  if (node.type === 'logical') {
    if (node.operator === '&&') {
      return (
        evaluateBooleanCondition(node.left, predicateEvaluator) &&
        evaluateBooleanCondition(node.right, predicateEvaluator)
      );
    }
    return (
      evaluateBooleanCondition(node.left, predicateEvaluator) ||
      evaluateBooleanCondition(node.right, predicateEvaluator)
    );
  }

  throw new Error('未知の条件式ノードです。');
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

const directionToArrow = {
  up: mapCellIcons.actor.up,
  down: mapCellIcons.actor.down,
  left: mapCellIcons.actor.left,
  right: mapCellIcons.actor.right,
};

const directionLabels = {
  up: '上',
  down: '下',
  left: '左',
  right: '右',
};

const getCellDescription = (cell) => {
  if (cell.isStart) {
    return `スタート (${directionLabels[cell.direction] ?? '方向不明'})`;
  }
  if (cell.hasGem) {
    return 'ジェム';
  }
  if (cell.switchState === 'open') {
    return 'スイッチ（開）';
  }
  if (cell.switchState === 'closed') {
    return 'スイッチ（閉）';
  }
  if (cell.warpId) {
    return `ワープポータル W${cell.warpId}`;
  }
  if (cell.type === 'wall') {
    return '通行不可ブロック';
  }
  if (cell.token && cell.token.trim()) {
    return `カスタム記号: ${cell.token.trim()}`;
  }
  return '床';
};

const getCellIcon = (cell) => {
  if (cell.isStart) {
    return mapCellIcons.start[cell.direction] ?? mapCellIcons.unknown;
  }
  if (cell.hasGem) {
    return mapCellIcons.gem;
  }
  if (cell.switchState === 'open') {
    return mapCellIcons.switchOpen;
  }
  if (cell.switchState === 'closed') {
    return mapCellIcons.switchClosed;
  }
  if (cell.warpId) {
    return mapCellIcons.warp;
  }
  if (cell.type === 'wall') {
    return mapCellIcons.wall;
  }
  if (cell.type === 'floor') {
    return mapCellIcons.floor;
  }
  return mapCellIcons.unknown;
};

const statusLabels = {
  idle: '未検証',
  success: '成功',
  failure: '失敗',
  error: 'エラー',
};

const summaryMessages = {
  idle: 'マップとコードを入力すると自動的に検証されます。',
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

const DEFAULT_STEPPER_HINT = '検証が完了するとステップ実行が利用できます。';
const DEFAULT_STEPPER_DETAIL = 'ステップごとのメッセージがここに表示されます。';
// 自動検証の遅延 (ms)
const AUTO_VALIDATE_DELAY = 700;
const STEP_AUTO_INTERVAL = 700;
const DEFAULT_CODE_HINT = '入力した Swift コードがここに表示されます。';
const ACTIVE_CODE_HINT = 'ステップ実行で現在のコマンド行がハイライトされます。';
const EDITING_CODE_HINT = '編集モード: 変更は即座に反映されます。';

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

const codeViewerState = {
  lines: [],
  activeLine: null,
};

const codePanelState = {
  mode: 'view',
  lastViewerHint: DEFAULT_CODE_HINT,
  isSyncing: false,
};

const renderCodeViewer = (sourceText) => {
  if (!codeLineList) {
    return;
  }

  const normalized = sourceText.replace(/\r\n?/g, '\n');
  const lines = normalized.split('\n');

  codeViewerState.lines = lines;
  codeViewerState.activeLine = null;

  codeLineList.textContent = '';

  lines.forEach((line, index) => {
    const item = document.createElement('li');
    item.dataset.line = String(index + 1);

    const number = document.createElement('span');
    number.className = 'code-line-number';
    number.textContent = String(index + 1).padStart(2, ' ');

    const content = document.createElement('span');
    content.className = 'code-line-content';
    content.textContent = line.length ? line : '\u00A0';

    item.append(number, content);
    codeLineList.appendChild(item);
  });
};

const setCodePanelHint = (hint, options = {}) => {
  if (!codePanelHint) {
    return;
  }

  const { force = false, skipStore = false } = options;

  if (!force && codePanelState.mode === 'edit') {
    if (!skipStore) {
      codePanelState.lastViewerHint = hint;
    }
    return;
  }

  codePanelHint.textContent = hint;

  if (!skipStore) {
    codePanelState.lastViewerHint = hint;
  }
};

const setActiveCodeLine = (lineNumber) => {
  if (!codeLineList) {
    return;
  }

  if (codeViewerState.activeLine === lineNumber) {
    return;
  }

  if (codeViewerState.activeLine != null) {
    const previous = codeLineList.querySelector(`[data-line="${codeViewerState.activeLine}"]`);
    previous?.classList.remove('is-active');
  }

  if (lineNumber == null) {
    codeViewerState.activeLine = null;
    return;
  }

  const target = codeLineList.querySelector(`[data-line="${lineNumber}"]`);
  if (!target) {
    codeViewerState.activeLine = null;
    return;
  }

  target.classList.add('is-active');
  codeViewerState.activeLine = lineNumber;

  target.scrollIntoView({
    block: 'nearest',
    inline: 'nearest',
    behavior: 'smooth',
  });
};

const focusCodePanelEditor = () => {
  if (!codePanelEditor) {
    return;
  }
  window.requestAnimationFrame(() => {
    try {
      codePanelEditor.focus({ preventScroll: true });
    } catch {
      codePanelEditor.focus();
    }
    const length = codePanelEditor.value.length;
    if (typeof codePanelEditor.setSelectionRange === 'function') {
      codePanelEditor.setSelectionRange(length, length);
    }
  });
};

const enterCodePanelEditMode = () => {
  if (!codePanel || !codePanelToggleButton || !codePanelEditor || !codeLineList) {
    return;
  }
  if (codePanelState.mode === 'edit') {
    return;
  }

  codePanelState.lastViewerHint = codePanelHint?.textContent ?? codePanelState.lastViewerHint ?? DEFAULT_CODE_HINT;
  codePanelState.mode = 'edit';

  codePanel.classList.add('is-editing');
  codeLineList.hidden = true;
  codePanelEditor.hidden = false;
  codePanelEditor.value = solutionInput.value;

  codePanelToggleButton.textContent = '閲覧モードに戻る';
  codePanelToggleButton.setAttribute('aria-pressed', 'true');

  setCodePanelHint(EDITING_CODE_HINT, { force: true, skipStore: true });
  focusCodePanelEditor();
};

const exitCodePanelEditMode = ({ restoreFocus = false } = {}) => {
  if (!codePanel || !codePanelToggleButton || !codePanelEditor || !codeLineList) {
    return;
  }
  if (codePanelState.mode !== 'edit') {
    return;
  }

  codePanelState.mode = 'view';
  codePanel.classList.remove('is-editing');

  codeLineList.hidden = false;
  codePanelEditor.hidden = true;
  codePanelEditor.value = solutionInput.value;

  codePanelToggleButton.textContent = 'コードを編集';
  codePanelToggleButton.setAttribute('aria-pressed', 'false');

  setCodePanelHint(codePanelState.lastViewerHint ?? DEFAULT_CODE_HINT, { force: true });
  const previousActiveLine = codeViewerState.activeLine;
  renderCodeViewer(solutionInput.value);
  if (previousActiveLine != null) {
    setActiveCodeLine(previousActiveLine);
  }

  if (restoreFocus) {
    codePanelToggleButton.focus();
  }
};

const toggleCodePanelEditMode = () => {
  if (codePanelState.mode === 'edit') {
    exitCodePanelEditMode();
  } else {
    enterCodePanelEditMode();
  }
};

const splitLines = (value) => {
  return value
    .split(/[\r\n]+/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);
};

const parseMap = (mapText, options = {}) => {
  const {
    allowMissingStart = false,
    allowUnpairedPortals = false,
    allowEmpty = false,
  } = options;

  const rowsRaw = splitLines(mapText);
  if (!rowsRaw.length) {
    if (allowEmpty) {
      return {
        grid: [],
        rows: 0,
        columns: 0,
        start: null,
        gems: new Set(),
        switches: new Map(),
        portals: new Map(),
      };
    }
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

  if (!startPosition && !allowMissingStart) {
    throw new Error('初期配置（↑↓←→のいずれか）がマップ内に必要です。');
  }

  portalGroups.forEach((positions, warpId) => {
    if (!allowUnpairedPortals && positions.length !== 2) {
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

const isStartToken = (token) => legend.arrows.includes(token);

const mapEditorState = {
  tokens: [],
  rows: 0,
  cols: 0,
  cacheKey: '',
};

const mapTextModalState = {
  previousFocus: null,
  previousOverflow: '',
  isOpen: false,
};

const legendState = {
  isOpen: false,
};

const MAP_TEXT_MODAL_FOCUSABLE_SELECTOR =
  'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const getMapTextModalFocusable = () => {
  if (!mapTextModal) {
    return [];
  }
  const elements = Array.from(mapTextModal.querySelectorAll(MAP_TEXT_MODAL_FOCUSABLE_SELECTOR));
  return elements.filter((element) => {
    if (element.hasAttribute('hidden')) {
      return false;
    }
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden';
  });
};

const closeMapTextModal = ({ restoreFocus = false } = {}) => {
  if (!mapTextModalState.isOpen || !mapTextModal) {
    return;
  }

  mapTextModal.setAttribute('hidden', '');
  mapTextModal.removeAttribute('data-open');
  mapTextModal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = mapTextModalState.previousOverflow;
  mapTextModalState.isOpen = false;
  mapTextEditorButton?.setAttribute('aria-expanded', 'false');

  if (restoreFocus && mapTextModalState.previousFocus instanceof HTMLElement) {
    mapTextModalState.previousFocus.focus({ preventScroll: true });
  }

  mapTextModalState.previousFocus = null;
  mapTextModalState.previousOverflow = '';
};

const openLegend = () => {
  if (!legendPopover || !legendToggleButton || legendState.isOpen) return;
  legendPopover.removeAttribute('hidden');
  legendToggleButton.setAttribute('aria-expanded', 'true');
  legendState.isOpen = true;
};

const closeLegend = ({ restoreFocus = false } = {}) => {
  if (!legendPopover || !legendToggleButton || !legendState.isOpen) return;
  legendPopover.setAttribute('hidden', '');
  legendToggleButton.setAttribute('aria-expanded', 'false');
  legendState.isOpen = false;
  if (restoreFocus) {
    try { legendToggleButton.focus({ preventScroll: true }); } catch { legendToggleButton.focus(); }
  }
};

const toggleLegend = () => {
  if (!legendPopover || !legendToggleButton) return;
  legendState.isOpen ? closeLegend() : openLegend();
};

// Status popover (opened from the topbar status header)
const statusPopoverState = {
  isOpen: false,
};

const openStatusPopover = () => {
  if (!statusCard || !statusHeaderButton || statusPopoverState.isOpen) return;
  statusCard.removeAttribute('hidden');
  statusCard.setAttribute('data-open', 'true');
  statusCard.setAttribute('aria-hidden', 'false');
  statusHeaderButton.setAttribute('aria-expanded', 'true');
  statusPopoverState.isOpen = true;
};

const closeStatusPopover = ({ restoreFocus = false } = {}) => {
  if (!statusCard || !statusHeaderButton || !statusPopoverState.isOpen) return;
  statusCard.setAttribute('hidden', '');
  statusCard.removeAttribute('data-open');
  statusCard.setAttribute('aria-hidden', 'true');
  statusHeaderButton.setAttribute('aria-expanded', 'false');
  statusPopoverState.isOpen = false;
  if (restoreFocus) {
    try { statusHeaderButton.focus({ preventScroll: true }); } catch { statusHeaderButton.focus(); }
  }
};

const toggleStatusPopover = () => {
  if (!statusCard || !statusHeaderButton) return;
  statusPopoverState.isOpen ? closeStatusPopover() : openStatusPopover();
};

const focusFirstElementInMapModal = () => {
  if (!mapTextModalState.isOpen) {
    return;
  }
  const focusable = getMapTextModalFocusable();
  if (focusable.length === 0) {
    mapInput?.focus({ preventScroll: true });
    return;
  }

  const preferred = focusable.find((element) => element === mapInput);
  const target = preferred ?? focusable[0];
  window.requestAnimationFrame(() => {
    if (target instanceof HTMLTextAreaElement) {
      target.focus({ preventScroll: true });
      target.select();
      return;
    }
    target.focus({ preventScroll: true });
  });
};

const openMapTextModal = () => {
  if (!mapTextModal || mapTextModalState.isOpen) {
    return;
  }

  mapTextModalState.previousFocus = document.activeElement;
  mapTextModalState.previousOverflow = document.body.style.overflow;

  mapTextModal.removeAttribute('hidden');
  mapTextModal.setAttribute('data-open', 'true');
  mapTextModal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  mapTextModalState.isOpen = true;
  mapTextEditorButton?.setAttribute('aria-expanded', 'true');

  focusFirstElementInMapModal();
};

const handleMapTextModalKeydown = (event) => {
  if (!mapTextModalState.isOpen || !mapTextModal) {
    return;
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    closeMapTextModal({ restoreFocus: true });
    return;
  }

  if (event.key !== 'Tab') {
    return;
  }

  const focusable = getMapTextModalFocusable();
  if (focusable.length === 0) {
    event.preventDefault();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;

  if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus({ preventScroll: true });
    return;
  }

  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus({ preventScroll: true });
  }
};

const MAP_EXPANSION_FILL_TOKEN = legend.stop;
const MIN_MAP_DIMENSION = 1;

const updateMapSizeControls = (rows, cols) => {
  if (!mapRowsInput || !mapColsInput) {
    return;
  }
  const hasValidSize = rows >= MIN_MAP_DIMENSION && cols >= MIN_MAP_DIMENSION;
  mapRowsInput.value = hasValidSize ? String(rows) : '';
  mapColsInput.value = hasValidSize ? String(cols) : '';
};

const refreshMapEditorState = (mapData) => {
  if (!mapData || !Array.isArray(mapData.grid)) {
    mapEditorState.tokens = [];
    mapEditorState.rows = 0;
    mapEditorState.cols = 0;
    mapEditorState.cacheKey = '';
    return;
  }

  mapEditorState.rows = mapData.rows ?? mapData.grid.length ?? 0;
  mapEditorState.cols = mapData.columns ?? (mapData.grid[0]?.length ?? 0);
  mapEditorState.tokens = Array.from({ length: mapEditorState.rows }, (_, rowIndex) => {
    const row = mapData.grid[rowIndex] ?? [];
    return Array.from({ length: mapEditorState.cols }, (_, colIndex) => {
      const cell = row[colIndex];
      return cell?.token ?? '';
    });
  });
  mapEditorState.cacheKey = serializeMapEditorTokens();
  updateMapSizeControls(mapEditorState.rows, mapEditorState.cols);
};

const serializeMapEditorTokens = () => {
  if (!mapEditorState.rows || !mapEditorState.cols) {
    return '';
  }
  return mapEditorState.tokens
    .slice(0, mapEditorState.rows)
    .map((rowTokens) => rowTokens.slice(0, mapEditorState.cols).join('\t'))
    .join('\n');
};

const ensureMapEditorState = () => {
  const currentText = mapInput?.value ?? '';
  if (mapEditorState.tokens.length && currentText === mapEditorState.cacheKey) {
    return;
  }
  try {
    const mapData = parseMap(currentText, {
      allowMissingStart: true,
      allowUnpairedPortals: true,
      allowEmpty: true,
    });
    refreshMapEditorState(mapData);
  } catch {
    mapEditorState.tokens = [];
    mapEditorState.rows = 0;
    mapEditorState.cols = 0;
    mapEditorState.cacheKey = currentText;
  }
};

const updateMapInputFromEditor = () => {
  const updatedText = serializeMapEditorTokens();
  mapInput.value = updatedText;
  mapEditorState.cacheKey = updatedText;
  mapInput.dispatchEvent(new window.Event('input', { bubbles: true }));
};

const clearOtherStarts = (rowIndex, colIndex) => {
  mapEditorState.tokens.forEach((rowTokens, rIdx) => {
    rowTokens.forEach((token, cIdx) => {
      if (isStartToken(token) && (rIdx !== rowIndex || cIdx !== colIndex)) {
        mapEditorState.tokens[rIdx][cIdx] = '';
      }
    });
  });
};

const ensureAnyStartExists = (fallbackRow, fallbackCol) => {
  const hasStart = mapEditorState.tokens.some((rowTokens) => rowTokens.some((token) => isStartToken(token)));
  if (hasStart) {
    return;
  }
  if (fallbackRow != null && fallbackCol != null) {
    mapEditorState.tokens[fallbackRow][fallbackCol] = legend.arrows[0];
  }
};

const applyMapResize = (targetRows, targetCols) => {
  ensureMapEditorState();

  const previousRows = mapEditorState.rows >= MIN_MAP_DIMENSION ? mapEditorState.rows : 0;
  const previousCols = mapEditorState.cols >= MIN_MAP_DIMENSION ? mapEditorState.cols : 0;
  const rows = Math.max(MIN_MAP_DIMENSION, Math.floor(targetRows));
  const cols = Math.max(MIN_MAP_DIMENSION, Math.floor(targetCols));

  if (rows === previousRows && cols === previousCols) {
    if (previewNote) {
      previewNote.textContent = `マップサイズはすでに ${rows} × ${cols} です。`;
    }
    return;
  }

  const sourceTokens = Array.isArray(mapEditorState.tokens) ? mapEditorState.tokens : [];
  const resized = [];

  const preservedRowCount = Math.min(sourceTokens.length, rows);
  for (let rowIndex = 0; rowIndex < preservedRowCount; rowIndex += 1) {
    const rowTokens = Array.isArray(sourceTokens[rowIndex]) ? sourceTokens[rowIndex] : [];
    const nextRow = rowTokens.slice(0, cols);
    while (nextRow.length < cols) {
      nextRow.push(MAP_EXPANSION_FILL_TOKEN);
    }
    resized.push(nextRow);
  }

  for (let rowIndex = resized.length; rowIndex < rows; rowIndex += 1) {
    resized.push(Array.from({ length: cols }, () => MAP_EXPANSION_FILL_TOKEN));
  }

  mapEditorState.tokens = resized;
  mapEditorState.rows = rows;
  mapEditorState.cols = cols;
  if (mapSizeChip) {
    mapSizeChip.textContent = `${rows} × ${cols}`;
  }

  ensureAnyStartExists(0, 0);
  closeMapCellMenu();
  updateMapSizeControls(rows, cols);
  updateMapInputFromEditor();

  if (previewNote) {
    const changeSummary = [];
    if (rows > previousRows) {
      changeSummary.push('行を拡張');
    } else if (rows < previousRows) {
      changeSummary.push('行を縮小');
    }
    if (cols > previousCols) {
      changeSummary.push('列を拡張');
    } else if (cols < previousCols) {
      changeSummary.push('列を縮小');
    }

    const expanded = rows > previousRows || cols > previousCols;
    const shrunk = rows < previousRows || cols < previousCols;
    const suffix = expanded && shrunk
      ? '拡張部分は通行不可ブロックで埋め、範囲外のマスは無効化しました。'
      : expanded
        ? '拡張部分は通行不可ブロックで埋めています。'
        : '範囲外のマスは無効化しました。';
    const headline = changeSummary.length ? changeSummary.join('・') : 'サイズを調整';
    previewNote.textContent = `${headline}し、マップサイズを ${rows} × ${cols} に更新しました。${suffix}`;
  }
};

const handleMapSizeSubmit = (event) => {
  if (event) {
    event.preventDefault();
  }
  if (!mapRowsInput || !mapColsInput) {
    return;
  }

  ensureMapEditorState();

  const currentRows = mapEditorState.rows >= MIN_MAP_DIMENSION ? mapEditorState.rows : MIN_MAP_DIMENSION;
  const currentCols = mapEditorState.cols >= MIN_MAP_DIMENSION ? mapEditorState.cols : MIN_MAP_DIMENSION;

  const rawRows = mapRowsInput.value.trim();
  const rawCols = mapColsInput.value.trim();

  const parsedRows = rawRows.length ? Number.parseInt(rawRows, 10) : currentRows;
  const parsedCols = rawCols.length ? Number.parseInt(rawCols, 10) : currentCols;

  if (!Number.isInteger(parsedRows) || parsedRows < MIN_MAP_DIMENSION) {
    window.alert('行数は 1 以上の整数で指定してください。');
    updateMapSizeControls(mapEditorState.rows, mapEditorState.cols);
    return;
  }

  if (!Number.isInteger(parsedCols) || parsedCols < MIN_MAP_DIMENSION) {
    window.alert('列数は 1 以上の整数で指定してください。');
    updateMapSizeControls(mapEditorState.rows, mapEditorState.cols);
    return;
  }

  mapRowsInput.value = String(parsedRows);
  mapColsInput.value = String(parsedCols);

  applyMapResize(parsedRows, parsedCols);
};

const mapCellMenuState = {
  element: null,
  list: null,
  active: false,
  row: null,
  col: null,
};

const MAP_CELL_MENU_GROUPS = [
  {
    title: '基本タイル',
    items: [
      { token: '', label: '床', description: '通行可能な床マスです。', icon: mapCellIcons.floor },
      { token: legend.stop, label: '壁', description: '通行できないブロックです。', icon: mapCellIcons.wall },
      { token: legend.gem, label: 'ジェム', description: 'ジェムを配置します。', icon: mapCellIcons.gem },
      {
        token: legend.switchOpen,
        label: 'スイッチ（開）',
        description: '開いたスイッチを配置します。',
        icon: mapCellIcons.switchOpen,
      },
      {
        token: legend.switchClosed,
        label: 'スイッチ（閉）',
        description: '閉じたスイッチを配置します。',
        icon: mapCellIcons.switchClosed,
      },
    ],
  },
  {
    title: 'スタート位置',
    items: [
      {
        token: legend.arrows[0],
        label: '上向き',
        description: 'スタート位置を上向きに設定します。',
        icon: mapCellIcons.start.up,
        isStart: true,
      },
      {
        token: legend.arrows[3],
        label: '右向き',
        description: 'スタート位置を右向きに設定します。',
        icon: mapCellIcons.start.right,
        isStart: true,
      },
      {
        token: legend.arrows[1],
        label: '下向き',
        description: 'スタート位置を下向きに設定します。',
        icon: mapCellIcons.start.down,
        isStart: true,
      },
      {
        token: legend.arrows[2],
        label: '左向き',
        description: 'スタート位置を左向きに設定します。',
        icon: mapCellIcons.start.left,
        isStart: true,
      },
    ],
  },
  {
    title: 'その他',
    items: [
      {
        type: 'warp',
        label: 'ワープポータル…',
        description: 'W1 のようにポータル ID を指定します。',
        icon: mapCellIcons.warp,
      },
    ],
  },
];

const createMapCellMenuElement = () => {
  if (mapCellMenuState.element) {
    return mapCellMenuState.element;
  }
  const container = document.createElement('div');
  container.className = 'map-cell-menu';
  const list = document.createElement('div');
  list.className = 'map-cell-menu__groups';
  container.appendChild(list);
  mapCellMenuState.element = container;
  mapCellMenuState.list = list;
  document.body.appendChild(container);
  return container;
};

const closeMapCellMenu = () => {
  if (!mapCellMenuState.element) {
    return;
  }
  mapCellMenuState.element.classList.remove('is-visible');
  mapCellMenuState.element.style.opacity = '0';
  mapCellMenuState.active = false;
  mapCellMenuState.row = null;
  mapCellMenuState.col = null;
};

const handleWarpSelection = (rowIndex, colIndex) => {
  const currentToken = mapEditorState.tokens[rowIndex]?.[colIndex] ?? '';
  const defaultId = currentToken.match(/^W(\d+)$/u)?.[1] ?? '';
  const input = window.prompt('ワープポータルの番号を入力してください（例: 1）', defaultId);
  if (input == null) {
    return;
  }
  const trimmed = input.trim();
  if (!/^[0-9]+$/u.test(trimmed)) {
    window.alert('ポータル番号は 0 以上の整数で指定してください。');
    return;
  }
  mapEditorState.tokens[rowIndex][colIndex] = `W${trimmed}`;
  updateMapInputFromEditor();
  closeMapCellMenu();
};

const applyTokenSelection = (rowIndex, colIndex, token) => {
  const currentToken = mapEditorState.tokens[rowIndex]?.[colIndex] ?? '';
  if (currentToken === token) {
    closeMapCellMenu();
    return;
  }

  if (isStartToken(token)) {
    clearOtherStarts(rowIndex, colIndex);
  }

  mapEditorState.tokens[rowIndex][colIndex] = token;
  ensureAnyStartExists(rowIndex, colIndex);
  updateMapInputFromEditor();
  closeMapCellMenu();
};

const renderMapCellMenuGroup = (group, rowIndex, colIndex) => {
  const fragment = document.createDocumentFragment();

  const heading = document.createElement('p');
  heading.className = 'map-cell-menu__group-title';
  heading.textContent = group.title;
  fragment.appendChild(heading);

  const list = document.createElement('div');
  list.className = 'map-cell-menu__group-options';

  group.items.forEach((item) => {
    if (item.type === 'warp') {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'map-cell-menu__option';
      button.dataset.optionType = 'warp';
      if (item.icon) {
        const icon = document.createElement('span');
        icon.className = 'map-cell-menu__option-icon';
        icon.textContent = item.icon;
        button.appendChild(icon);
      }
      const body = document.createElement('span');
      body.className = 'map-cell-menu__option-body';
      body.innerHTML = `<strong>${item.label}</strong><small>${item.description}</small>`;
      button.appendChild(body);
      button.addEventListener('click', () => handleWarpSelection(rowIndex, colIndex));
      list.appendChild(button);
      return;
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'map-cell-menu__option';
    button.dataset.optionType = 'token';
    button.dataset.token = item.token;

    if (item.icon) {
      const icon = document.createElement('span');
      icon.className = 'map-cell-menu__option-icon';
      icon.textContent = item.icon;
      button.appendChild(icon);
    }

    const body = document.createElement('span');
    body.className = 'map-cell-menu__option-body';
    body.innerHTML = `<strong>${item.label}</strong><small>${item.description}</small>`;
    button.appendChild(body);

    const currentToken = mapEditorState.tokens[rowIndex]?.[colIndex] ?? '';
    if (currentToken === item.token) {
      button.classList.add('is-selected');
    }

    button.addEventListener('click', () => applyTokenSelection(rowIndex, colIndex, item.token));
    list.appendChild(button);
  });

  fragment.appendChild(list);
  return fragment;
};

const renderMapCellMenu = (rowIndex, colIndex) => {
  const container = createMapCellMenuElement();
  if (!mapCellMenuState.list) {
    return;
  }
  mapCellMenuState.list.textContent = '';

  MAP_CELL_MENU_GROUPS.forEach((group, index) => {
    mapCellMenuState.list.appendChild(renderMapCellMenuGroup(group, rowIndex, colIndex));
    if (index < MAP_CELL_MENU_GROUPS.length - 1) {
      const divider = document.createElement('hr');
      divider.className = 'map-cell-menu__divider';
      mapCellMenuState.list.appendChild(divider);
    }
  });

  // 既存のワープがある場合は簡易表示
  const currentToken = mapEditorState.tokens[rowIndex]?.[colIndex] ?? '';
  if (/^W\d+$/u.test(currentToken)) {
    const currentInfo = document.createElement('p');
    currentInfo.className = 'map-cell-menu__current-warp';
    currentInfo.textContent = `現在のポータル: ${currentToken}`;
    mapCellMenuState.list.appendChild(currentInfo);
  }

  container.style.opacity = '0';
};

const positionMapCellMenu = (cellElement) => {
  if (!mapCellMenuState.element) {
    return;
  }
  const rect = cellElement.getBoundingClientRect();
  const scrollX = window.scrollX ?? window.pageXOffset;
  const scrollY = window.scrollY ?? window.pageYOffset;
  const top = scrollY + rect.bottom + 8;
  const left = scrollX + rect.left + rect.width / 2;
  mapCellMenuState.element.style.top = `${top}px`;
  mapCellMenuState.element.style.left = `${left}px`;
  mapCellMenuState.element.style.opacity = '1';
  mapCellMenuState.element.classList.add('is-visible');
};

const openMapCellMenu = (cellElement, rowIndex, colIndex) => {
  ensureMapEditorState();
  if (!mapEditorState.tokens[rowIndex] || mapEditorState.tokens[rowIndex][colIndex] == null) {
    return;
  }

  renderMapCellMenu(rowIndex, colIndex);
  positionMapCellMenu(cellElement);
  mapCellMenuState.active = true;
  mapCellMenuState.row = rowIndex;
  mapCellMenuState.col = colIndex;
};

const handleMapCanvasClick = (event) => {
  if (!mapCanvas || !mapInput) {
    return;
  }

  const cellElement = event.target.closest('.map-cell');
  if (!cellElement) {
    closeMapCellMenu();
    return;
  }

  event.stopPropagation();
  const rowIndex = Number.parseInt(cellElement.dataset.row ?? '', 10);
  const colIndex = Number.parseInt(cellElement.dataset.col ?? '', 10);

  if (Number.isNaN(rowIndex) || Number.isNaN(colIndex)) {
    return;
  }

  openMapCellMenu(cellElement, rowIndex, colIndex);
};

const handleDocumentClickForMenu = (event) => {
  if (!mapCellMenuState.active) {
    return;
  }
  if (event.target.closest('.map-cell-menu')) {
    return;
  }
  if (event.target.closest('.map-cell')) {
    return;
  }
  closeMapCellMenu();
};

const handleMenuKeydown = (event) => {
  if (!mapCellMenuState.active) {
    return;
  }
  if (event.key === 'Escape') {
    closeMapCellMenu();
    if (legendState.isOpen) {
      event.stopPropagation();
      closeLegend({ restoreFocus: true });
    }
  }
};

const handleMenuScroll = () => {
  if (!mapCellMenuState.active) {
    return;
  }
  closeMapCellMenu();
};

const preprocessSolutionTokens = (solutionText) => {
  const tokens = [];
  const lines = solutionText.replace(/\r\n?/g, '\n').split('\n');
  let insideBlockComment = false;

  lines.forEach((rawLine, index) => {
    let line = rawLine.replace(/\ufeff/g, '');
    let cursor = 0;
    let buffer = '';

    while (cursor < line.length) {
      if (insideBlockComment) {
        const end = line.indexOf('*/', cursor);
        if (end === -1) {
          cursor = line.length;
          break;
        }
        insideBlockComment = false;
        cursor = end + 2;
        continue;
      }

      const blockStart = line.indexOf('/*', cursor);
      const lineComment = line.indexOf('//', cursor);

      if (lineComment !== -1 && (blockStart === -1 || lineComment < blockStart)) {
        buffer += line.slice(cursor, lineComment);
        cursor = line.length;
        break;
      }

      if (blockStart !== -1) {
        buffer += line.slice(cursor, blockStart);
        const blockEnd = line.indexOf('*/', blockStart + 2);
        if (blockEnd === -1) {
          insideBlockComment = true;
          cursor = line.length;
          break;
        }
        cursor = blockEnd + 2;
        continue;
      }

      buffer += line.slice(cursor);
      cursor = line.length;
    }

    const cleaned = buffer.trim();
    if (!cleaned.length) {
      return;
    }

    const expanded = buffer
      .replace(/([{}])/g, '\n$1\n')
      .split(/[\r\n]+/)
      .map((part) => part.trim())
      .filter((part) => part.length > 0);

    expanded.forEach((part) => {
      if (/^else\s*if\b/i.test(part)) {
        const remainder = part.replace(/^else\s*/i, '').trim();
        tokens.push({ text: 'else', line: index + 1 });
        if (remainder.length > 0) {
          tokens.push({ text: remainder, line: index + 1 });
        }
      } else {
        tokens.push({ text: part, line: index + 1 });
      }
    });
  });

  return tokens;
};

const parseCommands = (solutionText) => {
  const tokens = preprocessSolutionTokens(solutionText);
  if (!tokens.length) {
    throw new Error('解答が空です。');
  }

  const functions = new Map();
  let containsDynamicControlFlow = false;

  const tokenAt = (index) => tokens[index] ?? null;
  const textAt = (index) => tokenAt(index)?.text ?? null;
  const lineAt = (index) => tokenAt(index)?.line ?? null;
  const createSource = (index, overrideText) => ({
    line: lineAt(index),
    text: overrideText ?? textAt(index) ?? '',
  });

  const parseCondition = (tokenObj, keyword) => {
    const tokenText = tokenObj?.text ?? '';
    const pattern = new RegExp(`^${keyword}\\s+(.+)$`, 'i');
    const match = tokenText.match(pattern);
    if (!match) {
      throw new Error(`${keyword} 文の条件を解析できません: ${tokenText}`);
    }

    const rawCondition = match[1].trim();
    if (!rawCondition) {
      throw new Error(`${keyword} 文の条件を指定してください。`);
    }

    try {
      return parseBooleanCondition(rawCondition);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`${keyword} 文の条件式を解析できません: ${error.message}`);
      }
      throw error;
    }
  };

  const parseBlock = (startIndex) => {
    if (textAt(startIndex) !== '{') {
      throw new Error('開きカッコ { が必要です。');
    }

    const statements = [];
    let index = startIndex + 1;

    while (index < tokens.length && textAt(index) !== '}') {
      if (/^func\s+/u.test(textAt(index) ?? '')) {
        throw new Error('関数を他の関数やループの内部で定義することはできません。');
      }

      const { statement, nextIndex } = parseExecutableStatement(index);
      statements.push(statement);
      index = nextIndex;
    }

    if (index >= tokens.length || textAt(index) !== '}') {
      throw new Error('ブロックに対応する閉じカッコ } が見つかりません。');
    }

    return { statements, nextIndex: index + 1 };
  };

  const parseIfStatement = (currentIndex) => {
    containsDynamicControlFlow = true;
    const condition = parseCondition(tokenAt(currentIndex), 'if');
    const { statements: consequent, nextIndex: afterThen } = parseBlock(currentIndex + 1);
    const source = createSource(currentIndex);

    let alternate = null;
    let cursor = afterThen;

    if (cursor < tokens.length && (textAt(cursor) ?? '').toLowerCase() === 'else') {
      cursor += 1;
      const nextToken = textAt(cursor);
      if (!nextToken) {
        throw new Error('else の後にブロック { ... } または if 文が必要です。');
      }

      if (nextToken === '{') {
        const { statements, nextIndex } = parseBlock(cursor);
        alternate = statements;
        cursor = nextIndex;
      } else if (/^if\s+/i.test(nextToken)) {
        const nested = parseIfStatement(cursor);
        alternate = [nested.statement];
        cursor = nested.nextIndex;
      } else {
        throw new Error('else の後にブロック { ... } または if 文が必要です。');
      }
    }

    return {
      statement: {
        kind: 'if',
        condition,
        consequent,
        alternate: alternate ?? null,
        source,
      },
      nextIndex: cursor,
    };
  };

  const parseWhileStatement = (currentIndex) => {
    containsDynamicControlFlow = true;
    const condition = parseCondition(tokenAt(currentIndex), 'while');
    const { statements, nextIndex } = parseBlock(currentIndex + 1);
    return {
      statement: {
        kind: 'while',
        condition,
        body: statements,
        source: createSource(currentIndex),
      },
      nextIndex,
    };
  };

  const parseFunctionDefinition = (currentIndex) => {
    const token = textAt(currentIndex) ?? '';
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

  const parseExecutableStatement = (currentIndex) => {
    const token = textAt(currentIndex);
    if (!token) {
      throw new Error('命令の解析中に入力が終了しました。');
    }

    if (/^if\s+/i.test(token)) {
      return parseIfStatement(currentIndex);
    }

    if (/^while\s+/i.test(token)) {
      return parseWhileStatement(currentIndex);
    }

    if (/^for\s+/i.test(token)) {
      const normalizedToken = token.replace(/\s+/g, ' ').trim();
      const loopMatch = normalizedToken.match(/^for\s+(\d+)\s+times$/i);

      let iterations = null;

      if (loopMatch) {
        iterations = Number.parseInt(loopMatch[1], 10);
        if (!Number.isInteger(iterations) || iterations <= 0) {
          throw new Error(`for ループの回数を正しく指定してください（現在: ${loopMatch[1]}）。`);
        }
      } else {
        const rangeMatch = normalizedToken.match(/^for\s+(?:[A-Za-z_][A-Za-z0-9_]*|_)\s+in\s+(-?\d+)\s*(\.\.\.|\.\.<)\s*(-?\d+)$/i);
        if (!rangeMatch) {
          throw new Error(`for ループの構文を解析できません: ${token}`);
        }

        const start = Number.parseInt(rangeMatch[1], 10);
        const operator = rangeMatch[2];
        const end = Number.parseInt(rangeMatch[3], 10);

        if (!Number.isInteger(start) || !Number.isInteger(end)) {
          throw new Error(`for ループの範囲は整数で指定してください: ${token}`);
        }

        if (operator === '...') {
          iterations = end - start + 1;
          if (end < start) {
            throw new Error(`for ループの範囲を正しく指定してください（開始: ${start}, 終了: ${end}）。`);
          }
        } else {
          iterations = end - start;
          if (end <= start) {
            throw new Error(`for ループの範囲を正しく指定してください（開始: ${start}, 終了: ${end}）。`);
          }
        }

        if (!Number.isInteger(iterations) || iterations <= 0) {
          throw new Error(`for ループの繰り返し回数が 0 回以下になる範囲です: ${token}`);
        }
      }

      const { statements, nextIndex } = parseBlock(currentIndex + 1);
      return {
        statement: { kind: 'loop', count: iterations, body: statements, source: createSource(currentIndex, token) },
        nextIndex,
      };
    }

    const normalized = token.replace(/\s+/g, '');

    if (/^\w+\(\)$/u.test(normalized)) {
      const base = normalized.replace(/\(.*\)$/u, '');
      if (Object.values(Command).includes(base)) {
        return {
          statement: { kind: 'command', type: base, source: createSource(currentIndex, token) },
          nextIndex: currentIndex + 1,
        };
      }

      return {
        statement: { kind: 'call', name: base, source: createSource(currentIndex, token) },
        nextIndex: currentIndex + 1,
      };
    }

    throw new Error(`未知の命令です: ${token}`);
  };

  const mainStatements = [];
  let cursor = 0;

  while (cursor < tokens.length) {
    const token = textAt(cursor);

    if (/^func\s+/u.test(token ?? '')) {
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

  const validateFunctionUsage = (statements, callStack = []) => {
    statements.forEach((statement) => {
      if (statement.kind === 'loop') {
        validateFunctionUsage(statement.body, callStack);
        return;
      }

      if (statement.kind === 'if') {
        validateFunctionUsage(statement.consequent, callStack);
        if (statement.alternate) {
          validateFunctionUsage(statement.alternate, callStack);
        }
        return;
      }

      if (statement.kind === 'while') {
        validateFunctionUsage(statement.body, callStack);
        return;
      }

      if (statement.kind === 'call') {
        if (!functions.has(statement.name)) {
          throw new Error(`未定義の関数を呼び出しています: ${statement.name}()`);
        }

        if (callStack.includes(statement.name)) {
          throw new Error(`再帰的な関数呼び出しはサポートされていません: ${statement.name}()`);
        }

        validateFunctionUsage(functions.get(statement.name), [...callStack, statement.name]);
      }
    });
  };

  validateFunctionUsage(mainStatements, []);
  for (const [name, body] of functions.entries()) {
    validateFunctionUsage(body, [name]);
  }

  const computeStaticCount = (statements, seenFunctions = new Set()) => {
    let total = 0;

    for (const statement of statements) {
      if (statement.kind === 'command') {
        total += 1;
        continue;
      }

      if (statement.kind === 'loop') {
        const innerCount = computeStaticCount(statement.body, seenFunctions);
        if (innerCount == null) {
          return null;
        }
        total += innerCount * statement.count;
        continue;
      }

      if (statement.kind === 'call') {
        const functionBody = functions.get(statement.name);
        if (!functionBody) {
          throw new Error(`未定義の関数を呼び出しています: ${statement.name}()`);
        }
        if (seenFunctions.has(statement.name)) {
          throw new Error(`再帰的な関数呼び出しはサポートされていません: ${statement.name}()`);
        }
        const nextSeen = new Set(seenFunctions);
        nextSeen.add(statement.name);
        const innerCount = computeStaticCount(functionBody, nextSeen);
        if (innerCount == null) {
          return null;
        }
        total += innerCount;
        continue;
      }

      return null;
    }

    return total;
  };

  const staticCommandCount = containsDynamicControlFlow ? null : computeStaticCount(mainStatements);

  return {
    main: mainStatements,
    functions,
    metadata: {
      staticCommandCount: staticCommandCount ?? null,
      hasDynamicControlFlow: containsDynamicControlFlow || staticCommandCount == null,
    },
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

const MAX_EXECUTION_STEPS = 10000;

const simulateProgram = (mapData, program) => {
  const logEntries = [];
  const errors = [];
  const visitedPath = new Set();
  const frames = [];
  let gemsCollected = 0;
  const remainingGems = new Set(mapData.gems);
  const switchesState = new Map(mapData.switches);

  let currentRow = mapData.start.row;
  let currentCol = mapData.start.col;
  let facing = mapData.start.direction;
  let halted = false;
  let executedCommands = 0;
  let operationCount = 0;

  const functions = program.functions ?? new Map();

  const captureFrame = ({ message = '', kind = 'info', label = null, command = null, source = null } = {}) => {
    frames.push({
      frameIndex: frames.length,
      step: executedCommands,
      row: currentRow,
      col: currentCol,
      facing,
      visited: Array.from(visitedPath),
      message,
      kind,
      label,
      command,
      source,
    });
  };

  const recordLog = (message, kind = 'info', options = {}) => {
    const entry = { message, kind, position: { row: currentRow, col: currentCol }, facing };
    logEntries.push(entry);
    if (options.capture) {
      captureFrame({
        message,
        kind,
        label: options.label ?? null,
        command: options.command ?? null,
        source: options.source ?? null,
      });
    }
  };

  const recordError = (message, meta = {}) => {
    errors.push(message);
    recordLog(message, 'error', { capture: true, ...meta });
  };

  const ensureBudget = (meta = {}) => {
    if (halted) {
      return false;
    }
    operationCount += 1;
    if (operationCount > MAX_EXECUTION_STEPS) {
      recordError(`実行ステップが ${MAX_EXECUTION_STEPS} 回を超えました。無限ループの可能性があります。`, meta);
      halted = true;
      return false;
    }
    return true;
  };

  const formatCondition = (condition) => formatBooleanCondition(condition);

  const isBlockedInDirection = (direction) => {
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

  const evaluatePredicate = (predicate) => {
    const key = `${currentRow},${currentCol}`;
    switch (predicate) {
      case ConditionPredicate.IS_ON_GEM:
        return remainingGems.has(key);
      case ConditionPredicate.IS_ON_OPEN_SWITCH:
        return switchesState.get(key) === 'open';
      case ConditionPredicate.IS_ON_CLOSED_SWITCH:
        return switchesState.get(key) === 'closed';
      case ConditionPredicate.IS_ON_SWITCH:
        return switchesState.has(key);
      case ConditionPredicate.IS_BLOCKED:
        return isBlockedInDirection(facing);
      case ConditionPredicate.IS_BLOCKED_LEFT:
        return isBlockedInDirection(rotateDirection(facing, 'left'));
      case ConditionPredicate.IS_BLOCKED_RIGHT:
        return isBlockedInDirection(rotateDirection(facing, 'right'));
      default:
        return false;
    }
  };

  const evaluateCondition = (condition) => evaluateBooleanCondition(condition, evaluatePredicate);

  const executeCommand = (statement) => {
    const type = statement.type;
    if (halted) {
      return;
    }

    const commandMeta = {
      label: `コマンド ${executedCommands + 1}`,
      command: type,
      source: statement.source ?? null,
    };
    if (!ensureBudget(commandMeta)) {
      return;
    }

    executedCommands += 1;
    const humanIndex = executedCommands;
    const cellKey = `${currentRow},${currentCol}`;
    visitedPath.add(cellKey);

    if (type === Command.MOVE_FORWARD) {
      const vector = directionVectors[facing];
      const targetRow = currentRow + vector.row;
      const targetCol = currentCol + vector.col;
      const targetCell = getCell(mapData.grid, targetRow, targetCol);

      if (!targetCell) {
        recordError(`コマンド ${humanIndex}: マップの外に移動しようとしました。`, commandMeta);
        halted = true;
        return;
      }

      if (targetCell.type === 'wall') {
        recordError(`コマンド ${humanIndex}: 通行不可のマス(止) に衝突しました。`, commandMeta);
        halted = true;
        return;
      }

      currentRow = targetRow;
      currentCol = targetCol;
      visitedPath.add(`${currentRow},${currentCol}`);
      recordLog(`コマンド ${humanIndex}: (${currentRow + 1}, ${currentCol + 1}) に移動しました。`, 'info', {
        capture: true,
        ...commandMeta,
      });

      if (targetCell.warpId) {
        const destination = resolveWarp(mapData.portals, targetCell.warpId, targetCell);
        if (!destination) {
          recordError(`コマンド ${humanIndex}: ワープ W${targetCell.warpId} の遷移先が見つかりません。`, commandMeta);
          halted = true;
          return;
        }
        currentRow = destination.row;
        currentCol = destination.col;
        visitedPath.add(`${currentRow},${currentCol}`);
        recordLog(`ワープ W${targetCell.warpId} を通過し、(${currentRow + 1}, ${currentCol + 1}) に移動しました。`, 'success', {
          capture: true,
          label: `ワープ W${targetCell.warpId}`,
          command: 'warp',
          source: commandMeta.source ?? null,
        });
      }

      return;
    }

    if (type === Command.TURN_LEFT || type === Command.TURN_RIGHT) {
      const turnDirection = type === Command.TURN_LEFT ? 'left' : 'right';
      facing = rotateDirection(facing, turnDirection);
      recordLog(`コマンド ${humanIndex}: ${turnDirection === 'left' ? '左' : '右'}へ回転し、向きは ${facing} になりました。`, 'info', {
        capture: true,
        ...commandMeta,
      });
      return;
    }

    if (type === Command.COLLECT_GEM) {
      const gemKey = `${currentRow},${currentCol}`;
      if (!remainingGems.has(gemKey)) {
        recordError(`コマンド ${humanIndex}: 床にジェムが存在しません。`, commandMeta);
        halted = true;
        return;
      }
      remainingGems.delete(gemKey);
      gemsCollected += 1;
      recordLog(`コマンド ${humanIndex}: ジェムを回収しました (合計 ${gemsCollected})。`, 'success', {
        capture: true,
        ...commandMeta,
      });
      return;
    }

    if (type === Command.TOGGLE_SWITCH) {
      const switchKey = `${currentRow},${currentCol}`;
      if (!switchesState.has(switchKey)) {
        recordError(`コマンド ${humanIndex}: スイッチが存在しません。`, commandMeta);
        halted = true;
        return;
      }
      const currentState = switchesState.get(switchKey);
      const nextState = currentState === 'open' ? 'closed' : 'open';
      switchesState.set(switchKey, nextState);
      recordLog(`コマンド ${humanIndex}: スイッチを ${nextState === 'open' ? '開けました' : '閉じました'}。`, 'info', {
        capture: true,
        ...commandMeta,
      });
      return;
    }
  };

  const callStack = [];

  const executeStatements = (statements) => {
    for (const statement of statements) {
      if (halted) {
        return;
      }

      if (statement.kind === 'command') {
        executeCommand(statement);
        continue;
      }

      if (statement.kind === 'loop') {
        for (let iteration = 0; iteration < statement.count && !halted; iteration += 1) {
          if (!ensureBudget()) {
            return;
          }
          executeStatements(statement.body);
        }
        continue;
      }

      if (statement.kind === 'call') {
        if (!ensureBudget()) {
          return;
        }
        const functionBody = functions.get(statement.name);
        if (!functionBody) {
          recordError(`未定義の関数を呼び出しています: ${statement.name}()`);
          halted = true;
          return;
        }
        if (callStack.includes(statement.name)) {
          recordError(`再帰的な関数呼び出しはサポートされていません: ${statement.name}()`);
          halted = true;
          return;
        }
        callStack.push(statement.name);
        executeStatements(functionBody);
        callStack.pop();
        continue;
      }

      if (statement.kind === 'if') {
        if (!ensureBudget()) {
          return;
        }
        const result = evaluateCondition(statement.condition);
        recordLog(`条件 if (${formatCondition(statement.condition)}) は ${result ? '真' : '偽'} です。`);
        if (result) {
          executeStatements(statement.consequent);
        } else if (statement.alternate) {
          executeStatements(statement.alternate);
        }
        continue;
      }

      if (statement.kind === 'while') {
        let iterations = 0;
        while (!halted) {
          if (!ensureBudget()) {
            return;
          }
          const result = evaluateCondition(statement.condition);
          recordLog(`while (${formatCondition(statement.condition)}) 判定: ${result ? '継続' : '終了'}`);
          if (!result) {
            break;
          }
          iterations += 1;
          if (iterations > MAX_EXECUTION_STEPS) {
            recordError('while ループが許容回数を超過しました。条件や終了処理を確認してください。');
            halted = true;
            break;
          }
          executeStatements(statement.body);
        }
      }
    }
  };

  visitedPath.add(`${currentRow},${currentCol}`);
  recordLog(`スタート位置 (${currentRow + 1}, ${currentCol + 1}) から ${facing} 向きで開始します。`, 'success', {
    capture: true,
    label: '開始',
    command: 'start',
  });
  executeStatements(program.main ?? []);

  if (!halted) {
    recordLog('すべてのコマンドを実行しました。', 'success', {
      capture: true,
      label: '完了',
      command: 'end',
    });
  }

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
    stepsExecuted: executedCommands,
    frames,
  };
};

const renderMapPreview = (mapData, visitedPath = new Set(), activePosition = null) => {
  if (!mapCanvas) return;
  closeMapCellMenu();
  refreshMapEditorState(mapData);
  mapCanvas.textContent = '';
  if (mapData.columns > 0) {
    mapCanvas.style.setProperty('--cols', String(mapData.columns));
  } else {
    mapCanvas.style.removeProperty('--cols');
  }

  const visitedSet = visitedPath instanceof Set ? visitedPath : new Set(visitedPath ?? []);

  mapData.grid.forEach((row) => {
    row.forEach((cell) => {
      const cellElement = document.createElement('div');
      cellElement.classList.add('map-cell');
      cellElement.dataset.type = cell.type;
      cellElement.dataset.row = String(cell.row);
      cellElement.dataset.col = String(cell.col);
      const description = getCellDescription(cell);
      cellElement.setAttribute('role', 'gridcell');
      cellElement.setAttribute('aria-label', description);
      cellElement.title = description;

      if (cell.isStart) {
        cellElement.dataset.start = 'true';
        cellElement.dataset.direction = cell.direction;
      } else if (cell.hasGem) {
        cellElement.dataset.gem = 'true';
      } else if (cell.switchState === 'open') {
        cellElement.dataset.switch = 'open';
      } else if (cell.switchState === 'closed') {
        cellElement.dataset.switch = 'closed';
      } else if (cell.warpId) {
        cellElement.dataset.warp = String(cell.warpId);
      }

      const icon = getCellIcon(cell);
      const iconElement = document.createElement('span');
      iconElement.classList.add('map-cell__icon');
      iconElement.textContent = icon;
      cellElement.appendChild(iconElement);

      if (cell.warpId) {
        const badgeElement = document.createElement('span');
        badgeElement.classList.add('map-cell__badge');
        badgeElement.textContent = `W${cell.warpId}`;
        cellElement.appendChild(badgeElement);
      }

      const key = `${cell.row},${cell.col}`;
      if (visitedSet.has(key)) {
        cellElement.dataset.path = 'true';
      }

      const isActive = Boolean(
        activePosition && cell.row === activePosition.row && cell.col === activePosition.col,
      );

      if (isActive) {
        cellElement.dataset.active = 'true';
        const actorSymbol = activePosition.facing ? directionToArrow[activePosition.facing] ?? '' : '';
        if (actorSymbol) {
          cellElement.dataset.actor = actorSymbol;
        } else {
          delete cellElement.dataset.actor;
        }
      } else {
        delete cellElement.dataset.active;
        delete cellElement.dataset.actor;
      }

      mapCanvas.appendChild(cellElement);
    });
  });
};

const updateStatusCard = (status, details = []) => {
  statusCard.dataset.status = status;
  if (statusHeaderButton) {
    statusHeaderButton.dataset.status = status;
  }
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

const setCommandCount = (program) => {
  if (!program || !program.metadata) {
    commandCountChip.textContent = '— コマンド';
    return;
  }

  const { staticCommandCount, hasDynamicControlFlow } = program.metadata;
  if (staticCommandCount != null) {
    commandCountChip.textContent = `${staticCommandCount} コマンド`;
    return;
  }

  commandCountChip.textContent = hasDynamicControlFlow ? '可変（条件分岐あり）' : '— コマンド';
};

const stepperState = {
  frames: [],
  index: -1,
  mapData: null,
  autoTimer: null,
  hasErrors: false,
  defaultMessage: DEFAULT_STEPPER_HINT,
  commandTotal: 0,
};

const formatFacing = (direction) => {
  if (!direction) {
    return '--';
  }
  const label = directionLabels[direction] ?? direction;
  const arrow = directionToArrow[direction] ?? '';
  return arrow ? `${label} (${arrow})` : label;
};

const stopAutoPlay = () => {
  if (stepperState.autoTimer) {
    window.clearInterval(stepperState.autoTimer);
    stepperState.autoTimer = null;
  }
};

const updateStepperUI = () => {
  if (!stepperCard) {
    return;
  }

  const totalFrames = stepperState.frames.length;
  const isAuto = Boolean(stepperState.autoTimer);

  const commandLabel = stepperState.commandTotal > 0 ? `${stepperState.commandTotal} コマンド` : '0 コマンド';
  stepCounterChip.textContent = commandLabel;

  if (totalFrames === 0) {
    setCodePanelHint(DEFAULT_CODE_HINT);
    setActiveCodeLine(null);
    stepStatusHeading.textContent = '結果待機中';
    stepStatusMessage.textContent = stepperState.defaultMessage;
    stepDetailMessage.textContent = DEFAULT_STEPPER_DETAIL;
    stepIndexLabel.textContent = '--';
    stepPositionLabel.textContent = '--';
    stepFacingLabel.textContent = '--';
    if (stepStartButton) stepStartButton.disabled = true;
    if (stepPrevButton) stepPrevButton.disabled = true;
    if (stepNextButton) stepNextButton.disabled = true;
    if (stepAutoButton) {
      stepAutoButton.disabled = true;
      stepAutoButton.textContent = '自動再生';
    }
    return;
  }

  setCodePanelHint(ACTIVE_CODE_HINT);

  const currentIndex = stepperState.index;
  const hasSelection = currentIndex >= 0 && currentIndex < totalFrames;
  const currentFrame = hasSelection ? stepperState.frames[currentIndex] : null;

  if (!hasSelection) {
    stepStatusHeading.textContent = stepperState.hasErrors ? '結果を確認できます' : 'ステップ準備完了';
    stepStatusMessage.textContent = stepperState.defaultMessage;
    stepDetailMessage.textContent = DEFAULT_STEPPER_DETAIL;
    stepIndexLabel.textContent = `0 / ${totalFrames}`;
    stepPositionLabel.textContent = '--';
    stepFacingLabel.textContent = '--';
    setActiveCodeLine(null);
  } else if (currentFrame) {
    const heading = currentFrame.kind === 'error' ? 'エラー' : isAuto ? '自動再生中' : 'ステップ確認中';
    stepStatusHeading.textContent = heading;
    const label = currentFrame.label ?? `ステップ ${currentIndex + 1}`;
    stepStatusMessage.textContent = label;
    stepDetailMessage.textContent = currentFrame.message || '—';
    stepIndexLabel.textContent = `${currentIndex + 1} / ${totalFrames}`;
    stepPositionLabel.textContent = `${currentFrame.row + 1}, ${currentFrame.col + 1}`;
    stepFacingLabel.textContent = formatFacing(currentFrame.facing);
    if (currentFrame.source && currentFrame.source.line != null) {
      setActiveCodeLine(currentFrame.source.line);
    } else {
      setActiveCodeLine(null);
    }
  }

  if (stepStartButton) {
    stepStartButton.disabled = isAuto;
  }
  if (stepPrevButton) {
    stepPrevButton.disabled = isAuto || currentIndex <= 0;
  }
  if (stepNextButton) {
    const disableNext = isAuto || (hasSelection ? currentIndex >= totalFrames - 1 : false);
    stepNextButton.disabled = disableNext;
  }
  if (stepAutoButton) {
    stepAutoButton.disabled = false;
    stepAutoButton.textContent = isAuto ? '停止' : '自動再生';
  }
};

const resetStepper = (message = DEFAULT_STEPPER_HINT) => {
  if (!stepperCard) {
    return;
  }
  stopAutoPlay();
  stepperState.frames = [];
  stepperState.index = -1;
  stepperState.mapData = null;
  stepperState.hasErrors = false;
  stepperState.defaultMessage = message;
  stepperState.commandTotal = 0;
  updateStepperUI();
};

const applyStep = (index) => {
  if (!stepperState.mapData) {
    return;
  }
  const totalFrames = stepperState.frames.length;
  if (index < 0 || index >= totalFrames) {
    return;
  }
  stepperState.index = index;
  const frame = stepperState.frames[index];
  const visitedSet = new Set(frame.visited ?? []);
  renderMapPreview(stepperState.mapData, visitedSet, {
    row: frame.row,
    col: frame.col,
    facing: frame.facing,
  });
  updateStepperUI();
};

const prepareStepper = (mapData, simulation) => {
  if (!stepperCard) {
    return;
  }
  stopAutoPlay();
  stepperState.frames = simulation.frames ?? [];
  stepperState.index = -1;
  stepperState.mapData = mapData;
  stepperState.hasErrors = simulation.errors.length > 0;
  stepperState.defaultMessage = '「最初」または「次へ」でステップ実行を開始します。';
  stepperState.commandTotal = simulation.stepsExecuted ?? 0;
  updateStepperUI();
};

const toggleAutoPlay = () => {
  if (!stepperCard || stepperState.frames.length === 0) {
    return;
  }

  if (stepperState.autoTimer) {
    stopAutoPlay();
    updateStepperUI();
    return;
  }

  if (stepperState.index < 0 || stepperState.index >= stepperState.frames.length - 1) {
    applyStep(0);
  } else {
    const advance = () => {
      if (stepperState.index >= stepperState.frames.length - 1) {
        stopAutoPlay();
        updateStepperUI();
        return;
      }
      applyStep(stepperState.index + 1);
    };
    advance();
  }

  stepperState.autoTimer = window.setInterval(() => {
    if (stepperState.index >= stepperState.frames.length - 1) {
      stopAutoPlay();
      updateStepperUI();
      return;
    }
    applyStep(stepperState.index + 1);
  }, STEP_AUTO_INTERVAL);
  updateStepperUI();
};

const runValidation = () => {
  resetStepper('検証中です…');
  try {
    resetLog();

    const mapData = parseMap(mapInput.value);
    setMapCounts(mapData);
    renderMapPreview(mapData);

    const program = parseCommands(solutionInput.value);
    setCommandCount(program);

    const simulation = simulateProgram(mapData, program);

    simulation.logs.forEach((entry) => appendLogEntry(entry));

    const hasErrors = simulation.errors.length > 0;
    const status = hasErrors ? 'failure' : 'success';
    updateStatusCard(status, simulation.errors);
    updateMetrics({
      steps: simulation.stepsExecuted,
      gemsCollected: simulation.gemsCollected,
      totalGems: simulation.totalGems,
      switchesOpen: simulation.switchesOpen,
      totalSwitches: simulation.totalSwitches,
      errors: simulation.errors.length,
    });
    renderMapPreview(mapData, simulation.visitedPath);
    prepareStepper(mapData, simulation);

    previewNote.textContent = hasErrors
      ? '訪問した経路を確認し、ログで問題のステップを参照してください。'
      : program.metadata.hasDynamicControlFlow
        ? '条件分岐やループの判定ログが追加されました。ステップ実行で分岐ごとの移動も追跡できます。'
        : '訪問経路がハイライトされました。ステップ実行でコマンドごとの移動も確認できます。';
  } catch (error) {
    updateStatusCard('error', [error.message]);
    updateMetrics({ steps: 0, gemsCollected: 0, totalGems: 0, switchesOpen: 0, totalSwitches: 0, errors: 1 });
    resetStepper('エラーが発生したため、修正後に再度検証してください。');
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
  renderCodeViewer(SAMPLE_SOLUTION);
  if (codePanelState.mode === 'edit' && codePanelEditor) {
    codePanelEditor.value = SAMPLE_SOLUTION;
  }
  previewNote.textContent = 'サンプルマップを読み込みました。自動検証の結果を確認してください。';
  runValidation();
};

const clearInputs = () => {
  closeMapTextModal();
  mapInput.value = '';
  solutionInput.value = '';
  renderCodeViewer('');
  if (codePanelState.mode === 'edit' && codePanelEditor) {
    codePanelEditor.value = '';
  }
  mapCanvas.textContent = '';
  mapCanvas.style.removeProperty('--cols');
  mapSizeChip.textContent = '0 × 0';
  commandCountChip.textContent = '0 コマンド';
  resetLog();
  updateStatusCard('idle');
  updateMetrics({ steps: 0, gemsCollected: 0, totalGems: 0, switchesOpen: 0, totalSwitches: 0, errors: 0 });
  previewNote.textContent = 'マップを編集するとリアルタイムで更新されます。';
  resetStepper();
  setCodePanelHint(DEFAULT_CODE_HINT);
  refreshMapEditorState({ grid: [], rows: 0, columns: 0 });
  closeMapCellMenu();
};

const updateMapPreviewDebounced = (() => {
  let timer = null;
  return () => {
  resetStepper('入力の変更を検知。まもなく自動検証が実行されます…');
    if (timer) {
      window.clearTimeout(timer);
    }
    timer = window.setTimeout(() => {
      try {
        const mapData = parseMap(mapInput.value, {
          allowMissingStart: true,
          allowUnpairedPortals: true,
          allowEmpty: true,
        });
        setMapCounts(mapData);
        renderMapPreview(mapData);
      } catch {
        mapSizeChip.textContent = '— × —';
        mapCanvas.textContent = '';
        mapCanvas.style.removeProperty('--cols');
        refreshMapEditorState({ grid: [], rows: 0, columns: 0 });
      }
      // マップ編集後は自動検証をトリガー（無効なマップでも検証してエラーメッセージを表示したい）
      autoValidateDebounced();
    }, 250);
  };
})();

const updateCommandCountDebounced = (() => {
  let timer = null;
  return () => {
  resetStepper('入力の変更を検知。まもなく自動検証が実行されます…');
    if (timer) {
      window.clearTimeout(timer);
    }
    timer = window.setTimeout(() => {
      try {
        const program = parseCommands(solutionInput.value);
        setCommandCount(program);
      } catch {
        commandCountChip.textContent = '— コマンド';
      }
      // コード編集後も自動検証をトリガー
      autoValidateDebounced();
    }, 250);
  };
})();

// 入力変更に対して検証を自動実行するためのデバウンス関数
const autoValidateDebounced = (() => {
  let timer = null;
  return () => {
    if (timer) {
      window.clearTimeout(timer);
    }
    timer = window.setTimeout(() => {
      // フォーム送信と同じ効果を得るため runValidation を呼び出す
      try {
        runValidation();
      } catch {
        // runValidation 内でエラー処理するためここでは何もしない
      }
    }, AUTO_VALIDATE_DELAY);
  };
})();

const handleSolutionInputChange = () => {
  renderCodeViewer(solutionInput.value);
  updateCommandCountDebounced();

  if (codePanelState.mode === 'edit' && !codePanelState.isSyncing && codePanelEditor) {
    codePanelEditor.value = solutionInput.value;
  }
};

const syncSolutionFromEditor = () => {
  if (!codePanelEditor) {
    return;
  }
  codePanelState.isSyncing = true;
  solutionInput.value = codePanelEditor.value;
  handleSolutionInputChange();
  codePanelState.isSyncing = false;
};

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
    !statusDetails ||
    !codeLineList ||
    !codePanelHint ||
    !codePanelToggleButton ||
    !codePanelEditor ||
    !mapTextEditorButton ||
    !mapTextModal ||
    !mapTextModalCloseButton
  ) {
    console.error('必要な DOM 要素が見つかりません。HTML を確認してください。');
    return;
  }

  updateStatusCard('idle');
  updateMetrics({ steps: 0, gemsCollected: 0, totalGems: 0, switchesOpen: 0, totalSwitches: 0, errors: 0 });
  resetStepper();
  renderCodeViewer(solutionInput.value);
  setCodePanelHint(DEFAULT_CODE_HINT);

  mapInput.addEventListener('input', updateMapPreviewDebounced);
  solutionInput.addEventListener('input', handleSolutionInputChange);
  codePanelToggleButton.addEventListener('click', toggleCodePanelEditMode);
  codePanelEditor.addEventListener('input', syncSolutionFromEditor);
  codePanelEditor.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      exitCodePanelEditMode({ restoreFocus: true });
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      exitCodePanelEditMode({ restoreFocus: true });
    }
  });
  mapCanvas.addEventListener('click', handleMapCanvasClick);
  document.addEventListener('click', handleDocumentClickForMenu);
  document.addEventListener('keydown', handleMenuKeydown);
  document.addEventListener('keydown', handleMapTextModalKeydown);
  window.addEventListener('scroll', handleMenuScroll, true);
  window.addEventListener('resize', handleMenuScroll);
  mapSizeForm?.addEventListener('submit', handleMapSizeSubmit);

  mapTextEditorButton.setAttribute('aria-controls', 'mapTextModal');
  mapTextEditorButton.setAttribute('aria-haspopup', 'dialog');
  mapTextEditorButton.setAttribute('aria-expanded', 'false');
  mapTextEditorButton.addEventListener('click', () => {
    if (mapTextModalState.isOpen) {
      closeMapTextModal({ restoreFocus: true });
    } else {
      openMapTextModal();
    }
  });
  mapTextModalCloseButton.addEventListener('click', () => closeMapTextModal({ restoreFocus: true }));
  mapTextModal.addEventListener('click', (event) => {
    if (event.target === mapTextModal) {
      closeMapTextModal({ restoreFocus: true });
    }
  });

  // Legend popover wiring
  if (legendToggleButton && legendPopover) {
    legendToggleButton.addEventListener('click', toggleLegend);
    legendCloseButton?.addEventListener('click', () => closeLegend({ restoreFocus: true }));
    document.addEventListener('click', (ev) => {
      if (!legendState.isOpen) return;
      const target = ev.target;
      if (target.closest('#legendPopover') || target.closest('#legendToggleButton')) return;
      closeLegend();
    });
  }

  // Status popover wiring
  if (statusHeaderButton && statusCard) {
    statusHeaderButton.addEventListener('click', toggleStatusPopover);
    document.addEventListener('click', (ev) => {
      if (!statusPopoverState.isOpen) return;
      const target = ev.target;
      if (target.closest('#statusCard') || target.closest('#statusHeaderButton')) return;
      closeStatusPopover();
    });
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && statusPopoverState.isOpen) {
        ev.stopPropagation();
        closeStatusPopover({ restoreFocus: true });
      }
    });
    window.addEventListener('scroll', () => { if (statusPopoverState.isOpen) closeStatusPopover(); }, true);
    window.addEventListener('resize', () => { if (statusPopoverState.isOpen) closeStatusPopover(); });
  }

  // Status popover wiring
  if (statusHeaderButton) {
    statusHeaderButton.addEventListener('click', toggleStatusPopover);
    document.addEventListener('click', (ev) => {
      if (!statusPopoverState.isOpen) return;
      const target = ev.target;
      if (target.closest('#statusCard') || target.closest('#statusHeaderButton')) return;
      closeStatusPopover();
    });
  }

  // フォーム送信による手動検証は廃止（自動検証に統一）

  loadSampleButton?.addEventListener('click', loadSample);
  clearInputsButton?.addEventListener('click', clearInputs);
  downloadReportButton?.addEventListener('click', handleDownloadReport);
  expandLogButton?.addEventListener('click', () => toggleLogExpansion(true));
  collapseLogButton?.addEventListener('click', () => toggleLogExpansion(false));
  stepStartButton?.addEventListener('click', () => {
    if (!stepperState.frames.length) {
      return;
    }
    stopAutoPlay();
    applyStep(0);
  });
  stepPrevButton?.addEventListener('click', () => {
    if (!stepperState.frames.length) {
      return;
    }
    stopAutoPlay();
    if (stepperState.index > 0) {
      applyStep(stepperState.index - 1);
    } else {
      updateStepperUI();
    }
  });
  stepNextButton?.addEventListener('click', () => {
    if (!stepperState.frames.length) {
      return;
    }
    stopAutoPlay();
    const nextIndex = stepperState.index < 0 ? 0 : Math.min(stepperState.frames.length - 1, stepperState.index + 1);
    applyStep(nextIndex);
  });
  stepAutoButton?.addEventListener('click', () => {
    toggleAutoPlay();
  });

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
      setCommandCount(program);
    } catch {
      // ignore
    }
  }
};

document.addEventListener('DOMContentLoaded', init);
