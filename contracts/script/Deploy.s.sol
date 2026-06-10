// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {SentinelRegistry} from "../src/SentinelRegistry.sol";

/// @notice Deploy SentinelRegistry to Pharos Atlantic Testnet (chain 688689).
/// Usage:
///   forge script script/Deploy.s.sol:Deploy \
///     --rpc-url pharos_atlantic --broadcast --private-key $ATTESTER_PRIVATE_KEY
contract Deploy is Script {
    function run() external returns (SentinelRegistry registry) {
        uint256 pk = vm.envUint("ATTESTER_PRIVATE_KEY");
        vm.startBroadcast(pk);
        registry = new SentinelRegistry();
        vm.stopBroadcast();

        console.log("SentinelRegistry deployed at:", address(registry));
        console.log("Set SENTINEL_REGISTRY_ADDRESS to the address above in your .env");
    }
}
