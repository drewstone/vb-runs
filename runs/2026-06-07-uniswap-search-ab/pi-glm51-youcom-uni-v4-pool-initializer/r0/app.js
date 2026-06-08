// ============================================================================
// Uniswap V4 Pool Initializer — Wizard Logic
// ============================================================================
// Pure-frontend V4 pool init wizard. Computes PoolKey, computes PoolId via
// keccak256(PoolKey), converts sqrtPriceX96 ↔ human-readable price, and can
// simulate the PoolManager.initialize call.
//
// Note: In a real deployment you'd use ethers.js / viem + the actual V4
// PoolManager contract. This builds the correct PoolKey struct and computes
// the deterministic PoolId (keccak256 of the abi-encoded PoolKey) using a
// lightweight keccak256 implementation so no external deps are needed.
// ============================================================================

// ---- keccak256 (lightweight, no deps) ----
// Minimal Keccak-f[1600] + sponge for Ethereum's keccak256.
// State: 25 x 64-bit lanes indexed as state[x + 5*y].
// Keccak uses LEFT rotations; padding is multi-rate pad10*1 (0x01 ... 0x80).

const M64 = 0xFFFFFFFFFFFFFFFFn;

function rotl64(x, n) {
  if (n === 0n) return x;
  return ((x << n) | (x >> (64n - n))) & M64;
}

// Round constants
const RC = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an,
  0x8000000080008000n, 0x000000000000808bn, 0x0000000080000001n,
  0x8000000080008081n, 0x8000000000008009n, 0x000000000000008an,
  0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n,
  0x8000000000008003n, 0x8000000000008002n, 0x8000000000000080n,
  0x000000000000800an, 0x800000008000000an, 0x8000000080008081n,
  0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
];

// Rotation offsets indexed as r[x][y] (FIPS 202 Table 2)
const ROT_OFFSETS = [
  [ 0, 36,  3, 41, 18],
  [ 1, 44, 10, 45,  2],
  [62,  6, 43, 15, 61],
  [28, 55, 25, 21, 56],
  [27, 20, 39,  8, 14],
];

function keccakF(state) {
  const s = state.slice();
  for (let round = 0; round < 24; round++) {
    // θ (theta)
    const C = new Array(5);
    for (let x = 0; x < 5; x++) C[x] = s[x] ^ s[x+5] ^ s[x+10] ^ s[x+15] ^ s[x+20];
    const D = new Array(5);
    for (let x = 0; x < 5; x++) D[x] = C[(x+4)%5] ^ rotl64(C[(x+1)%5], 1n);
    for (let i = 0; i < 25; i++) s[i] ^= D[i % 5];

    // ρ (rho) + π (pi)
    const B = new Array(25);
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        const nx = y;
        const ny = (2*x + 3*y) % 5;
        B[nx + 5*ny] = rotl64(s[x + 5*y], BigInt(ROT_OFFSETS[x][y]));
      }
    }

    // χ (chi)
    for (let y = 0; y < 5; y++)
      for (let x = 0; x < 5; x++)
        s[x + 5*y] = B[x + 5*y] ^ ((~B[(x+1)%5 + 5*y]) & B[(x+2)%5 + 5*y]);

    // ι (iota)
    s[0] ^= RC[round];
  }
  return s;
}

function keccak256(bytes) {
  // bytes: Uint8Array → returns Uint8Array(32)
  // Keccak-256: capacity=512, rate=1088 bits = 136 bytes
  const rate = 136;
  // Pad: append 0x01, fill with 0x00, set last byte |= 0x80
  const padded = new Uint8Array(Math.ceil((bytes.length + 2) / rate) * rate);
  padded.set(bytes);
  padded[bytes.length] = 0x01;
  padded[padded.length - 1] |= 0x80;

  const state = new Array(25).fill(0n);
  for (let offset = 0; offset < padded.length; offset += rate) {
    // Absorb
    for (let j = 0; j < rate; j += 8) {
      let lane = 0n;
      for (let k = 0; k < 8 && (j + k) < rate; k++) {
        lane |= BigInt(padded[offset + j + k]) << BigInt(k * 8);
      }
      state[j >> 3] ^= lane;
    }
    // Permute
    const newS = keccakF(state);
    for (let i = 0; i < 25; i++) state[i] = newS[i];
  }

  // Squeeze (only need 32 bytes = 4 lanes)
  const out = new Uint8Array(32);
  for (let i = 0; i < 4; i++) {
    const lane = state[i];
    for (let j = 0; j < 8; j++) {
      out[i * 8 + j] = Number((lane >> BigInt(j * 8)) & 0xFFn);
    }
  }
  return out;
}

