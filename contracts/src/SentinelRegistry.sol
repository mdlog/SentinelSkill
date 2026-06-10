// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title SentinelRegistry
/// @notice Immutable, append-only log of security attestations produced by
///         SentinelSkill (vet_skill / guard_transaction). Stores only the
///         keccak256 hash of the subject (Skill source or tx intent) — never
///         the raw contents — plus a verdict, score, and risk-flag bitmask.
/// @dev    Permissionless writes (anti-spam is a non-issue for the testnet demo;
///         msg.sender is recorded as the attester). One tx per final verdict.
contract SentinelRegistry {
    enum SubjectType {
        SKILL,
        TRANSACTION
    }

    /// @dev Maps to SentinelSkill verdicts: PASS=ALLOW, WARN=HOLD, FAIL=DENY.
    enum Verdict {
        PASS,
        WARN,
        FAIL
    }

    struct Attestation {
        bytes32 subjectHash; // keccak256(source) or keccak256(intent)
        SubjectType subjectType;
        Verdict verdict;
        uint16 score; // 0..100 for SKILL; 0 for TRANSACTION
        uint32 flags; // risk-category bitmask (PRD §10.5)
        address attester;
        uint64 timestamp;
        string uri; // optional: full findings report (IPFS/URL); "" if none
    }

    /// @notice subjectHash => full attestation history (newest pushed last)
    mapping(bytes32 => Attestation[]) private _history;

    event AttestationRecorded(
        bytes32 indexed subjectHash,
        SubjectType indexed subjectType,
        Verdict verdict,
        uint16 score,
        uint32 flags,
        address indexed attester
    );

    /// @notice Append a new attestation for `subjectHash`.
    function recordAttestation(
        bytes32 subjectHash,
        SubjectType subjectType,
        Verdict verdict,
        uint16 score,
        uint32 flags,
        string calldata uri
    ) external {
        _history[subjectHash].push(
            Attestation({
                subjectHash: subjectHash,
                subjectType: subjectType,
                verdict: verdict,
                score: score,
                flags: flags,
                attester: msg.sender,
                timestamp: uint64(block.timestamp),
                uri: uri
            })
        );
        emit AttestationRecorded(subjectHash, subjectType, verdict, score, flags, msg.sender);
    }

    /// @notice Most recent attestation for a subject. Reverts if none exist.
    function latest(bytes32 subjectHash) external view returns (Attestation memory) {
        Attestation[] storage h = _history[subjectHash];
        require(h.length > 0, "no attestation");
        return h[h.length - 1];
    }

    /// @notice Full history for a subject.
    function history(bytes32 subjectHash) external view returns (Attestation[] memory) {
        return _history[subjectHash];
    }

    /// @notice Number of attestations recorded for a subject.
    function count(bytes32 subjectHash) external view returns (uint256) {
        return _history[subjectHash].length;
    }
}
