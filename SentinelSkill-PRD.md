# PRD — SentinelSkill

**Runtime Security Co-Processor & On-Chain Attestation Layer untuk AI Agent di Pharos**

| | |
|---|---|
| **Versi** | 1.0 |
| **Tanggal** | 10 Juni 2026 |
| **Status** | Draft untuk submission |
| **Hackathon** | Pharos Phase 1 — Skill-to-Agent Dual Cascade (DoraHacks) |
| **Track** | Phase 1 — Skill Hackathon (event hanya punya 1 default track; "Skill" = fase/kategori, bukan track formal — lihat §0) |
| **Deadline build** | **15 Juni 2026, 15:59 UTC** (= 22:59 WIB). Submit jauh sebelum cutoff. |
| **Penyusun** | Jumardi |

---

## 0. Addendum — Koreksi Terverifikasi (10 Juni 2026)

> Hasil verifikasi ke sumber primer (DoraHacks API, docs.pharos.xyz, GoPlus live API, pengumuman CertiK, npm). Bagian ini **menggantikan** klaim yang berbeda di badan PRD. Item bertanda 🔴 **WAJIB** diperbaiki sebelum coding.

**Fakta yang sudah benar (tak perlu diubah):** ChainID `688689`, RPC `https://atlantic.dplabs-internal.com`, explorer `https://atlantic.pharosscan.xyz/`, limit `500 req/5min`; token native **PHRS**; cap **64 pending-tx/address**; nama paket `@x402/express` & `@x402/evm` (itu v2 — benar); MCP SDK `@modelcontextprotocol/sdk` v1.29.0; standar SKILL.md agentskills.io (`name` + `description`).

| # | Koreksi |
|---|---|
| 🔴 1 | **Chain ID GoPlus.** `GET /token_security/688689` → error `2022 "main chain not supported"`. GoPlus hanya meng-index Pharos di **688688**. Terjemahkan `688689 → 688688` di satu tempat (GoPlusClient) khusus cek **token**. `address_security` chain-agnostic → cek address tetap pakai 688689. |
| 🔴 2 | **`unlimited_approval` tidak ada** di `token_security` GoPlus. Hapus bit 8 dari MVP, atau panggil endpoint terpisah `/token_approval_security`, atau cek statis nilai `approve()` di calldata. |
| 🔴 3 | **Deadline UTC.** `15 Jun 15:59` adalah **UTC** (= 22:59 WIB), bukan waktu lokal. Prosa halaman menyebut "16 Jun" (inkonsisten) — pakai cutoff mesin 15:59 UTC. |
| 4 | **Bukan "Skill Track".** Event punya 1 `[DEFAULT_TRACK]` & struktur 2 fase (Skill Hackathon → Agent Arena). Jangan asumsikan kriteria juri spesifik-track. |
| 5 | **Deliverable wajib hanya 2:** link git repo publik + video demo. SKILL.md, kontrak ter-deploy, & registrasi Anvita Flow adalah *diferensiator*, bukan syarat. Anvita Flow **tidak wajib**. |
| 6 | **Framing sponsor/prize.** Sponsor resmi DoraHacks event ini **hanya Pharos**. CertiK/GoPlus bukan juri resmi event ini — posisikan sebagai *standar/sumber data* yang kita bungkus. Prize pool event = **50.000 PROS** (Skill phase 20.000 PROS), bukan 150K (itu kampanye "AI Carnival"). |
| 🔴 7 | **CertiK Skill Scanner TIDAK punya API publik self-serve** (gated enterprise/marketplace; akses langsung "planned for future release"). `vet_skill` TIDAK bisa bergantung pada API CertiK live di window ini. Mitigasi (cukup): adapter + **local heuristic engine** yang mengimplementasikan rubrik 5-kategori CertiK, lalu feature-flag panggilan asli. Jangan hardcode endpoint dari artikel HackerNoon "v1 guide" yang tak terverifikasi. |

**Descope wajib agar muat ~5 hari:** (a) **oracle harga USD dibuang** — tak ada Chainlink di Atlantic; limit policy didenominasi dalam unit native; (b) **IPFS/laporan penuh on-chain dibuang** — cukup hash + bitmask, `uri` kosong/GitHub raw; (c) **x402 + Anvita Flow** = stretch murni.

