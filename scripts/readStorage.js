const { createPublicClient, createWalletClient, http, keccak256, encodeAbiParameters, parseAbiParameters, toHex } = require("viem");
const { localhost } = require("viem/chains");
const solc = require("solc");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("=".repeat(60));
  console.log("  Solidity 合约私有变量读取演示");
  console.log("  使用 Viem getStorageAt 从存储槽读取 private 变量");
  console.log("=".repeat(60));

  // 1. 编译合约
  console.log("\n[1/5] 编译 Solidity 合约...");
  const contractPath = path.join(__dirname, "..", "contracts", "esRNT.sol");
  const source = fs.readFileSync(contractPath, "utf8");

  const input = {
    language: "Solidity",
    sources: { "esRNT.sol": { content: source } },
    settings: { outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } } },
  };

  const compiled = JSON.parse(solc.compile(JSON.stringify(input)));

  if (compiled.errors) {
    const errors = compiled.errors.filter((e) => e.severity === "error");
    if (errors.length > 0) {
      console.error("编译错误:", JSON.stringify(errors, null, 2));
      process.exit(1);
    }
  }

  const contract = compiled.contracts["esRNT.sol"]["esRNT"];
  const bytecode = "0x" + contract.evm.bytecode.object;
  const abi = contract.abi;
  console.log("   ✔ 编译成功, 字节码长度:", bytecode.length, "bytes");

  // 2. 连接本地链 (Anvil)
  console.log("\n[2/5] 连接本地 Anvil 节点...");
  const publicClient = createPublicClient({
    chain: localhost,
    transport: http("http://127.0.0.1:8545"),
  });

  // 使用 Anvil 默认账户 #0
  const deployer = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
  const walletClient = createWalletClient({
    chain: localhost,
    transport: http("http://127.0.0.1:8545"),
    account: deployer,
  });

  const chainId = await publicClient.getChainId();
  console.log("   ✔ 已连接, Chain ID:", chainId);
  console.log("   ✔ 部署账户:", deployer);

  // 3. 部署合约
  console.log("\n[3/5] 部署 esRNT 合约...");
  const deployHash = await walletClient.deployContract({
    abi,
    bytecode,
    args: [],
  });

  console.log("   ✔ 交易哈希:", deployHash);

  const receipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
  const contractAddress = receipt.contractAddress;
  console.log("   ✔ 合约地址:", contractAddress);

  if (!contractAddress) {
    throw new Error("合约地址为空，部署可能失败");
  }

  // 验证：通过公开函数读取数组长度
  const lockCount = await publicClient.readContract({
    address: contractAddress,
    abi,
    functionName: "getLockCount",
  });
  console.log("   ✔ _locks 数组长度 (public):", lockCount.toString());

  // 4. 计算存储槽位置
  console.log("\n[4/5] 通过 getStorageAt 读取私有 _locks 数组...");
  console.log("   —".repeat(30));

  // _locks 声明在 slot 0
  // slot 0 存储: 数组长度
  const lengthSlot = 0n;
  const rawLength = await publicClient.getStorageAt({
    address: contractAddress,
    slot: toHex(lengthSlot),
  });
  console.log(`   Storage Slot[0] (数组长度): ${rawLength} => ${BigInt(rawLength)}`);

  // 动态数组数据从 keccak256(abi.encode(slot)) 开始
  const baseSlot = BigInt(
    keccak256(encodeAbiParameters(parseAbiParameters("uint256"), [0n]))
  );
  console.log(`   数组数据起始槽 = keccak256(abi.encode(0))`);
  console.log(`   baseSlot = ${baseSlot}`);

  // 5. 读取并解析每个元素
  console.log("\n[5/5] 解析 _locks 数组元素...\n");

  const count = Number(lockCount);

  for (let i = 0; i < count; i++) {
    // 每个 LockInfo 结构体占 2 个槽:
    //   槽 0: [4字节padding][20字节 address user][8字节 uint64 startTime]
    //         其中 address 在低位(右), startTime 在高位(左)
    //   槽 1: [32字节 uint256 amount]

    const structBaseSlot = baseSlot + BigInt(i) * 2n;

    // 读取打包槽 (address + startTime)
    const packedSlotHex = await publicClient.getStorageAt({
      address: contractAddress,
      slot: toHex(structBaseSlot),
    });
    const packed = BigInt(packedSlotHex);

    // address 占用低 160 位 (20 字节)
    const userAddress = packed & ((1n << 160n) - 1n);
    const user = `0x${userAddress.toString(16).padStart(40, "0")}`;

    // startTime 占用接下来的 64 位 (8 字节)
    const startTime = (packed >> 160n) & ((1n << 64n) - 1n);

    // 读取 amount 槽
    const amountSlotHex = await publicClient.getStorageAt({
      address: contractAddress,
      slot: toHex(structBaseSlot + 1n),
    });
    const amount = BigInt(amountSlotHex);

    console.log(
      `   locks[${String(i).padStart(2)}]: user: ${user}, startTime: ${startTime}, amount: ${amount} (${Number(amount) / 1e18} ETH)`
    );
  }

  console.log("\n" + "=".repeat(60));
  console.log("  ✔ 成功从链上存储槽读取所有私有 _locks 数据!");
  console.log("  这证明了区块链上 'private' 仅限制合约层面的访问,");
  console.log("  数据仍然存储在公开的链上状态中,可以被直接读取。");
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error("脚本执行失败:", err);
  process.exit(1);
});