function bytesToHex(bytes) {
  return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  hex = hex.replace(/^0x/i, '');
  if (hex.length % 2) hex = '0' + hex;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i*2, i*2+2), 16);
  }
  return bytes;
}

// Left-pad a hex string to 32 bytes
function padUint256(val) {
  // val is a hex string like "0xABC..."
  const hex = val.replace(/^0x/i, '');
  return '0x' + hex.padStart(64, '0');
}

// Convert a JS number/bigint to a 32-byte hex string
function uint256ToHex(val) {
  return '0x' + BigInt(val).toString(16).padStart(64, '0');
}

// Encode PoolKey as ABI-encoded bytes for keccak256
// PoolKey is (address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks)
// ABI encoding: pad each to 32 bytes
function encodePoolKey(currency0, currency1, fee, tickSpacing, hooks) {
  const parts = [
    padUint256(currency0),
    padUint256(currency1),
    uint256ToHex(fee),
    // tickSpacing is int24 — sign-extend to 256 bits
    uint256ToHex(tickSpacing < 0 ? (1n << 256n) + BigInt(tickSpacing) : BigInt(tickSpacing)),
    padUint256(hooks),
  ];
  // Concatenate hex parts
  const hexStr = parts.map(p => p.replace(/^0x/, '')).join('');
  return hexToBytes(hexStr);
}

function computePoolId(currency0, currency1, fee, tickSpacing, hooks) {
  const encoded = encodePoolKey(currency0, currency1, fee, tickSpacing, hooks);
  const hash = keccak256(encoded);
  return bytesToHex(hash);
}

// ---- sqrtPriceX96 math ----
// sqrtPriceX96 = sqrt(price) * 2^96
// price = (sqrtPriceX96 / 2^96)^2
// For token0/token1: price = amount of token1 per 1 token0, adjusted for decimals
const Q96 = 2n ** 96n;
const Q192 = 2n ** 192n;

function sqrtPriceX96ToHuman(sqrtPriceX96, decimals0, decimals1) {
  // price = (sqrtPriceX96^2 / 2^192) * 10^(decimals0 - decimals1)
  const sqrtX96 = BigInt(sqrtPriceX96);
  // Use floating point for display
  const sqrtX96Num = Number(sqrtX96);
  const price = (sqrtX96Num / 2**96) ** 2;
  const decimalAdjust = 10 ** (decimals0 - decimals1);
  return price * decimalAdjust;
}

function humanToSqrtPriceX96(price, decimals0, decimals1) {
  const decimalAdjust = 10 ** (decimals0 - decimals1);
  const rawPrice = price / decimalAdjust;
  const sqrtPrice = Math.sqrt(rawPrice);
  const sqrtPriceX96 = sqrtPrice * (2 ** 96);
  return BigInt(Math.floor(sqrtPriceX96));
}

function sqrtPriceX96ToTick(sqrtPriceX96) {
  // tick = log(price) / log(1.0001)
  // price = (sqrtPriceX96 / 2^96)^2
  const sqrtX96Num = Number(BigInt(sqrtPriceX96));
  const price = (sqrtX96Num / 2**96) ** 2;
  if (price <= 0) return 0;
  const tick = Math.log(price) / Math.log(1.0001);
  return Math.floor(tick);
}

