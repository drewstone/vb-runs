// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";

/// @title Minimal V4Router interface for off-chain integration
interface IV4Router {
    struct SwapExactInputSingleParams {
        PoolKey poolKey;
        bool zeroForOne;
        uint128 amountIn;
        uint128 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
        bytes hookData;
    }

    /// @notice Executes a single-hop exact-input swap
    /// @param params Swap parameters
    /// @return delta The BalanceDelta from the swap
    function swapExactInputSingle(SwapExactInputSingleParams calldata params)
        external
        payable
        returns (BalanceDelta delta);
}