---

## 1. Ringkasan Eksekutif

SentinelSkill adalah sebuah **meta-Skill** (format `SKILL.md`) plus **MCP server** yang dipanggil oleh agent **sebelum** ia memasang Skill pihak ketiga atau mengeksekusi transaksi/pembayaran on-chain. Ia membungkus **CertiK Skill Scanner** (untuk risiko di level Skill) dan **GoPlus Security API** (untuk risiko di level transaksi/counterparty), menjalankan **policy engine** milik pemilik agent, lalu menuliskan **attestation on-chain** di Pharos sebagai jejak audit yang immutable dan dapat dipakai ulang oleh agent lain.

Inti pembeda: SentinelSkill mengubah kriteria keamanan — yang menurut liputan pers kampanye disorot lewat CertiK Skill Scanner (tidak tercantum di halaman resmi DoraHacks `pharos-phase1`) — dari sekadar *checklist* menjadi **produk runtime yang aktif memblokir**. Ia berfungsi seperti "antivirus + firewall pre-flight" untuk agent yang memegang aset.

**Satu kalimat:** *Skill yang mengamankan Skill lain.*

---

## 2. Latar Belakang & Pernyataan Masalah

Visi Pharos AI Agent Layer adalah agent sebagai *economic actor* — memegang aset, memanggil tool, membayar via x402, dan berkolaborasi via A2A (Anvita Flow). Begitu agent otonom mulai memegang dana dan memasang Skill dari marketplace terbuka, muncul dua permukaan serangan yang nyata:

**Permukaan 1 — Risiko di level Skill (supply chain).** Sebuah `SKILL.md` beserta `scripts/`-nya bisa jahat atau terkompromi: membaca variabel lingkungan/kunci privat (data exfiltration), menjalankan shell tak terkendali (shell execution), melakukan koneksi jaringan tak sah (unauthorized network activity), atau menyalahgunakan filesystem. Ini persis lima kategori risiko yang dideteksi CertiK Skill Scanner.

**Permukaan 2 — Risiko di level transaksi (counterparty).** Bahkan Skill yang bersih bisa mengarahkan dana ke address jahat, token honeypot, kontrak phishing, atau approval tak terbatas. Agent tidak punya "akal sehat" untuk menolak ini tanpa lapisan pemeriksaan.

Hari ini agent di ekosistem Pharos tidak punya guardrail runtime terpadu untuk dua hal ini. CertiK Skill Scanner diposisikan sebagai standar keamanan dalam liputan pers kampanye, tetapi ia bersifat *scan statis di luar runtime* — belum ada komponen yang **menempel di alur eksekusi agent** dan benar-benar **menahan/memblokir** aksi berisiko sambil mencatatnya secara verifiable.

**Konsekuensi jika tidak diselesaikan:** kehilangan dana karena Skill jahat atau transaksi ke pihak berbahaya, hilangnya kepercayaan terhadap seluruh ekosistem agent, dan kegagalan tesis Pharos "production, not demo".

---

## 3. Tujuan & Non-Tujuan

### 3.1 Tujuan (Goals)
1. Menyediakan **dua checkpoint keamanan** untuk agent: (a) *pre-install* Skill (statis) dan (b) *pre-execution* transaksi (runtime).
2. Mengeluarkan **verdict yang dapat ditindak** (`ALLOW` / `HOLD` / `DENY`) berdasarkan policy yang dikonfigurasi pemilik agent.
3. Menulis **attestation on-chain** di Pharos sehingga verdict bersifat immutable, dapat diaudit, dan dapat dipakai ulang lintas-agent.
4. Mudah diintegrasikan: agent cukup memanggil dua MCP tool tanpa mengubah arsitekturnya.
5. **Eat our own dogfood**: repo SentinelSkill sendiri harus lolos CertiK Skill Scanner dengan skor tinggi (verdict `pass`).

### 3.2 Non-Tujuan (Non-Goals)
- **Bukan** membangun ulang static analyzer — kami membungkus CertiK Skill Scanner, bukan menyaingi.
- **Bukan** pengganti audit keamanan menyeluruh.
- **Bukan** firewall di level konsensus/protokol — penegakan terjadi di batas eksekusi agent (agent-side co-processor), bukan di validator.
- **Tidak** membuat token/tokenomics untuk MVP.
- **Tidak** menjamin deteksi 100% — ini lapisan pengurang risiko, bukan kepastian mutlak.