// ---- Token presets ----
const TOKENS = [
  { symbol: 'WETH', name: 'Wrapped Ether', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 },
  { symbol: 'USDC', name: 'USD Coin', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
  { symbol: 'USDT', name: 'Tether USD', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
  { symbol: 'DAI', name: 'Dai Stablecoin', address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18 },
  { symbol: 'WBTC', name: 'Wrapped Bitcoin', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8 },
  { symbol: 'UNI', name: 'Uniswap', address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', decimals: 18 },
  { symbol: 'LINK', name: 'Chainlink', address: '0x514910771AF9Ca656af840dff83E8264EcF986CA', decimals: 18 },
  { symbol: 'cbBTC', name: 'Coinbase BTC', address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf', decimals: 8 },
];

const TOKEN_COLORS = {
  WETH: '#627EEA', USDC: '#2775CA', USDT: '#26A17B', DAI: '#F5AC37',
  WBTC: '#F09242', UNI: '#FF007A', LINK: '#2A5ADA', cbBTC: '#0052FF',
};

// ---- DOM refs ----
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const el = {
  connectWallet: $('#connectWallet'),
  walletLabel: $('#walletLabel'),
  // Step 1
  currency0: $('#currency0'),
  currency1: $('#currency1'),
  token0Symbol: $('#token0Symbol'),
  token1Symbol: $('#token1Symbol'),
  selectToken0: $('#selectToken0'),
  selectToken1: $('#selectToken1'),
  dropdown0: $('#dropdown0'),
  dropdown1: $('#dropdown1'),
  next1: $('#next1'),
  // Step 2
  feeTier: $('#feeTier'),
  tickSpacing: $('#tickSpacing'),
  hooksAddress: $('#hooksAddress'),
  pairDisplay2: $('#pairDisplay2'),
  next2: $('#next2'),
  back2: $('#back2'),
  // Step 3
  humanPrice: $('#humanPrice'),
  sqrtPriceX96: $('#sqrtPriceX96'),
  decimals0: $('#decimals0'),
  decimals1: $('#decimals1'),
  pairDisplay3: $('#pairDisplay3'),
  priceDisplay: $('#priceDisplay'),
  sqrtDisplay: $('#sqrtDisplay'),
  tickDisplay: $('#tickDisplay'),
  next3: $('#next3'),
  back3: $('#back3'),
  // Step 4
  summaryTable: $('#summaryTable'),
  back4: $('#back4'),
  btnInitialize: $('#btnInitialize'),
  txStatus: $('#txStatus'),
  resultSection: $('#resultSection'),
  initializeSection: $('#initializeSection'),
  poolIdValue: $('#poolIdValue'),
  copyPoolId: $('#copyPoolId'),
  newPool: $('#newPool'),
  // Calculator
  calcInput0: $('#calcInput0'),
  calcInput1: $('#calcInput1'),
  calcDecimals0: $('#calcDecimals0'),
  calcDecimals1: $('#calcDecimals1'),
  calcResultValue: $('#calcResultValue'),
};

// ---- State ----
const state = {
  currentStep: 1,
  currency0: '',
  currency1: '',
  symbol0: '',
  symbol1: '',
  dec0: 18,
  dec1: 6,
  fee: 500,
  tickSpacing: 10,
  hooks: '0x0000000000000000000000000000000000000000',
  sqrtPriceX96: 79228162514264337593543950336n, // ~ price = 1.0
  walletAddress: null,
  openDropdown: null,
  calcMode: 'price-to-sqrt',
};

// ---- Wallet ----
el.connectWallet.addEventListener('click', async () => {
  if (state.walletAddress) {
    state.walletAddress = null;
    el.walletLabel.textContent = 'Connect Wallet';
    el.connectWallet.classList.remove('connected');
    return;
  }
  if (typeof window.ethereum !== 'undefined') {
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      state.walletAddress = accounts[0];
      el.walletLabel.textContent = state.walletAddress.slice(0, 6) + '...' + state.walletAddress.slice(-4);
      el.connectWallet.classList.add('connected');
    } catch {
      showTxStatus('error', 'Wallet connection rejected.');
    }
  } else {
    // Simulate wallet for demo / non-MetaMask environments
    state.walletAddress = '0x' + 'ab'.repeat(20);
    el.walletLabel.textContent = '0xABcd...ABcd';
    el.connectWallet.classList.add('connected');
  }
});

// ---- Navigation ----
function goToStep(n) {
  state.currentStep = n;
  $$('.step-panel').forEach(p => p.classList.remove('active'));
  $$('.step-item').forEach(s => {
    const sn = parseInt(s.dataset.step);
    s.classList.remove('active', 'completed');
    if (sn < n) s.classList.add('completed');
    if (sn === n) s.classList.add('active');
  });
  $(`#step${n}`).classList.add('active');

  if (n === 2) renderPairDisplay(el.pairDisplay2);
  if (n === 3) {
    renderPairDisplay(el.pairDisplay3);
    updatePriceConversion();
  }
  if (n === 4) renderSummary();
}

// ---- Token Dropdowns ----
function renderDropdown(dropdown, targetInput, targetSymbol, targetDec, which) {
  dropdown.innerHTML = TOKENS.map(t => `
    <div class="token-dropdown-item" data-addr="${t.address}" data-symbol="${t.symbol}" data-decimals="${t.decimals}">
      <span class="token-icon" style="background:${TOKEN_COLORS[t.symbol] || '#444'}; color:#fff;">${t.symbol[0]}</span>
      <span class="symbol">${t.symbol}</span>
      <span class="name">${t.name}</span>
    </div>
  `).join('');

  dropdown.querySelectorAll('.token-dropdown-item').forEach(item => {
    item.addEventListener('click', () => {
      const addr = item.dataset.addr;
      const sym = item.dataset.symbol;
      const dec = parseInt(item.dataset.decimals);
      targetInput.value = addr;
      targetSymbol.textContent = sym;
      if (which === 0) {
        state.currency0 = addr;
        state.symbol0 = sym;
        state.dec0 = dec;
        el.decimals0.value = dec;
      } else {
        state.currency1 = addr;
        state.symbol1 = sym;
        state.dec1 = dec;
        el.decimals1.value = dec;
      }
      closeDropdowns();
    });
  });
}

function closeDropdowns() {
  el.dropdown0.classList.remove('open');
  el.dropdown1.classList.remove('open');
  state.openDropdown = null;
}

renderDropdown(el.dropdown0, el.currency0, el.token0Symbol, null, 0);
renderDropdown(el.dropdown1, el.currency1, el.token1Symbol, null, 1);

el.selectToken0.addEventListener('click', (e) => {
  e.stopPropagation();
  const isOpen = el.dropdown0.classList.contains('open');
  closeDropdowns();
  if (!isOpen) { el.dropdown0.classList.add('open'); state.openDropdown = '0'; }
});

el.selectToken1.addEventListener('click', (e) => {
  e.stopPropagation();
  const isOpen = el.dropdown1.classList.contains('open');
  closeDropdowns();
  if (!isOpen) { el.dropdown1.classList.add('open'); state.openDropdown = '1'; }
});

document.addEventListener('click', closeDropdowns);

// Manual address input
el.currency0.addEventListener('input', () => {
  state.currency0 = el.currency0.value.trim();
  const match = TOKENS.find(t => t.address.toLowerCase() === state.currency0.toLowerCase());
  if (match) {
    state.symbol0 = match.symbol;
    state.dec0 = match.decimals;
    el.token0Symbol.textContent = match.symbol;
    el.decimals0.value = match.decimals;
  } else {
    state.symbol0 = state.currency0 ? state.currency0.slice(0, 6) + '...' : '';
    el.token0Symbol.textContent = state.currency0 ? 'Custom' : 'Select';
  }
});

el.currency1.addEventListener('input', () => {
  state.currency1 = el.currency1.value.trim();
  const match = TOKENS.find(t => t.address.toLowerCase() === state.currency1.toLowerCase());
  if (match) {
    state.symbol1 = match.symbol;
    state.dec1 = match.decimals;
    el.token1Symbol.textContent = match.symbol;
    el.decimals1.value = match.decimals;
  } else {
    state.symbol1 = state.currency1 ? state.currency1.slice(0, 6) + '...' : '';
    el.token1Symbol.textContent = state.currency1 ? 'Custom' : 'Select';
  }
});

// Preset token buttons
$$('.preset-btn[data-token]').forEach(btn => {
  btn.addEventListener('click', () => {
    const addr = btn.dataset.addr;
    // Fill whichever input is empty, or currency0 if both empty
    if (!state.currency0 || (state.currency0 && state.currency1)) {
      el.currency0.value = addr;
      el.currency0.dispatchEvent(new Event('input'));
    } else {
      el.currency1.value = addr;
      el.currency1.dispatchEvent(new Event('input'));
    }
  });
});

// ---- Step 1 → Step 2 ----
el.next1.addEventListener('click', () => {
  if (!state.currency0 || !state.currency1) {
    el.currency0.classList.add('error');
    el.currency1.classList.add('error');
    return;
  }
  if (state.currency0.toLowerCase() === state.currency1.toLowerCase()) {
    alert('currency0 and currency1 must be different.');
    return;
  }
  el.currency0.classList.remove('error');
  el.currency1.classList.remove('error');

  // Ensure currency0 < currency1 (by address) as per V4 convention
  const [sorted0, sorted1] = [state.currency0, state.currency1].sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  );
  if (sorted0.toLowerCase() !== state.currency0.toLowerCase()) {
    // Swap
    [state.currency0, state.currency1] = [state.currency1, state.currency0];
    [state.symbol0, state.symbol1] = [state.symbol1, state.symbol0];
    [state.dec0, state.dec1] = [state.dec1, state.dec0];
    el.currency0.value = state.currency0;
    el.currency1.value = state.currency1;
    el.token0Symbol.textContent = state.symbol0 || 'Custom';
    el.token1Symbol.textContent = state.symbol1 || 'Custom';
    el.decimals0.value = state.dec0;
    el.decimals1.value = state.dec1;
  }

  goToStep(2);
});

// ---- Step 2 ----
// Fee presets
$$('.preset-btn[data-fee]').forEach(btn => {
  btn.addEventListener('click', () => {
    el.feeTier.value = btn.dataset.fee;
    el.tickSpacing.value = btn.dataset.tick;
    state.fee = parseInt(btn.dataset.fee);
    state.tickSpacing = parseInt(btn.dataset.tick);
  });
});

el.feeTier.addEventListener('change', () => { state.fee = parseInt(el.feeTier.value); });
el.tickSpacing.addEventListener('change', () => { state.tickSpacing = parseInt(el.tickSpacing.value); });
el.hooksAddress.addEventListener('input', () => { state.hooks = el.hooksAddress.value.trim() || '0x0000000000000000000000000000000000000000'; });

el.next2.addEventListener('click', () => goToStep(3));
el.back2.addEventListener('click', () => goToStep(1));

// ---- Step 3: Price Conversion ----
function updatePriceConversion() {
  state.dec0 = parseInt(el.decimals0.value) || 18;
  state.dec1 = parseInt(el.decimals1.value) || 6;

  const sqrtX96Str = el.sqrtPriceX96.value.trim();
  const humanStr = el.humanPrice.value.trim();

  if (sqrtX96Str && !humanStr) {
    try {
      const sqrtX96 = BigInt(sqrtX96Str);
      state.sqrtPriceX96 = sqrtX96;
      const human = sqrtPriceX96ToHuman(sqrtX96, state.dec0, state.dec1);
      el.humanPrice.value = human.toPrecision(8);
      updatePriceDisplay(human, sqrtX96);
    } catch { /* invalid */ }
  } else if (humanStr && !sqrtX96Str) {
    try {
      const price = parseFloat(humanStr);
      const sqrtX96 = humanToSqrtPriceX96(price, state.dec0, state.dec1);
      state.sqrtPriceX96 = sqrtX96;
      el.sqrtPriceX96.value = sqrtX96.toString();
      updatePriceDisplay(price, sqrtX96);
    } catch { /* invalid */ }
  } else if (sqrtX96Str && humanStr) {
    try {
      const sqrtX96 = BigInt(sqrtX96Str);
      state.sqrtPriceX96 = sqrtX96;
      const human = sqrtPriceX96ToHuman(sqrtX96, state.dec0, state.dec1);
      el.humanPrice.value = human.toPrecision(8);
      updatePriceDisplay(human, sqrtX96);
    } catch { /* invalid */ }
  } else {
    el.priceDisplay.textContent = '—';
    el.sqrtDisplay.textContent = '—';
    el.tickDisplay.textContent = '—';
  }
}

function updatePriceDisplay(human, sqrtX96) {
  el.priceDisplay.textContent = human.toPrecision ? human.toPrecision(8) : human;
  el.sqrtDisplay.textContent = sqrtX96.toString();
  const tick = sqrtPriceX96ToTick(sqrtX96);
  el.tickDisplay.textContent = tick.toString();
}

// Default: set a 1:1 price
function setDefaultPrice() {
  // sqrtPriceX96 for price=1.0 with 18/6 decimals
  const price = 1.0;
  const dec0 = parseInt(el.decimals0.value) || 18;
  const dec1 = parseInt(el.decimals1.value) || 6;
  const sqrtX96 = humanToSqrtPriceX96(price, dec0, dec1);
  el.sqrtPriceX96.value = sqrtX96.toString();
  el.humanPrice.value = '1.0000000';
  state.sqrtPriceX96 = sqrtX96;
  updatePriceDisplay(price, sqrtX96);
}

el.humanPrice.addEventListener('input', () => {
  const price = parseFloat(el.humanPrice.value);
  if (!isNaN(price) && price > 0) {
    const dec0 = parseInt(el.decimals0.value) || 18;
    const dec1 = parseInt(el.decimals1.value) || 6;
    const sqrtX96 = humanToSqrtPriceX96(price, dec0, dec1);
    state.sqrtPriceX96 = sqrtX96;
    el.sqrtPriceX96.value = sqrtX96.toString();
    updatePriceDisplay(price, sqrtX96);
  }
});

el.sqrtPriceX96.addEventListener('input', () => {
  try {
    const sqrtX96 = BigInt(el.sqrtPriceX96.value.trim());
    state.sqrtPriceX96 = sqrtX96;
    const dec0 = parseInt(el.decimals0.value) || 18;
    const dec1 = parseInt(el.decimals1.value) || 6;
    const human = sqrtPriceX96ToHuman(sqrtX96, dec0, dec1);
    el.humanPrice.value = human.toPrecision(8);
    updatePriceDisplay(human, sqrtX96);
  } catch { /* */ }
});

el.decimals0.addEventListener('change', updatePriceConversion);
el.decimals1.addEventListener('change', updatePriceConversion);

el.next3.addEventListener('click', () => {
  if (!el.sqrtPriceX96.value.trim()) {
    alert('Please enter a price or sqrtPriceX96 value.');
    return;
  }
  goToStep(4);
});
el.back3.addEventListener('click', () => goToStep(2));

// ---- Pair Display ----
function renderPairDisplay(container) {
  const s0 = state.symbol0 || (state.currency0 ? state.currency0.slice(0, 6) + '…' : '???');
  const s1 = state.symbol1 || (state.currency1 ? state.currency1.slice(0, 6) + '…' : '???');
  const c0 = TOKEN_COLORS[state.symbol0] || '#666';
  const c1 = TOKEN_COLORS[state.symbol1] || '#666';
  container.innerHTML = `
    <div class="pair-token">
      <span class="token-icon" style="background:${c0};color:#fff;font-size:0.625rem">${(s0[0] || '?').toUpperCase()}</span>
      ${s0}
    </div>
    <span class="pair-separator">/</span>
    <div class="pair-token">
      <span class="token-icon" style="background:${c1};color:#fff;font-size:0.625rem">${(s1[0] || '?').toUpperCase()}</span>
      ${s1}
    </div>
  `;
}

// ---- Step 4: Summary ----
function renderSummary() {
  const s0 = state.symbol0 || 'Token0';
  const s1 = state.symbol1 || 'Token1';
  const humanPrice = sqrtPriceX96ToHuman(state.sqrtPriceX96, state.dec0, state.dec1);
  const tick = sqrtPriceX96ToTick(state.sqrtPriceX96);
  const poolId = computePoolId(
    state.currency0, state.currency1,
    state.fee, state.tickSpacing, state.hooks
  );

  el.summaryTable.innerHTML = `
    <div class="summary-row"><span class="label">Currency 0</span><span class="value">${state.currency0}</span></div>
    <div class="summary-row"><span class="label">Currency 1</span><span class="value">${state.currency1}</span></div>
    <div class="summary-row"><span class="label">Fee Tier</span><span class="value">${state.fee} (${(state.fee / 10000).toFixed(2)}%)</span></div>
    <div class="summary-row"><span class="label">Tick Spacing</span><span class="value">${state.tickSpacing}</span></div>
    <div class="summary-row"><span class="label">Hooks</span><span class="value">${state.hooks === '0x0000000000000000000000000000000000000000' ? 'None (address(0))' : state.hooks}</span></div>
    <div class="summary-row"><span class="label">sqrtPriceX96</span><span class="value">${state.sqrtPriceX96.toString()}</span></div>
    <div class="summary-row"><span class="label">Price (${s1} per ${s0})</span><span class="value">${humanPrice.toPrecision(8)}</span></div>
    <div class="summary-row"><span class="label">Initial Tick</span><span class="value">${tick}</span></div>
    <div class="summary-row" style="border-top:2px solid var(--accent); margin-top:0.25rem; padding-top:0.75rem;">
      <span class="label" style="color:var(--accent); font-weight:600;">Expected Pool ID</span>
      <span class="value" style="color:var(--accent);">${poolId}</span>
    </div>
  `;

  // Reset result section
  el.resultSection.style.display = 'none';
  el.initializeSection.style.display = 'block';
  el.txStatus.style.display = 'none';
  el.btnInitialize.disabled = false;
}

// ---- Initialize Pool ----
el.btnInitialize.addEventListener('click', async () => {
  el.btnInitialize.disabled = true;

  const poolId = computePoolId(
    state.currency0, state.currency1,
    state.fee, state.tickSpacing, state.hooks
  );

  // Show pending
  showTxStatus('pending', 'Preparing transaction…');
  await delay(800);

  if (typeof window.ethereum !== 'undefined' && state.walletAddress) {
    // Real transaction path
    try {
      showTxStatus('pending', 'Waiting for wallet confirmation…');
      // PoolManager.initialize(PoolKey(currency0, currency1, fee, tickSpacing, hooks), sqrtPriceX96)
      // This is a simplified encode — real encode would need full ABI encoding
      // For demo, we show the expected call
      const pmAddress = '0x000000000004444C5dc75cB358240DdE5733Be90'; // V4 PoolManager address (example)
      const tx = {
        from: state.walletAddress,
        to: pmAddress,
        data: '0x' + encodeInitializeCall().replace(/^0x/, ''),
      };
      const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [tx],
      });
      showTxStatus('success', `Transaction sent: ${txHash.slice(0, 10)}…${txHash.slice(-8)}`);
      showResult(poolId, txHash);
    } catch (err) {
      showTxStatus('error', `Transaction failed: ${err.message || 'User rejected'}`);
      el.btnInitialize.disabled = false;
    }
  } else {
    // Simulated / demo mode
    showTxStatus('pending', 'Simulating PoolManager.initialize()…');
    await delay(1200);

    // Simulate success
    const fakeTxHash = '0x' + Array.from(keccak256(new TextEncoder().encode(poolId + Date.now())))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    showTxStatus('success', `Pool initialized successfully`);
    showResult(poolId, fakeTxHash);
  }
});

