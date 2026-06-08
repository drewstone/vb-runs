// ─── Uniswap V4 UniversalRouter Swap Executor ───
// Encodes Commands.V4_SWAP with SWAP_EXACT_IN_SINGLE / SWAP_EXACT_IN,
// decodes BalanceDelta, and displays realized slippage vs quoted.

// ── Constants ──
const V4_SWAP_COMMAND = 0x10;
const ACTION_SWAP_EXACT_IN_SINGLE = 0x06;
const ACTION_SWAP_EXACT_IN = 0x07;

const TOKENS = [
  { symbol: 'ETH', name: 'Ether', decimals: 18, address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', iconClass: 'eth', icon: 'E', balance: 1.42069 },
  { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', iconClass: 'usdc', icon: 'U', balance: 3200.00 },
  { symbol: 'WBTC', name: 'Wrapped Bitcoin', decimals: 8, address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', iconClass: 'wbtc', icon: 'B', balance: 0.05 },
  { symbol: 'USDT', name: 'Tether USD', decimals: 6, address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', iconClass: 'usdt', icon: 'T', balance: 1500.00 },
  { symbol: 'ARB', name: 'Arbitrum', decimals: 18, address: '0xB50721BCf8d664c30412Cfbc6cf7a15145234ad1', iconClass: 'arb', icon: 'A', balance: 500.00 },
];

const POOL_FEE = 3000; // 0.3%
const POOL_TICK_SPACING = 60;
const HOOKS_ADDRESS = '0x0000000000000000000000000000000000000000';
const POOL_MANAGER = '0x00000000000Da084aA36A9C1D35100c784ADEcF';

// ── State ──
const state = {
  swapMode: 'single', // 'single' | 'multi'
  tokenIn: TOKENS[0],
  tokenOut: TOKENS[1],
  amountIn: 1.0,
  slippageTolerance: 0.5,
  dropdownTarget: null,
  panelState: { encoding: true, flow: false, results: true },
  resultTab: 'delta',
  executedSwaps: [],
  multiHopPath: [
    { from: 'ETH', to: 'USDC', fee: 3000 },
    { from: 'USDC', to: 'USDT', fee: 500 },
  ],
};

// ── Price Simulation ──
const PRICES = { ETH: 3200, USDC: 1, WBTC: 68000, USDT: 1, ARB: 1.2 };

function getQuote(amountIn, tokenIn, tokenOut) {
  const inUSD = amountIn * PRICES[tokenIn.symbol];
  const outAmount = inUSD / PRICES[tokenOut.symbol];
  return outAmount;
}

// ── ABI Encoding (inline minimal ABI encoder) ──
function padLeft(hex, len = 64) {
  return hex.replace('0x', '').padStart(len, '0');
}

function encodeUint256(val) {
  return padLeft(val.toString(16));
}

function encodeUint128(val) {
  return padLeft(val.toString(16));
}

function encodeInt128(val) {
  if (val >= 0) return padLeft(val.toString(16));
  const hex = ((BigInt(1) << BigInt(128)) + BigInt(val)).toString(16);
  return padLeft(hex);
}

function encodeInt256(val) {
  if (val >= 0) return padLeft(val.toString(16));
  const hex = ((BigInt(1) << BigInt(256)) + BigInt(val)).toString(16);
  return padLeft(hex);
}

function encodeAddress(addr) {
  return padLeft(addr.replace('0x', '').toLowerCase());
}

function encodeBool(val) {
  return val ? padLeft('1') : padLeft('0');
}

function encodeBytes(data) {
  const hex = data.replace('0x', '');
  const padded = hex.padEnd(Math.ceil(hex.length / 64) * 64, '0');
  const lengthWord = encodeUint256(hex.length / 2);
  return lengthWord + padded;
}

function encodeBytesRaw(data) {
  return data.replace('0x', '').padEnd(64, '0');
}

function encodePoolKey(currency0, currency1) {
  const [c0, c1] = sortAddresses(currency0, currency1);
  return (
    encodeAddress(c0) +
    encodeAddress(c1) +
    encodeAddress(HOOKS_ADDRESS) +
    encodeAddress(POOL_MANAGER) +
    encodeUint256(POOL_FEE) +
    encodeUint256(POOL_TICK_SPACING)
  );
}

function sortAddresses(a, b) {
  return BigInt(a) < BigInt(b) ? [a, b] : [b, a];
}

function encodePath(actions, tokens) {
  let path = '';
  for (let i = 0; i < actions.length; i++) {
    path += padLeft(actions[i].toString(16));
    path += encodeAddress(tokens[i]);
  }
  path += encodeAddress(tokens[tokens.length - 1]);
  return path;
}

// ── UniversalRouter Encoding ──
function encodeUniversalRouterSwap() {
  const amountInBN = BigInt(Math.round(state.amountIn * (10 ** state.tokenIn.decimals)));
  const quotedOut = getQuote(state.amountIn, state.tokenIn, state.tokenOut);
  const slippageFactor = 1 - (state.slippageTolerance / 100);
  const minOutRaw = quotedOut * slippageFactor;
  const amountOutMinimumBN = BigInt(Math.round(minOutRaw * (10 ** state.tokenOut.decimals)));
  const hookData = '0x';

  let command;
  let inputEncoding;
  let actionFlag;

  if (state.swapMode === 'single') {
    actionFlag = ACTION_SWAP_EXACT_IN_SINGLE;
    command = V4_SWAP_COMMAND;

    const zeroForOne = BigInt(state.tokenIn.address) < BigInt(state.tokenOut.address);
    const poolKeyHex = encodePoolKey(state.tokenIn.address, state.tokenOut.address);

    // ExactInputSingleParams: poolKey, zeroForOne, amountIn, amountOutMinimum, hookData
    // The params struct is ABI-encoded as: (PoolKey, bool, uint128, uint128, bytes)
    // PoolKey = (address currency0, address currency1, address hooks, address poolManager, uint24 fee, int24 tickSpacing)
    const paramsHead = poolKeyHex +
      encodeBool(zeroForOne) +
      encodeUint128(Number(amountInBN)) +
      encodeUint128(Number(amountOutMinimumBN)) +
      encodeBytes(hookData);

    // Wrap in bytes for inputs[]
    const paramsLen = encodeUint256(paramsHead.length / 2);
    inputEncoding = paramsLen + paramsHead;

  } else {
    actionFlag = ACTION_SWAP_EXACT_IN;
    command = V4_SWAP_COMMAND;

    // ExactInputParams: exactInput (bytes path), amountIn, amountOutMinimum, hookData
    const pathTokens = state.multiHopPath.map(h => {
      const t = TOKENS.find(tok => tok.symbol === h.from);
      return t ? t.address : TOKENS[0].address;
    });
    const lastToken = TOKENS.find(tok => tok.symbol === state.multiHopPath[state.multiHopPath.length - 1].to);
    pathTokens.push(lastToken ? lastToken.address : TOKENS[1].address);

    const actions = state.multiHopPath.map(h => 0x06); // SWAP_EXACT_IN_SINGLE per hop
    const pathBytes = encodePath(actions, pathTokens);

    const paramsHead = encodeBytes('0x' + pathBytes) +
      encodeUint128(Number(amountInBN)) +
      encodeUint128(Number(amountOutMinimumBN)) +
      encodeBytes(hookData);

    const paramsLen = encodeUint256(paramsHead.length / 2);
    inputEncoding = paramsLen + paramsHead;
  }

  // Build commands + inputs for execute()
  const commandsBytes = padLeft(command.toString(16), 2);
  const actionsBytes = padLeft(actionFlag.toString(16), 2);

  const executeCalldata = '0x3593564c' + // execute(address,(bytes,bytes[],uint256))
    encodeUint256(64) + // offset to commands
    encodeUint256(128 + (inputEncoding.length / 2) * 32) + // offset to inputs
    encodeUint256(Math.floor(Date.now() / 1000) + 600) + // deadline
    encodeBytes('0x' + commandsBytes + actionsBytes) + // commands
    encodeBytes('0x' + inputEncoding); // inputs

  return {
    commands: '0x' + commandsBytes + actionsBytes,
    commandByte: '0x' + commandsBytes,
    actionByte: '0x' + actionsBytes,
    inputs: inputEncoding,
    calldata: executeCalldata,
    amountInRaw: amountInBN.toString(),
    amountOutMinimumRaw: amountOutMinimumBN.toString(),
    quotedOut,
    minOut: minOutRaw,
    deadline: Math.floor(Date.now() / 1000) + 600,
  };
}

// ── BalanceDelta Decoding ──
function decodeBalanceDelta(deltaHex) {
  // BalanceDelta is packed int256: upper 128 bits = amount0, lower 128 bits = amount1
  const full = BigInt(deltaHex);
  const mask128 = (BigInt(1) << BigInt(128)) - BigInt(1);
  const sign128 = BigInt(1) << BigInt(127);

  let amount0Raw = (full >> BigInt(128)) & mask128;
  let amount1Raw = full & mask128;

  // Sign-extend from 128-bit
  if (amount0Raw & sign128) amount0Raw -= BigInt(1) << BigInt(128);
  if (amount1Raw & sign128) amount1Raw -= BigInt(1) << BigInt(128);

  return { amount0: amount0Raw, amount1: amount1Raw, raw: full };
}

// ── Simulation ──
function simulateSwap(encoded) {
  const quotedOut = encoded.quotedOut;
  // Simulate slight slippage (0.02% - 0.15%)
  const simulatedSlippagePct = 0.02 + Math.random() * 0.13;
  const actualOut = quotedOut * (1 - simulatedSlippagePct / 100);
  const actualOutRaw = BigInt(Math.round(actualOut * (10 ** state.tokenOut.decimals)));
  const amountInRaw = BigInt(encoded.amountInRaw);

  // Build a simulated BalanceDelta
  const zeroForOne = BigInt(state.tokenIn.address) < BigInt(state.tokenOut.address);
  let delta0, delta1;
  if (zeroForOne) {
    delta0 = -amountInRaw;  // sent token0
    delta1 = actualOutRaw;  // received token1
  } else {
    delta0 = actualOutRaw;  // received token0
    delta1 = -amountInRaw;  // sent token1
  }

  const mask128 = (BigInt(1) << BigInt(128)) - BigInt(1);
  const packedDelta = ((delta0 & mask128) << BigInt(128)) | (delta1 & mask128);

  return {
    deltaHex: '0x' + packedDelta.toString(16).padStart(64, '0'),
    actualOut,
    actualOutRaw: actualOutRaw.toString(),
    slippagePct: simulatedSlippagePct,
    quotedOut,
    gasUsed: 152000 + Math.floor(Math.random() * 48000),
    txHash: '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
    blockNumber: 19400000 + Math.floor(Math.random() * 100000),
    effectivePrice: state.amountIn > 0 ? actualOut / state.amountIn : 0,
  };
}

// ── Render Functions ──
function renderQuoteInfo() {
  const amountIn = state.amountIn || 0;
  const quotedOut = getQuote(amountIn, state.tokenIn, state.tokenOut);
  const rate = amountIn > 0 ? quotedOut / amountIn : 0;
  const minOut = quotedOut * (1 - state.slippageTolerance / 100);
  const impact = amountIn > 0 ? (Math.random() * 0.03).toFixed(2) : '0.00';

  document.getElementById('amount-out').value = quotedOut > 0 ? quotedOut.toFixed(4) : '';
  document.getElementById('quote-rate').textContent = `1 ${state.tokenIn.symbol} = ${rate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${state.tokenOut.symbol}`;
  document.getElementById('quote-impact').textContent = `${impact}%`;
  document.getElementById('quote-min-received').textContent = `${minOut.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${state.tokenOut.symbol}`;
  document.getElementById('quote-fee').textContent = `~$${(2 + Math.random() * 2).toFixed(2)}`;

  document.getElementById('balance-in').textContent = `Balance: ${state.tokenIn.balance.toFixed(4)} ${state.tokenIn.symbol}`;
  document.getElementById('balance-out').textContent = `Balance: ${state.tokenOut.balance.toFixed(2)} ${state.tokenOut.symbol}`;
}

function renderTokenSelectors() {
  const inSel = document.getElementById('token-in-selector');
  const outSel = document.getElementById('token-out-selector');

  document.getElementById('token-in-icon').className = `token-icon ${state.tokenIn.iconClass}`;
  document.getElementById('token-in-icon').textContent = state.tokenIn.icon;
  document.getElementById('token-in-symbol').textContent = state.tokenIn.symbol;

  document.getElementById('token-out-icon').className = `token-icon ${state.tokenOut.iconClass}`;
  document.getElementById('token-out-icon').textContent = state.tokenOut.icon;
  document.getElementById('token-out-symbol').textContent = state.tokenOut.symbol;
}

function renderEncoding() {
  const encoded = encodeUniversalRouterSwap();

  const modeName = state.swapMode === 'single' ? 'SWAP_EXACT_IN_SINGLE (0x06)' : 'SWAP_EXACT_IN (0x07)';

  document.getElementById('encoding-commands').innerHTML =
    `<span class="comment">// UniversalRouter command</span>\n` +
    `<span class="keyword">Commands</span>.<span class="type">V4_SWAP</span> = <span class="value">0x${V4_SWAP_COMMAND.toString(16).padStart(2, '0')}</span>\n` +
    `<span class="keyword">Action</span>: <span class="accent">${modeName}</span>\n\n` +
    `<span class="comment">// Encoded command bytes</span>\n` +
    `<span class="value">${encoded.commands}</span>`;

  const amountInFormatted = state.amountIn;
  const minOutFormatted = encoded.minOut.toFixed(4);

  let paramsExplain;
  if (state.swapMode === 'single') {
    const [c0, c1] = sortAddresses(state.tokenIn.address, state.tokenOut.address);
    const zfo = BigInt(state.tokenIn.address) < BigInt(state.tokenOut.address);
    paramsExplain =
      `<span class="comment">// ExactInputSingleParams</span>\n` +
      `<span class="keyword">struct</span> {\n` +
      `  <span class="type">PoolKey</span> poolKey:\n` +
      `    currency0:    <span class="value">${c0.slice(0, 10)}...${c0.slice(-6)}</span>\n` +
      `    currency1:    <span class="value">${c1.slice(0, 10)}...${c1.slice(-6)}</span>\n` +
      `    hooks:        <span class="value">${HOOKS_ADDRESS}</span>\n` +
      `    poolManager:  <span class="value">${POOL_MANAGER.slice(0, 10)}...${POOL_MANAGER.slice(-6)}</span>\n` +
      `    fee:          <span class="value">${POOL_FEE}</span> <span class="comment">// ${(POOL_FEE / 10000).toFixed(2)}%</span>\n` +
      `    tickSpacing:  <span class="value">${POOL_TICK_SPACING}</span>\n` +
      `  <span class="type">bool</span>   zeroForOne:      <span class="value">${zfo}</span>\n` +
      `  <span class="type">uint128</span> amountIn:        <span class="value">${amountInFormatted} ${state.tokenIn.symbol}</span>\n` +
      `  <span class="type">uint128</span> amountOutMinimum: <span class="value">${minOutFormatted} ${state.tokenOut.symbol}</span>\n` +
      `  <span class="type">bytes</span>   hookData:         <span class="value">0x</span>\n` +
      `}`;
  } else {
    paramsExplain =
      `<span class="comment">// ExactInputParams (multi-hop)</span>\n` +
      `<span class="keyword">struct</span> {\n` +
      `  <span class="type">bytes</span>   path:            <span class="value">${state.multiHopPath.map(h => h.from).join(' → ')} → ${state.multiHopPath[state.multiHopPath.length - 1].to}</span>\n` +
      `  <span class="type">uint128</span> amountIn:        <span class="value">${amountInFormatted} ${state.tokenIn.symbol}</span>\n` +
      `  <span class="type">uint128</span> amountOutMinimum: <span class="value">${minOutFormatted} ${state.tokenOut.symbol}</span>\n` +
      `  <span class="type">bytes</span>   hookData:         <span class="value">0x</span>\n` +
      `}`;
  }

  document.getElementById('encoding-inputs').innerHTML = paramsExplain;

  document.getElementById('encoding-calldata').innerHTML =
    `<span class="comment">// execute(commands, inputs, deadline)</span>\n` +
    `<span class="value">${encoded.calldata.slice(0, 66)}</span><span class="accent">...</span>\n\n` +
    `<span class="comment">// Decoded:</span>\n` +
    `<span class="keyword">commands</span>[0] = <span class="value">${encoded.commandByte}</span> <span class="comment">// V4_SWAP</span>\n` +
    `<span class="keyword">inputs</span>[0]  = <span class="comment">ABI-encoded ${state.swapMode === 'single' ? 'ExactInputSingleParams' : 'ExactInputParams'}</span>\n` +
    `<span class="keyword">deadline</span>  = <span class="value">${encoded.deadline}</span>`;
}

function renderFlowSteps() {
  const steps = [
    {
      title: 'UniversalRouter.execute()',
      desc: 'Entry point. Receives commands bytes and inputs array. Dispatches each (command, action, input) tuple.',
      detail: `execute(commands=[0x${V4_SWAP_COMMAND.toString(16)}], inputs=[encoded params], deadline=${Math.floor(Date.now() / 1000) + 600})`,
    },
    {
      title: 'Command dispatch: V4_SWAP (0x10)',
      desc: 'UniversalRouter identifies the V4_SWAP command and routes to _executeV4Swap(). The action byte determines EXACT_IN_SINGLE vs EXACT_IN.',
      detail: `action = ${state.swapMode === 'single' ? 'SWAP_EXACT_IN_SINGLE (0x06)' : 'SWAP_EXACT_IN (0x07)'}`,
    },
    {
      title: 'V4Router._swapExactInputSingle()',
      desc: 'Unwraps the PoolKey from calldata. Computes the pool id via PoolManager.getPoolAndTickBitmap(). Calls poolManager.swap() with the resolved parameters.',
      detail: `PoolKey(${state.tokenIn.symbol}, ${state.tokenOut.symbol}, hooks=0x0, fee=${POOL_FEE})\nzeroForOne=${BigInt(state.tokenIn.address) < BigInt(state.tokenOut.address)}\namountIn=${state.amountIn} ${state.tokenIn.symbol}`,
    },
    {
      title: 'PoolManager.swap()',
      desc: 'Executes the swap in the Pool. Computes the new tick, updates liquidity, applies any hook modifications, and settles the balance delta.',
      detail: 'settles via _settle() → transfers tokens from router to pool manager\nuses AccountLocking for flash accounting',
    },
    {
      title: 'BalanceDelta settlement',
      desc: 'The PoolManager returns a BalanceDelta (packed int256). The V4Router decodes it and returns the settlement amounts to the caller.',
      detail: 'BalanceDelta = int256(abi.encodePacked(int128 delta0, int128 delta1))\nPositive = pool received, Negative = pool sent',
    },
    {
      title: 'Token settlement',
      desc: 'UniversalRouter calls settle() for input tokens (pull from user) and take() for output tokens (push to recipient). Uses ERC-6909 claims.',
      detail: `settle: ${state.tokenIn.symbol} (user → PoolManager)\ntake: ${state.tokenOut.symbol} (PoolManager → user)`,
    },
  ];

  const container = document.getElementById('flow-steps');
  container.innerHTML = steps.map((step, i) => `
    <div class="flow-step">
      <div class="flow-step-line">
        <div class="flow-step-dot" style="${i > 1 ? 'background: var(--green-400);' : ''}${i > 3 ? 'background: var(--blue-400);' : ''}"></div>
        ${i < steps.length - 1 ? '<div class="flow-step-connector"></div>' : ''}
      </div>
      <div class="flow-step-content">
        <div class="flow-step-title">${step.title}</div>
        <div class="flow-step-desc">${step.desc}</div>
        <div class="flow-step-detail">${step.detail}</div>
      </div>
    </div>
  `).join('');
}

function renderResults(sim) {
  const delta = decodeBalanceDelta(BigInt(sim.deltaHex));
  const [c0, c1] = sortAddresses(state.tokenIn.address, state.tokenOut.address);
  const tokenC0 = TOKENS.find(t => t.address === c0) || state.tokenIn;
  const tokenC1 = TOKENS.find(t => t.address === c1) || state.tokenOut;

  const d0Float = Number(delta.amount0) / (10 ** tokenC0.decimals);
  const d1Float = Number(delta.amount1) / (10 ** tokenC1.decimals);

  document.getElementById('result-delta-grid').innerHTML = `
    <div class="result-item">
      <div class="result-item-label">Delta ${tokenC0.symbol} (amount0)</div>
      <div class="result-item-value ${d0Float >= 0 ? 'positive' : 'negative'}">
        ${d0Float >= 0 ? '+' : ''}${d0Float.toFixed(6)}
      </div>
      <div class="result-item-sub">${tokenC0.address.slice(0, 10)}...</div>
    </div>
    <div class="result-item">
      <div class="result-item-label">Delta ${tokenC1.symbol} (amount1)</div>
      <div class="result-item-value ${d1Float >= 0 ? 'positive' : 'negative'}">
        ${d1Float >= 0 ? '+' : ''}${d1Float.toFixed(6)}
      </div>
      <div class="result-item-sub">${tokenC1.address.slice(0, 10)}...</div>
    </div>
    <div class="result-item full-width">
      <div class="result-item-label">Raw BalanceDelta (int256)</div>
      <div class="result-item-value" style="font-size: 12px; word-break: break-all;">
        ${sim.deltaHex}
      </div>
    </div>
    <div class="result-item">
      <div class="result-item-label">Gas Used</div>
      <div class="result-item-value" style="color: var(--text-secondary);">${sim.gasUsed.toLocaleString()}</div>
    </div>
    <div class="result-item">
      <div class="result-item-label">Effective Price</div>
      <div class="result-item-value" style="color: var(--blue-400);">
        ${sim.effectivePrice.toFixed(2)} ${state.tokenOut.symbol}/${state.tokenIn.symbol}
      </div>
    </div>
  `;

  // Slippage
  const slippagePct = sim.slippagePct;
  const tolerancePct = state.slippageTolerance;
  const slippageRatio = slippagePct / tolerancePct;
  const slippageClass = slippageRatio < 0.3 ? 'good' : slippageRatio < 0.7 ? 'warn' : 'bad';
  const barWidth = Math.min(100, (slippagePct / tolerancePct) * 100);

  document.getElementById('slippage-bar-wrap').innerHTML = `
    <div class="slippage-bar-header">
      <span class="slippage-bar-label">Realized Slippage vs Tolerance</span>
      <span class="slippage-bar-value ${slippageClass}">${slippagePct.toFixed(3)}%</span>
    </div>
    <div class="slippage-bar-track">
      <div class="slippage-bar-fill ${slippageClass}" style="width: ${barWidth}%;"></div>
    </div>
    <div class="slippage-bar-markers">
      <span>0%</span>
      <span>${(tolerancePct / 2).toFixed(1)}%</span>
      <span>${tolerancePct}% (tol.)</span>
    </div>
    <div style="margin-top: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
      <div class="result-item" style="padding: 10px;">
        <div class="result-item-label">Quoted</div>
        <div class="result-item-value" style="font-size: 14px;">${sim.quotedOut.toFixed(4)} ${state.tokenOut.symbol}</div>
      </div>
      <div class="result-item" style="padding: 10px;">
        <div class="result-item-label">Realized</div>
        <div class="result-item-value ${slippageClass}" style="font-size: 14px;">${sim.actualOut.toFixed(4)} ${state.tokenOut.symbol}</div>
      </div>
    </div>
  `;

  // Tx Log
  document.getElementById('tx-log').innerHTML = `
    <div class="tx-log-item">
      <span class="tx-log-time">now</span>
      <div class="tx-log-body">
        <div class="tx-log-desc">V4 Swap: ${state.amountIn} ${state.tokenIn.symbol} → ${sim.actualOut.toFixed(4)} ${state.tokenOut.symbol}</div>
        <div class="tx-log-hash">tx: ${sim.txHash.slice(0, 18)}...${sim.txHash.slice(-8)}</div>
        <div class="tx-log-hash">block: ${sim.blockNumber.toLocaleString()}</div>
      </div>
    </div>
  `;
}

function renderPathSection() {
  const section = document.getElementById('path-section');
  if (state.swapMode === 'multi') {
    section.classList.remove('hidden');
    const hopsEl = document.getElementById('path-hops');
    hopsEl.innerHTML = state.multiHopPath.map(h => `
      <div class="path-hop">
        <span class="path-hop-token">${h.from}</span>
        <span class="path-hop-arrow">→</span>
        <span class="path-hop-token">${h.to}</span>
        <span class="path-hop-pool">${(h.fee / 10000).toFixed(2)}% fee</span>
      </div>
    `).join('');
  } else {
    section.classList.add('hidden');
  }
}

function renderTokenDropdown() {
  const list = document.getElementById('token-dropdown-list');
  const search = (document.getElementById('token-search').value || '').toLowerCase();
  const filtered = TOKENS.filter(t =>
    t.symbol.toLowerCase().includes(search) ||
    t.name.toLowerCase().includes(search) ||
    t.address.toLowerCase().includes(search)
  );

  list.innerHTML = filtered.map(t => `
    <div class="token-dropdown-item" onclick="selectToken('${t.symbol}')">
      <span class="token-icon ${t.iconClass}">${t.icon}</span>
      <div class="token-dropdown-item-info">
        <div class="token-dropdown-item-symbol">${t.symbol}</div>
        <div class="token-dropdown-item-name">${t.name}</div>
      </div>
      <span class="token-dropdown-item-balance">${t.balance.toFixed(4)}</span>
    </div>
  `).join('');
}

// ── Event Handlers ──
window.setSwapMode = function(mode) {
  state.swapMode = mode;
  document.querySelectorAll('.mode-toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  renderPathSection();
  renderQuoteInfo();
  renderEncoding();
  renderFlowSteps();
};

window.onAmountChange = function() {
  const val = parseFloat(document.getElementById('amount-in').value) || 0;
  state.amountIn = val;
  renderQuoteInfo();
  renderEncoding();
};

window.swapTokens = function() {
  const temp = state.tokenIn;
  state.tokenIn = state.tokenOut;
  state.tokenOut = temp;
  renderTokenSelectors();
  renderQuoteInfo();
  renderEncoding();
  renderFlowSteps();
};

window.setSlippage = function(val, btn) {
  state.slippageTolerance = val;
  document.querySelectorAll('.slippage-preset').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderQuoteInfo();
  renderEncoding();
};

window.setSlippageCustom = function(val) {
  const num = parseFloat(val);
  if (num > 0 && num <= 50) {
    state.slippageTolerance = num;
    document.querySelectorAll('.slippage-preset').forEach(b => b.classList.remove('active'));
    renderQuoteInfo();
    renderEncoding();
  }
};

window.openTokenDropdown = function(target) {
  state.dropdownTarget = target;
  document.getElementById('token-dropdown-overlay').classList.remove('hidden');
  document.getElementById('token-search').value = '';
  renderTokenDropdown();
  document.getElementById('token-search').focus();
};

window.closeTokenDropdown = function(e) {
  if (e && e.target !== document.getElementById('token-dropdown-overlay')) return;
  document.getElementById('token-dropdown-overlay').classList.add('hidden');
  state.dropdownTarget = null;
};

window.selectToken = function(symbol) {
  const token = TOKENS.find(t => t.symbol === symbol);
  if (!token) return;
  if (state.dropdownTarget === 'in') {
    if (token.symbol === state.tokenOut.symbol) {
      state.tokenOut = state.tokenIn;
    }
    state.tokenIn = token;
  } else {
    if (token.symbol === state.tokenIn.symbol) {
      state.tokenIn = state.tokenOut;
    }
    state.tokenOut = token;
  }
  closeTokenDropdown();
  renderTokenSelectors();
  renderQuoteInfo();
  renderEncoding();
  renderFlowSteps();
  renderPathSection();
};

window.filterTokens = function(val) {
  renderTokenDropdown();
};

window.togglePanel = function(name) {
  state.panelState[name] = !state.panelState[name];
  const body = document.getElementById(`${name}-body`);
  const chevron = document.getElementById(`${name}-chevron`);
  body.classList.toggle('collapsed', !state.panelState[name]);
  chevron.classList.toggle('open', state.panelState[name]);
};

window.setResultTab = function(tab) {
  state.resultTab = tab;
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.toLowerCase().includes(tab));
  });
  ['delta', 'slippage', 'log'].forEach(t => {
    const el = document.getElementById(`result-tab-${t}`);
    if (el) el.classList.toggle('hidden', t !== tab);
  });
};

window.addHop = function() {
  const tokens = ['ETH', 'USDC', 'WBTC', 'USDT', 'ARB'];
  const lastTo = state.multiHopPath[state.multiHopPath.length - 1].to;
  const nextIdx = (tokens.indexOf(lastTo) + 1) % tokens.length;
  const fees = [500, 3000, 10000];
  state.multiHopPath.push({
    from: lastTo,
    to: tokens[nextIdx],
    fee: fees[Math.floor(Math.random() * fees.length)],
  });
  renderPathSection();
  renderEncoding();
};

window.executeSwap = function() {
  const btn = document.getElementById('swap-btn');
  btn.disabled = true;
  btn.textContent = 'Encoding...';

  renderEncoding();

  setTimeout(() => {
    btn.textContent = 'Executing...';

    setTimeout(() => {
      const encoded = encodeUniversalRouterSwap();
      const sim = simulateSwap(encoded);

      state.executedSwaps.push(sim);

      // Show results panel
      document.getElementById('results-panel').classList.remove('hidden');
      state.panelState.results = true;
      document.getElementById('results-body').classList.remove('collapsed');
      document.getElementById('results-chevron').classList.add('open');

      renderResults(sim);

      btn.disabled = false;
      btn.textContent = 'Encode & Execute Swap';

      // Show flow panel too
      if (!state.panelState.flow) {
        togglePanel('flow');
      }
    }, 800);
  }, 600);
};

// ── Initialize ──
function init() {
  renderTokenSelectors();
  renderQuoteInfo();
  renderEncoding();
  renderFlowSteps();
  renderPathSection();
}

init();