---

## 4. Target Pengguna & Persona

| Persona | Deskripsi | Kebutuhan utama |
|---|---|---|
| **Builder Agent** | Developer yang merakit agent dari banyak Skill di Anvita Flow | Yakin Skill yang dipasang aman sebelum agent-nya memegang dana |
| **Steward Agent** (otonom) | Agent yang mengelola kas/treasury & mendelegasikan tugas | Guardrail otomatis sebelum membayar/transfer ke agent lain |
| **Caller Agent** | Agent yang memanggil service agent lain via x402 | Verifikasi counterparty + reuse verdict yang sudah ada on-chain |
| **Juri / Auditor** | Penilai hackathon & pihak keamanan | Bukti verifiable bahwa keamanan tertanam di alur, bukan klaim |

---

## 5. User Stories

1. *Sebagai Builder Agent*, saya ingin memindai Skill baru sebelum memasangnya, agar Skill jahat tertolak otomatis sesuai policy saya.
2. *Sebagai Steward Agent*, sebelum membayar service agent via x402, saya ingin counterparty address & token diperiksa, agar dana tidak mengalir ke honeypot/address jahat.
3. *Sebagai Caller Agent*, saya ingin menanyakan registry on-chain apakah sebuah Skill sudah pernah diverifikasi, agar tidak perlu memindai ulang dan bisa mempercayai verdict komunitas.
4. *Sebagai pemilik agent*, saya ingin menetapkan ambang risiko (skor minimum, limit nominal, daftar blokir) lewat satu file policy, agar perilaku guardrail sesuai selera risiko saya.
5. *Sebagai juri*, saya ingin melihat attestation di block explorer Pharos, agar saya yakin pemeriksaan benar-benar terjadi.

---

## 6. Lingkup Produk (Scope)

### 6.1 MVP (wajib selesai untuk submission)
- `SKILL.md` valid sesuai standar agentskills.io (frontmatter `name` + `description`).
- MCP server dengan **2 tool**: `vet_skill` dan `guard_transaction`.
- Integrasi **CertiK Skill Scanner** (Mode A) — via adapter, dengan fallback mock bila akses API belum tersedia.
- Integrasi **GoPlus Security API** (Mode B) — address security + token security.
- **Policy engine** berbasis file deklaratif (YAML/JSON).
- **SentinelRegistry** contract ter-deploy di Pharos Atlantic Testnet + penulisan attestation.
- Tiga skenario demo yang berhasil (lihat §14).

### 6.2 Stretch Goals (bila waktu cukup)
- **Monetisasi via x402**: SentinelSkill menarik micro-fee per panggilan scan/guard.
- **Registrasi di Anvita Flow** sebagai Skill publik yang bisa ditemukan agent lain.
- **Reputation read**: skor agregat dari banyak attestation per-subject.
- **Human-in-the-loop escalation** lewat webhook saat verdict `HOLD`.
- Dukungan input ZIP (bukan hanya GitHub URL) untuk `vet_skill`.

---

## 7. Persyaratan Fungsional

### 7.1 Mode A — Skill Vetting (statis, pre-install)

| ID | Persyaratan |
|---|---|
| FR-A1 | Menerima sumber Skill berupa GitHub repo URL (MVP); ZIP/folder lokal (stretch). |
| FR-A2 | Meneruskan sumber ke CertiK Skill Scanner dan menerima skor 0–100, verdict `pass/warn/fail`, serta daftar temuan berperingkat severity. |
| FR-A3 | Memetakan temuan ke 5 kategori risiko CertiK (malicious behavior, data exfiltration, unauthorized network activity, shell execution, file system misuse) menjadi bitmask `flags`. |
| FR-A4 | Menerapkan `skill_policy` (mis. skor minimum, blokir bila ada temuan critical/high). |
| FR-A5 | Menulis attestation on-chain: `subjectType=SKILL`, `subjectHash=keccak256(source)`, verdict, skor, flags. |
| FR-A6 | Mengembalikan keputusan `ALLOW/HOLD/DENY` + ringkasan temuan ke agent. |

### 7.2 Mode B — Transaction Guarding (runtime, pre-execution)

