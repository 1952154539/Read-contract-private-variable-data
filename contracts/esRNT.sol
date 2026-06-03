// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract esRNT {
    struct LockInfo {
        address user;
        uint64 startTime;
        uint256 amount;
    }
    LockInfo[] private _locks;

    constructor() {
        for (uint256 i = 0; i < 11; i++) {
            _locks.push(
                LockInfo(
                    address(uint160(i + 1)),
                    uint64(block.timestamp * 2 - i),
                    1e18 * (i + 1)
                )
            );
        }
    }

    // 辅助函数：返回数组长度（用于验证存储读取是否正确）
    function getLockCount() public view returns (uint256) {
        return _locks.length;
    }
}
