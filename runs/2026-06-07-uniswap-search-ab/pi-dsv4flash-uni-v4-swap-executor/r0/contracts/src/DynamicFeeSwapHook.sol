// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseHook} from "@uniswap/v4-periphery/src/utils/BaseHook.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {BalanceDelta, BalanceDeltaLibrary} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";

/// @title DynamicFeeSwapHook
/// @notice A V4 hook that implements beforeSwap and afterSwap with onlyPoolManager guard.
///         This hook adjusts the LP fee based on swap volume — larger swaps pay a slightly
///         higher fee to compensate LPs for the greater price impact. It also tracks and
///         emits the resulting BalanceDelta for off-chain consumption.
contract DynamicFeeSwapHook is BaseHook {
    using BalanceDeltaLibrary for BalanceDelta;

    event SwapProcessed(
        address indexed sender,
        PoolKey indexed poolKey,
        bool zeroForOne,
        int256 amountSpecified,
        BalanceDelta delta,
        uint24 effectiveFee
    );

    /// @notice The base LP fee in hundredths of a bip (e.g., 3000 = 0.3%)
    uint24 public constant BASE_FEE = 3000;
    /// @notice The fee multiplier applied for large swaps (10% of base fee)
    uint24 public constant LARGE_SWAP_FEE = 3300; // 0.33%
    /// @notice Threshold for a "large swap" in token0 units (denominated in 18 decimals)
    uint256 public constant LARGE_SWAP_THRESHOLD = 100_000e18;

    /// @notice Tracks total delta accumulated by the hook (for analytics)
    BalanceDelta public accumulatedDelta;

    constructor(IPoolManager _manager) BaseHook(_manager) {}

    /// @inheritdoc BaseHook
    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,
            afterSwap: true,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnsDelta: false,
            afterSwapReturnsDelta: false,
            afterAddLiquidityReturnsDelta: false,
            afterRemoveLiquidityReturnsDelta: false
        });
    }

    /// @notice Called before a swap executes. Validates swap params and can override
    ///         the LP fee for pools with dynamic fee support.
    /// @dev Only callable by PoolManager via onlyPoolManager guard (inherited from BaseHook)
    /// @return selector The function selector for the hook
    /// @return hookDelta The hook's delta in specified and unspecified currencies (zero here)
    /// @return feeOverride Optionally override LP fee (only honored for dynamic fee pools)
    function _beforeSwap(
        address sender,
        PoolKey calldata key,
        SwapParams calldata params,
        bytes calldata /*hookData*/
    ) internal override returns (bytes4, BeforeSwapDelta, uint24) {
        // Determine if this is a large swap to adjust fee
        // We use abs(amountSpecified) as a proxy for swap size
        uint256 absAmount = params.amountSpecified < 0
            ? uint256(-params.amountSpecified)
            : uint256(params.amountSpecified);

        uint24 feeOverride = absAmount >= LARGE_SWAP_THRESHOLD ? LARGE_SWAP_FEE : BASE_FEE;

        return (IHooks.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, feeOverride);
    }

    /// @notice Called after a swap executes. Emits the resulting BalanceDelta for
    ///         off-chain consumers to decode and display realized slippage.
    /// @dev Only callable by PoolManager via onlyPoolManager guard.
    /// @return selector The function selector for the hook
    /// @return hookDelta The hook's delta in unspecified currency (zero here — hook doesn't take tokens)
    function _afterSwap(
        address sender,
        PoolKey calldata key,
        SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata /*hookData*/
    ) internal override returns (bytes4, int128) {
        accumulatedDelta = delta;

        emit SwapProcessed(
            sender,
            key,
            params.zeroForOne,
            params.amountSpecified,
            delta,
            BASE_FEE
        );

        return (IHooks.afterSwap.selector, 0);
    }
}