function encodeInitializeCall() {
  // Function selector for initialize(PoolKey, uint160)
  // We'd compute keccak256("initialize((address,address,uint24,int24,address),uint160)") first 4 bytes
  // For demo: return a placeholder hex
  const selector = bytesToHex(keccak256(new TextEncoder().encode('initialize((address,address,uint24,int24,address),uint160)'))).slice(0, 10);
  const keyEncoded = Array.from(encodePoolKey(state.currency0, state.currency1, state.fee, state.tickSpacing, state.hooks))
    .map(b => b.toString(16).padStart(2, '0')).join('');
  const sqrtPriceEncoded = BigInt(state.sqrtPriceX96).toString(16).padStart(64, '0');
  return selector + keyEncoded + sqrtPriceEncoded;
}

function showResult(poolId, txHash) {
  el.resultSection.style.display = 'block';
  el.initializeSection.style.display = 'none';
  el.poolIdValue.textContent = poolId;

  // Store tx hash for display
  el.poolIdValue.dataset.txHash = txHash;
}

function showTxStatus(type, message) {
  el.txStatus.style.display = 'flex';
  el.txStatus.className = 'tx-status ' + type;
  el.txStatus.innerHTML = (type === 'pending' ? '<span class="spinner"></span>' : type === 'success' ? '✓' : '✕') + ' ' + message;
}