| ID | Persyaratan |
|---|---|
| FR-B1 | Menerima intent transaksi: `chainId`, `to`, `token`, `value`, `calldata` (opsional). |
| FR-B2 | Query GoPlus: **address security** (malicious/phishing/sanctioned — pakai `chain_id=688689`) dan **token security** (honeypot, mintable, blacklist, pajak transfer — pakai `chain_id=688688`, lihat §0 #1). Catatan: `unlimited_approval` **tidak** ada di `token_security`; pakai `/token_approval_security` atau cek calldata (§0 #2). |
| FR-B3 | Menerapkan `transaction_policy`: blokir address jahat, blokir honeypot, batas pajak maksimum, limit per-transaksi & harian, ambang persetujuan manusia. |
| FR-B4 | Menulis attestation on-chain: `subjectType=TRANSACTION`, `subjectHash=keccak256(intent)`, verdict, flags. |
| FR-B5 | Mengembalikan `ALLOW` (lanjut), `HOLD` (tunggu approval), atau `DENY` (batalkan) + alasan. |

### 7.3 Registry & Reuse

| ID | Persyaratan |
|---|---|
| FR-R1 | Menyimpan attestation immutable, dapat di-query per `subjectHash`. |
| FR-R2 | Memancarkan event `AttestationRecorded` untuk indexing. |
| FR-R3 | MCP tool/agent dapat membaca verdict terakhir suatu subject sebelum scan ulang (reuse). |

---

## 8. Arsitektur Sistem & Cara Kerja

```
                         ┌──────────────────────────────────┐
                         │            AGENT                  │
                         │  (Anvita Flow / Claude Code / dsb) │
                         └───────────────┬──────────────────┘
                                         │  panggil MCP tool
                                         ▼
                         ┌──────────────────────────────────┐
                         │        SentinelSkill (MCP)        │
                         │  ┌────────────┐  ┌─────────────┐  │
   Mode A  ─────────────►│  │ vet_skill  │  │  Policy     │  │
   (pre-install)         │  └─────┬──────┘  │  Engine     │  │
                         │        │         └─────┬───────┘  │
   Mode B  ─────────────►│  ┌─────┴──────┐        │          │
   (pre-execution)       │  │guard_trans │        │          │
                         │  └─────┬──────┘        │          │
                         └────────┼───────────────┼──────────┘
                    ┌─────────────┼───────┐       │
                    ▼             ▼       ▼       ▼
            ┌──────────────┐ ┌────────┐ ┌──────────────────┐
            │ CertiK Skill │ │ GoPlus │ │  SentinelRegistry │
            │   Scanner    │ │  API   │ │  (Pharos Atlantic)│
            └──────────────┘ └────────┘ └──────────────────┘
                                              │
                                              ▼
                                    Block Explorer (audit)
```

**Alur Mode A (vet_skill):**
1. Agent hendak memasang Skill → memanggil `vet_skill(source)`.
2. SentinelSkill → CertiK Skill Scanner → skor + verdict + temuan.
3. Policy Engine mengevaluasi terhadap `skill_policy`.
4. Tulis attestation ke SentinelRegistry.
5. Kembalikan `ALLOW/HOLD/DENY` + temuan.

**Alur Mode B (guard_transaction):**
1. Agent hendak transfer/bayar → memanggil `guard_transaction(intent)`.
2. SentinelSkill → GoPlus (address + token security).
3. Policy Engine mengevaluasi terhadap `transaction_policy` (termasuk limit & escalation).
4. Tulis attestation ke SentinelRegistry.
5. Kembalikan `ALLOW/HOLD/DENY` + alasan. Agent baru mengeksekusi transaksi jika `ALLOW`.

---

## 9. Tech Stack

| Lapisan | Teknologi |
|---|---|
| Skill format | `SKILL.md` (agentskills.io) |
| Runtime server | TypeScript + `@modelcontextprotocol/sdk` (MCP) |
| Chain interaction | `viem` atau `ethers.js` |
| Smart contract | Solidity, tooling **Foundry** (forge/cast) |
| Jaringan | Pharos Atlantic Testnet — ChainID `688689`, RPC `https://atlantic.dplabs-internal.com`, Explorer `https://atlantic.pharosscan.xyz/` |
| Security API (Skill) | CertiK Skill Scanner (via adapter) |
| Security API (tx) | GoPlus Security API |
| Pembayaran (stretch) | x402 — `@x402/express`, `@x402/evm` |
| Marketplace (stretch) | Anvita Flow registration |
| Reasoning (opsional) | OpenAI / Alibaba Cloud Qwen untuk ringkasan temuan |

---

## 10. Desain Antarmuka

### 10.1 `SKILL.md` (frontmatter)

```markdown
---
name: sentinel-skill
description: >
  Security pre-flight co-processor for AI agents on Pharos. ALWAYS call this
  BEFORE installing any third-party skill (use vet_skill) and BEFORE executing
  any on-chain transaction or payment (use guard_transaction). Returns an
  ALLOW / HOLD / DENY verdict based on CertiK Skill Scanner + GoPlus risk data
  and records an on-chain attestation. Use whenever the agent is about to add a
  new capability, transfer funds, approve a token, or pay another agent.
---
```

> Catatan: `description` ditulis dalam Inggris dan kaya kata kunci pemicu agar planner agent tahu kapan memanggil Skill ini.

### 10.2 MCP Tools

**`vet_skill`**
```jsonc
// input
{
  "source": "https://github.com/org/some-skill",  // repo URL (MVP)
  "policyId": "default"                            // opsional
}
// output
{
  "verdict": "DENY",                  // ALLOW | HOLD | DENY
  "score": 42,                        // 0-100
  "scannerVerdict": "fail",           // pass | warn | fail
  "flags": ["data_exfiltration", "shell_execution"],
  "findings": [ { "severity": "critical", "title": "...", "detail": "..." } ],
  "attestationTx": "0xabc..."         // hash tx di Pharos
}
```

**`guard_transaction`**
```jsonc
// input
{
  "chainId": 688689,                  // attestation on-chain pakai 688689; GoPlus token_security diterjemahkan ke 688688 (§0 #1)
  "to": "0x...",
  "token": "0x...",                   // address token; native bila kosong
  "value": "1000000",                 // dalam unit terkecil
  "calldata": "0x...",                // opsional
  "policyId": "default"
}
// output
{
  "verdict": "HOLD",
  "flags": ["high_tax_token", "over_per_tx_limit"],
  "reasons": ["transfer tax 12% > max 10%", "value > per_tx_limit 500 USD"],
  "requiresApproval": true,
  "attestationTx": "0xdef..."
}
```

### 10.3 Policy (deklaratif)

```yaml
policyId: default
skill_policy:
  min_score: 80
  block_on_severity: [critical, high]
  allow_warn: false
transaction_policy:
  block_malicious_address: true
  block_sanctioned_address: true
  block_honeypot: true
  max_transfer_tax_bps: 1000        # 10.00%
  per_tx_limit_usd: 500
  daily_limit_usd: 2000
  require_human_approval_above_usd: 1000
escalation:
  on_hold: hold                     # hold | deny | warn
  approver: "0xOwner... | https://webhook"
```

### 10.4 Smart Contract — `SentinelRegistry`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract SentinelRegistry {
    enum SubjectType { SKILL, TRANSACTION }
    enum Verdict { PASS, WARN, FAIL }

    struct Attestation {
        bytes32     subjectHash;   // keccak256(source) atau keccak256(intent)
        SubjectType subjectType;
        Verdict     verdict;
        uint16      score;         // 0..100 (untuk SKILL); 0 untuk TX
        uint32      flags;         // bitmask kategori risiko
        address     attester;
        uint64      timestamp;
        string      uri;           // opsional: laporan temuan lengkap (IPFS/URL)
    }

    // subjectHash => daftar attestation (riwayat)
    mapping(bytes32 => Attestation[]) private _history;

    event AttestationRecorded(
        bytes32 indexed subjectHash,
        SubjectType indexed subjectType,
        Verdict verdict,
        uint16 score,
        uint32 flags,
        address indexed attester
    );

    function recordAttestation(
        bytes32 subjectHash,
        SubjectType subjectType,
        Verdict verdict,
        uint16 score,
        uint32 flags,
        string calldata uri
    ) external {
        _history[subjectHash].push(Attestation({
            subjectHash: subjectHash,
            subjectType: subjectType,
            verdict:     verdict,
            score:       score,
            flags:       flags,
            attester:    msg.sender,
            timestamp:   uint64(block.timestamp),
            uri:         uri
        }));
        emit AttestationRecorded(subjectHash, subjectType, verdict, score, flags, msg.sender);
    }

    function latest(bytes32 subjectHash) external view returns (Attestation memory) {
        Attestation[] storage h = _history[subjectHash];
        require(h.length > 0, "no attestation");
        return h[h.length - 1];
    }

    function count(bytes32 subjectHash) external view returns (uint256) {
        return _history[subjectHash].length;
    }
}
```

### 10.5 Bitmask Kategori Risiko (`flags`)

| Bit | Kategori | Sumber |
|---|---|---|
| 0 | malicious_behavior | CertiK |
| 1 | data_exfiltration | CertiK |
| 2 | unauthorized_network | CertiK |
| 3 | shell_execution | CertiK |
| 4 | filesystem_misuse | CertiK |
| 5 | malicious_address | GoPlus |
| 6 | honeypot_token | GoPlus |
| 7 | high_tax_token | GoPlus |
| 8 | unlimited_approval | GoPlus — *butuh `/token_approval_security`; tidak ada di `token_security` (§0 #2)* |
| 9 | sanctioned_address | GoPlus |

---

## 11. Pertimbangan Keamanan & Privasi

Karena ini **produk keamanan**, ia harus jadi teladan (keamanan ditonjolkan sebagai standar lewat CertiK Skill Scanner dalam liputan pers kampanye — tidak tercantum eksplisit di halaman resmi event):

- **Least privilege**: Skill tidak meminta akses filesystem/shell di luar yang dibutuhkan; tidak membaca kunci privat.
- **Secrets**: API key (CertiK/GoPlus) dari environment variable, tidak pernah di-commit; sediakan `.env.example`.
- **Outbound calls** hanya ke endpoint resmi yang di-whitelist (CertiK, GoPlus, RPC Pharos).
- **Fail-safe default**: bila scanner/API gagal atau tak pasti, default `HOLD` (bukan `ALLOW`) — aman secara konservatif.
- **Self-scan**: jalankan CertiK Skill Scanner pada repo SentinelSkill sendiri dan kejar verdict `pass`; sertakan hasilnya di README sebagai bukti.
- **Determinisme verdict**: logika policy murni & dapat diuji (unit test), tidak bergantung pada output LLM untuk keputusan blokir.
- **Privasi**: attestation menyimpan **hash** subject, bukan isi Skill atau detail transaksi sensitif; laporan lengkap opsional via `uri`.

---

## 12. Metrik Keberhasilan (selaras kriteria juri)

| Kriteria Juri (resmi DoraHacks) | Metrik SentinelSkill |
|---|---|
| **Originality & creativity** | Novel untuk ekosistem Pharos: runtime guardrail + attestation on-chain — *Skill yang mengamankan Skill* |
| **Technical quality & completeness** | MCP server 3 tool + policy engine *pure* ter-unit-test + `SentinelRegistry` ter-deploy & terbukti on-chain |
| **Practical use case for AI Agents** | Pre-flight wajib sebelum pasang Skill / bayar — mencegah exfiltrasi & transfer ke address jahat |
| **Reusability & composability** | `get_attestation` membaca verdict on-chain → dipakai ulang lintas-agent tanpa scan ulang |
| **Deployment/integrasi di Pharos** | `SentinelRegistry` live di Atlantic (688689); attestation terlihat di pharosscan |
| **UX & dokumentasi** | Integrasi 3 panggilan tool; policy 1 file; verdict + alasan terstruktur; README lengkap |
| **Keselarasan visi Pharos** | Agent jadi *economic actor* yang aman (hold aset, bayar via x402, kolaborasi A2A) |
| *Keamanan (rubrik CertiK — sumber: pers)* | Engine lokal mengimplementasikan rubrik 5-kategori CertiK; verdict konservatif terbukti pada fixture jahat |

---

## 13. Rencana Build 1 Minggu (10–15 Juni)

| Hari | Target |
|---|---|
| **H-1 (Sel)** | Scaffold repo, `SKILL.md`, skeleton MCP server, adapter CertiK (mock dulu bila perlu) |
| **H-2 (Rab)** | Integrasi GoPlus API, bangun Policy Engine + unit test |
| **H-3 (Kam)** | Tulis & deploy `SentinelRegistry` ke Pharos Atlantic, wire penulisan attestation |
| **H-4 (Jum)** | Selesaikan end-to-end `vet_skill` (Mode A) + `guard_transaction` (Mode B) |
| **H-5 (Sab)** | Buat fixture Skill jahat & tx jahat; self-scan CertiK; rapikan verdict |
| **H-6 (Min)** | Rekam video demo, tulis README + sematkan PRD, opsional x402/Anvita Flow |
| **H-7 (Sen)** | Buffer, deploy final, submit di DoraHacks sebelum 15:59 |

> Prioritas bila waktu mepet: pastikan **MVP §6.1** utuh dulu (dua mode + contract + 3 demo). Stretch goal hanya jika MVP sudah stabil.

---

## 14. Rencana Demo (untuk video deliverable)

1. **Skenario "Skill jahat ditolak"**: agent mencoba memasang Skill yang membaca env var & melakukan POST keluar → `vet_skill` → CertiK `fail` → **DENY**. Tunjukkan attestation di `pharosscan.xyz`.
2. **Skenario "transaksi jahat ditahan"**: agent hendak bayar ke honeypot/address jahat → `guard_transaction` → GoPlus flag → **DENY**. Tunjukkan attestation.
3. **Skenario "jalur hijau"**: Skill bersih + tx normal → **ALLOW** → agent lanjut.
4. **Tunjukkan policy file** mengubah perilaku (mis. turunkan `min_score`, lihat hasil berbeda).
5. **Tunjukkan reuse**: agent kedua membaca verdict yang sudah ada dari registry tanpa scan ulang (composability lintas-agent).

---

## 15. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Akses/rate-limit CertiK Skill Scanner API belum jelas | Mode A tersendat | Abstraksi lewat adapter + mode mock; konfirmasi endpoint/auth ke panitia lebih awal |
| Cakupan GoPlus terbatas untuk address di testnet Pharos | Mode B kurang data | Pakai logika token/ heuristik lokal sebagai fallback; dokumentasikan keterbatasan |
| Window build hanya ±1 minggu | Scope membengkak | Kunci MVP minimal; contract single-file tanpa upgradeability |
| Rate limit RPC Pharos (500/5m) | Penulisan/baca attestation gagal | Batch attestation, cache pembacaan |
| Verdict salah (false positive/negative) | Kepercayaan turun | Default `HOLD` saat ragu; tampilkan alasan transparan; bukan klaim 100% |

---

## 16. Pertanyaan Terbuka

1. Endpoint, autentikasi, dan format respons resmi **CertiK Skill Scanner API** — perlu konfirmasi ke panitia/dokumentasi.
2. Apakah **registrasi Anvita Flow** wajib untuk penilaian, atau hanya nilai tambah?
3. Apakah penulisan attestation sebaiknya **permissionless** atau **attester-gated** untuk demo (anti-spam vs kemudahan)?
4. Apakah juri ingin laporan temuan lengkap on-chain (`uri` → IPFS) atau cukup hash + ringkasan?
5. Unit USD pada policy: pakai oracle harga apa di testnet (Chainlink Pharos) untuk konversi `value`?

---

## 17. Lampiran — Pemetaan ke Kriteria & Sponsor

- **CertiK Skill Scanner** → inti Mode A; juga dipakai untuk self-scan repo (bukti keamanan).
- **GoPlus** → inti Mode B (address & token security).
- **MCP** → mekanisme pemanggilan oleh agent.
- **Pharos Atlantic Testnet** → tempat `SentinelRegistry` & attestation.
- **x402** (stretch) → monetisasi per-scan, demonstrasi agent-payment.
- **Anvita Flow** (stretch) → distribusi sebagai Skill publik (A2A discovery).
- **Standar `SKILL.md`** → bentuk deliverable utama (Skill Track).

---

*Dokumen ini ditulis sebagai spesifikasi internal untuk membangun SentinelSkill dalam window hackathon. Detail yang ditandai "perlu konfirmasi" harus diverifikasi langsung di halaman DoraHacks dan dokumentasi sponsor sebelum finalisasi.*
