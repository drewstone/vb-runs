// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseHook} from "@uniswap/v4-periphery/src/utils/BaseHook.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";

/// @title MyHook
/// @notice A custom hook for Uniswap V4 that demonstrates beforeSwap/afterSwap
contract MyHook is BaseHook {
    error MyHook__InvalidSwap();
    error MyHook__ZeroAddress();

    /// @notice Emitted when a swap occurs through this hook
    event SwapHooked(
        address indexed sender,
        PoolKey indexed key,
        int256 amountSpecified,
        bool zeroForOne,
        int128 amount0,
        int128 amount1
    );

    constructor(IPoolManager _manager) BaseHook(_manager) {
        require(address(_manager) != address(0), "MyHook: zero manager");
        require(address(this) != address(0), "MyHook: zero address");
    }

    /// @notice Define which hook functions are implemented
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
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    /// @notice Internal beforeSwap hook implementation
    /// @dev BaseHook.beforeSwap already has the onlyPoolManager modifier
    function _beforeSwap(
        address sender,
        PoolKey calldata key,
        SwapParams calldata params,
        bytes calldata /* hookData */
    )
        internal
        override
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        if (params.amountSpecified == 0) {
            revert MyHook__InvalidSwap();
        }

        emit SwapHooked(sender, key, params.amountSpecified, params.zeroForOne, 0, 0);

        return (this.beforeSwap.selector, BeforeSwapDelta.wrap(0), 0);
    }

    /// @notice Internal afterSwap hook implementation
    /// @dev BaseHook.afterSwap already has the onlyPoolManager modifier
    function _afterSwap(
        address sender,
        PoolKey calldata key,
        SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata /* hookData */
    ) internal override returns (bytes4, int128) {
        emit SwapHooked(sender, key, params.amountSpecified, params.zeroForOne, delta.amount0(), delta.amount1());

        return (this.afterSwap.selector, 0);
    }
}
