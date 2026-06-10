// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {SentinelRegistry} from "../src/SentinelRegistry.sol";

contract SentinelRegistryTest is Test {
    SentinelRegistry registry;
    bytes32 constant SUBJECT = keccak256("https://github.com/org/some-skill");

    event AttestationRecorded(
        bytes32 indexed subjectHash,
        SentinelRegistry.SubjectType indexed subjectType,
        SentinelRegistry.Verdict verdict,
        uint16 score,
        uint32 flags,
        address indexed attester
    );

    function setUp() public {
        registry = new SentinelRegistry();
    }

    function test_RecordAndReadLatest() public {
        registry.recordAttestation(
            SUBJECT,
            SentinelRegistry.SubjectType.SKILL,
            SentinelRegistry.Verdict.FAIL,
            42,
            0x6, // data_exfiltration | unauthorized_network
            ""
        );

        assertEq(registry.count(SUBJECT), 1);
        SentinelRegistry.Attestation memory a = registry.latest(SUBJECT);
        assertEq(uint8(a.verdict), uint8(SentinelRegistry.Verdict.FAIL));
        assertEq(a.score, 42);
        assertEq(a.flags, 0x6);
        assertEq(a.attester, address(this));
    }

    function test_EmitsEvent() public {
        vm.expectEmit(true, true, true, true);
        emit AttestationRecorded(
            SUBJECT, SentinelRegistry.SubjectType.TRANSACTION, SentinelRegistry.Verdict.PASS, 0, 0, address(this)
        );
        registry.recordAttestation(
            SUBJECT, SentinelRegistry.SubjectType.TRANSACTION, SentinelRegistry.Verdict.PASS, 0, 0, ""
        );
    }

    function test_HistoryAccumulates() public {
        registry.recordAttestation(SUBJECT, SentinelRegistry.SubjectType.SKILL, SentinelRegistry.Verdict.WARN, 70, 0, "");
        registry.recordAttestation(SUBJECT, SentinelRegistry.SubjectType.SKILL, SentinelRegistry.Verdict.PASS, 95, 0, "");
        assertEq(registry.count(SUBJECT), 2);
        assertEq(registry.latest(SUBJECT).score, 95);
    }

    function test_LatestRevertsWhenEmpty() public {
        vm.expectRevert(bytes("no attestation"));
        registry.latest(keccak256("never-attested"));
    }
}
