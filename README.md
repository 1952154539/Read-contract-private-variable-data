# Read Contract Private Variable Data

使用 **Viem** 的 `getStorageAt` 方法，从区块链存储槽（Storage Slots）中直接读取 Solidity 合约的 `private` 变量数据。

## 原理

在 Solidity 中，`private` 关键字仅限制其他合约和外部调用者通过合约接口访问变量，但**无法阻止任何人直接读取链上存储槽**。

区块链是一个公开的、透明的分布式账本，所有状态数据都以 32 字节的存储槽形式存储在链上。通过计算变量的存储位置，即可绕过访问控制，直接读取 `private` 变量的值。

### 存储布局规则

Solidity 合约的存储布局遵循以下规则（详见[官方文档](https://learnblockchain.cn/docs/solidity/internals/layout_in_storage.html)）：

| 数据类型 | 存储规则 |
|---------|---------|
| **值类型** (uint, address, bool) | 从声明位置开始，紧凑打包到 32 字节槽中 |
| **结构体** | 成员按声明顺序存储，可打包的类型共用同一槽 |
| **动态数组** | 槽 p 存储数组长度，实际数据从 `keccak256(abi.encode(p))` 开始 |
| **映射** | 槽 p 留空，value 存储在 `keccak256(abi.encode(key, p))` |

### 本合约的存储布局

```solidity
contract esRNT {
    struct LockInfo {
        address user;      // 20 字节
        uint64 startTime;  // 8 字节
        uint256 amount;    // 32 字节（独占一个槽）
    }
    LockInfo[] private _locks;  // 声明在 slot 0
}
```

- **Slot 0**: 数组长度（`_locks.length`）
- **Slot keccak256(0) + i*2**: `locks[i].user`（低 160 位）+ `locks[i].startTime`（高 64 位）
- **Slot keccak256(0) + i*2 + 1**: `locks[i].amount`

```
┌─────────────────────────────────────────────────────┐
│ Storage Layout for _locks[]                         │
├────────────┬────────────────────────────────────────┤
│ Slot 0     │ 数组长度 (11)                           │
│ Slot K     │ locks[0].user + locks[0].startTime     │
│ Slot K+1   │ locks[0].amount                        │
│ Slot K+2   │ locks[1].user + locks[1].startTime     │
│ Slot K+3   │ locks[1].amount                        │
│ ...        │ ...                                    │
└────────────┴────────────────────────────────────────┘
K = keccak256(abi.encode(0))
```

## 运行方式

```bash
# 1. 安装依赖
npm install

# 2. 启动本地 Anvil 节点（需要 Foundry）
anvil --chain-id 1337 --port 8545

# 3. 运行脚本
npm start
```

## 运行日志

```
============================================================
  Solidity 合约私有变量读取演示
  使用 Viem getStorageAt 从存储槽读取 private 变量
============================================================

[1/5] 编译 Solidity 合约...
   ✔ 编译成功, 字节码长度: 1502 bytes

[2/5] 连接本地 Anvil 节点...
   ✔ 已连接, Chain ID: 1337
   ✔ 部署账户: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

[3/5] 部署 esRNT 合约...
   ✔ 交易哈希: 0xbfd2d0ec66be7b369c0302d7cb6bf84b0f61c07a1e5abfc42c250fd8dbb5c064
   ✔ 合约地址: 0x5fbdb2315678afecb367f032d93f642f64180aa3
   ✔ _locks 数组长度 (public): 11

[4/5] 通过 getStorageAt 读取私有 _locks 数组...
   Storage Slot[0] (数组长度): 0x...0b => 11
   数组数据起始槽 = keccak256(abi.encode(0))
   baseSlot = 18569430475105882587588266137607568536673111973893317399460219858819262702947

[5/5] 解析 _locks 数组元素...

   locks[ 0]: user: 0x0000000000000000000000000000000000000001, startTime: 3560940048, amount: 1000000000000000000 (1 ETH)
   locks[ 1]: user: 0x0000000000000000000000000000000000000002, startTime: 3560940047, amount: 2000000000000000000 (2 ETH)
   locks[ 2]: user: 0x0000000000000000000000000000000000000003, startTime: 3560940046, amount: 3000000000000000000 (3 ETH)
   locks[ 3]: user: 0x0000000000000000000000000000000000000004, startTime: 3560940045, amount: 4000000000000000000 (4 ETH)
   locks[ 4]: user: 0x0000000000000000000000000000000000000005, startTime: 3560940044, amount: 5000000000000000000 (5 ETH)
   locks[ 5]: user: 0x0000000000000000000000000000000000000006, startTime: 3560940043, amount: 6000000000000000000 (6 ETH)
   locks[ 6]: user: 0x0000000000000000000000000000000000000007, startTime: 3560940042, amount: 7000000000000000000 (7 ETH)
   locks[ 7]: user: 0x0000000000000000000000000000000000000008, startTime: 3560940041, amount: 8000000000000000000 (8 ETH)
   locks[ 8]: user: 0x0000000000000000000000000000000000000009, startTime: 3560940040, amount: 9000000000000000000 (9 ETH)
   locks[ 9]: user: 0x000000000000000000000000000000000000000a, startTime: 3560940039, amount: 10000000000000000000 (10 ETH)
   locks[10]: user: 0x000000000000000000000000000000000000000b, startTime: 3560940038, amount: 11000000000000000000 (11 ETH)

============================================================
  ✔ 成功从链上存储槽读取所有私有 _locks 数据!
  这证明了区块链上 'private' 仅限制合约层面的访问,
  数据仍然存储在公开的链上状态中,可以被直接读取。
============================================================
```

## 解读

- 合约部署后，`_locks` 数组包含 11 个 `LockInfo` 结构体，全部声明为 `private`
- 通过 `getStorageAt` 计算存储位置后，成功读取出每个元素的 `user`、`startTime`、`amount`
- 验证：`user` 地址递增（0x1 ~ 0xb），`amount` 从 1 ETH 递增到 11 ETH，与构造函数逻辑一致

## 启示

1. **不要在链上存储敏感信息** — 包括 `private` 变量在内的所有数据都是公开可见的
2. 如需保护数据机密性，应使用**链下存储 + 链上承诺/零知识证明**方案
3. `private` 仅限制 Solidity 层面的合约间访问，不是数据保密手段

## 技术栈

- [Viem](https://viem.sh/) — 以太坊交互库
- [solc](https://github.com/ethereum/solc-js) — Solidity 编译器
- [Anvil (Foundry)](https://book.getfoundry.sh/anvil/) — 本地开发节点

## 参考

- [Solidity 存储布局官方文档](https://learnblockchain.cn/docs/solidity/internals/layout_in_storage.html)
- [读取合约私有变量原理](https://learnblockchain.cn/article/4172)