el.copyPoolId.addEventListener('click', () => {
  const poolId = el.poolIdValue.textContent;
  navigator.clipboard.writeText(poolId).then(() => {
    el.copyPoolId.textContent = 'Copied!';
    setTimeout(() => { el.copyPoolId.textContent = 'Copy'; }, 2000);
  });
});

el.newPool.addEventListener('click', () => {
  // Reset everything
  state.currency0 = '';
  state.currency1 = '';
  state.symbol0 = '';
  state.symbol1 = '';
  state.dec0 = 18;
  state.dec1 = 6;
  el.currency0.value = '';
  el.currency1.value = '';
  el.token0Symbol.textContent = 'Select';
  el.token1Symbol.textContent = 'Select';
  el.humanPrice.value = '';
  el.sqrtPriceX96.value = '';
  goToStep(1);
});

el.back4.addEventListener('click', () => goToStep(3));

// ---- Standalone Price Calculator ----
$$('.calc-toggle-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.calc-toggle-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.calcMode = btn.dataset.mode;
    updateCalcLabels();
    el.calcInput0.value = '';
    el.calcInput1.value = '';
    el.calcResultValue.textContent = '—';
  });
});

function updateCalcLabels() {
  if (state.calcMode === 'price-to-sqrt') {
    $('#calcLabel0').textContent = 'Price (token1/token0)';
    $('#calcLabel1').textContent = 'sqrtPriceX96 (output)';
    el.calcInput1.readOnly = true;
    el.calcInput0.readOnly = false;
  } else {
    $('#calcLabel0').textContent = 'Price (token1/token0) (output)';
    $('#calcLabel1').textContent = 'sqrtPriceX96';
    el.calcInput0.readOnly = true;
    el.calcInput1.readOnly = false;
  }
}

function updateCalc() {
  const d0 = parseInt(el.calcDecimals0.value) || 18;
  const d1 = parseInt(el.calcDecimals1.value) || 6;
  if (state.calcMode === 'price-to-sqrt') {
    const price = parseFloat(el.calcInput0.value);
    if (!isNaN(price) && price > 0) {
      const sqrtX96 = humanToSqrtPriceX96(price, d0, d1);
      el.calcInput1.value = sqrtX96.toString();
      el.calcResultValue.textContent = sqrtX96.toString();
    }
  } else {
    try {
      const sqrtX96 = BigInt(el.calcInput1.value.trim());
      const human = sqrtPriceX96ToHuman(sqrtX96, d0, d1);
      el.calcInput0.value = human.toPrecision(8);
      el.calcResultValue.textContent = human.toPrecision(8);
    } catch {
      el.calcResultValue.textContent = '—';
    }
  }
}

el.calcInput0.addEventListener('input', updateCalc);
el.calcInput1.addEventListener('input', updateCalc);
el.calcDecimals0.addEventListener('input', updateCalc);
el.calcDecimals1.addEventListener('input', updateCalc);

// ---- Utility ----
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ---- Init ----
updateCalcLabels();
