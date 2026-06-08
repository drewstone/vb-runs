import { useAccount, useConnect, useDisconnect } from "wagmi";
import type { FC } from "react";

const WalletButton: FC = () => {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    const short = `${address.slice(0, 6)}...${address.slice(-4)}`;
    return (
      <button
        className="wallet-btn connected"
        onClick={() => disconnect()}
        title={`Connected: ${address}`}
        type="button"
      >
        <span className="wallet-dot" />
        {short}
      </button>
    );
  }

  return (
    <button
      className="wallet-btn"
      onClick={() => {
        const injected = connectors.find((c) => c.id === "injected");
        if (injected) connect({ connector: injected });
      }}
      type="button"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <circle cx="12" cy="12" r="2" />
      </svg>
      Connect Wallet
    </button>
  );
};

export default WalletButton;
