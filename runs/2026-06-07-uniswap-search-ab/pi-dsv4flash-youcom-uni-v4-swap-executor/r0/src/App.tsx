import type { FC } from "react";
import WalletButton from "./components/WalletButton";
import SwapCard from "./components/SwapCard";

const App: FC = () => {
  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-left">
          <div className="app-logo">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <polyline points="17 1 21 5 17 9" />
              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <polyline points="7 23 3 19 7 15" />
              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
            <span className="app-title">Uni V4 Swap</span>
          </div>
          <span className="app-subtitle">UniversalRouter V4 Swap Executor</span>
        </div>
        <WalletButton />
      </header>

      <main className="app-main">
        <div className="app-grid">
          <div className="app-left-panel">
            <SwapCard />
          </div>
          <div className="app-right-panel">
            <div className="info-card">
              <div className="info-card-header">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <span>How It Works</span>
              </div>
              <div className="info-card-body">
                <div className="info-step">
                  <span className="info-step-num">1</span>
                  <div className="info-step-content">
                    <strong>Encode Commands.V4_SWAP</strong>
                    <p>Select tokens and enter amount. The UI encodes your swap as a <code>V4_SWAP</code> command with the <code>SWAP_EXACT_IN_SINGLE</code> or <code>SWAP_EXACT_IN</code> action.</p>
                  </div>
                </div>
                <div className="info-step">
                  <span className="info-step-num">2</span>
                  <div className="info-step-content">
                    <strong>Set Swap Parameters</strong>
                    <p><code>amountIn</code>, <code>amountOutMinimum</code> (with your slippage), and the <code>PoolKey</code> (currency0, currency1, fee, tickSpacing, hooks).</p>
                  </div>
                </div>
                <div className="info-step">
                  <span className="info-step-num">3</span>
                  <div className="info-step-content">
                    <strong>Call execute() via UniversalRouter</strong>
                    <p>Router calls <code>execute(commands, inputs, deadline)</code> which routes through <code>V4Router._swapExactInputSingle</code> and returns a <code>BalanceDelta</code>.</p>
                  </div>
                </div>
                <div className="info-step">
                  <span className="info-step-num">4</span>
                  <div className="info-step-content">
                    <strong>Decode BalanceDelta</strong>
                    <p>Decode the <code>(int128 amount0, int128 amount1)</code> from the result and compare realized output vs quoted to see your actual slippage.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
