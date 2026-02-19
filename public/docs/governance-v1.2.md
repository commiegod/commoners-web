# THE COMMONER'S SUBDAO

**Governance Design Document**
A SubDAO for 3-Trait MidEvils on Solana
Version 1.2 | February 2026

---

## 1. Mission & Philosophy

Most DAOs ask their members to be altruistic. The Commoner's SubDAO doesn't. We assume you're here because you want your bags to grow — and that's exactly right. Self-interest is a legitimate and powerful force. Our goal is to harness it honestly.

The mechanism works like this: financial incentives bring coders, collectors, and artists into the same room. Once they're there, the DAO provides coordination infrastructure so their individual strengths can be directed toward things that matter — not just on-chain, but in the real world they actually live in.

**We use self-interest to build something selfless.**

### Who This Is For

- **Coders** who want to build real tools and get compensated for it
- **Collectors** who want IRL merchandise, exclusive drops, and physical artifacts
- **Artists** who want a canvas for world-building and a treasury willing to fund it
- **Anyone** who wants their online attention redirected into local community strength

### Core Values

- **Simplicity** — we celebrate what's stripped back, not what's gilded
- **Permissionlessness** — anyone who qualifies can participate, without asking
- **Honesty** — we're explicit about incentives rather than hiding behind altruism
- **Experimentation** — we push governance boundaries and learn from failure
- **Fairness** — capital does not equal influence here
- **Local impact** — online coordination, real-world results

### Every Commoner Is Equal

There is no tiering, ranking, or special treatment within the Commoner's SubDAO. Every 3-trait MidEvil NFT carries identical governance rights and identical token allocation. The beauty of this community is its uniformity — Background, Skin, and one more trait. That's it. That's all of us.

---

## 2. Community Snapshot

The following data was collected on-chain at founding and represents the verified membership of the Commoner's SubDAO.

> *Tables: 120 NFTs, 73 holders, trait distribution data — see original .docx for formatted tables.*

### Trait Composition

Every Commoner carries Background and Skin — the two universal traits that define the archetype. No armor. No weapons. The third trait varies.

> *Table: Third trait breakdown — see original .docx for formatted table.*

---

## 3. Governance Architecture

The Commoner's SubDAO uses a three-layer governance model. Each layer is designed to prevent capital from dominating decisions while enabling bold experimentation. No human holds keys to the treasury — ever.

### 3.1 Layer One — Proposal Rights (One NFT, One Vote)

Proposals are submitted and ratified using a one-NFT-one-vote model. Each Commoner NFT represents one vote regardless of token balance. This is the most Sybil-resistant approach available without external identity verification — and with only 120 Commoners in existence, any significant accumulation would be visible on-chain to the entire community before it could be weaponized.

> *Table: Proposal thresholds — see original .docx for formatted table.*

### 3.2 Layer Two — Futarchy Markets (Prioritization)

Ratified proposals enter a futarchy prediction market to determine execution priority. Holders trade COMMON tokens on two conditional markets per proposal: what is the predicted token value if the proposal passes, versus if it fails? The proposal whose PASS market most outperforms its FAIL market gets executed first.

This mechanism punishes poor governance regardless of capital. A whale backing a bad proposal doesn't just lose the vote — they lose tokens. The market is self-correcting.

> *Tables: Futarchy market mechanics — see original .docx for formatted tables.*

### 3.3 Layer Three — Treasury Supermajority

Any proposal moving treasury funds requires elevated approval thresholds. This makes the treasury deliberately difficult to drain — a feature, not a bug. Funds should only flow when the community genuinely and forcefully wants it.

> *Table: Treasury approval thresholds — see original .docx for formatted table.*

---

## 4. Autonomous Treasury & Attack Mitigation

An autonomous treasury is more secure than a multisig in most ways — but it shifts the attack surface from human trust to smart contract and market manipulation. The following table documents every known attack vector and the specific defense layered against it.

### 4.1 Threat Model

> *Table: Attack vectors and defenses — see original .docx for formatted table.*

### 4.2 The Time-Lock + Minimum Liquidity Combination

These two defenses work together specifically against futarchy manipulation and are worth explaining in detail.

**Minimum Liquidity Threshold**
A futarchy market is only valid if a minimum number of independent participants traded in it. A single actor — no matter how many tokens they hold — cannot by themselves satisfy the liquidity threshold. This means a whale cannot manipulate a market they are the only participant in. The exact threshold will be set by governance before mainnet launch, but the initial recommendation is a minimum of 10 independent wallets and 5,000 COMMON in total market volume.

**48-Hour Time-Lock**
Every treasury outflow — regardless of size — has a mandatory 48-hour delay between proposal execution and actual fund movement. During this window, the transaction is visible on-chain to anyone watching. Any group of 10% of Commoner holders (12 NFTs) can trigger an emergency freeze, pausing the outflow for an additional community review period. This is not a veto — it is a circuit breaker that buys time for the community to assess and respond.

> *Diagram: Time-lock flow — see original .docx for formatted diagram.*

### 4.3 Treasury Spending Cap

At launch, the treasury has a hard spending cap of 20 SOL per 30-day period, enforced at the smart contract level. This cap can only be raised by a 75% supermajority governance vote. It exists to limit damage in the event of an exploit or governance attack during the early period when the community is still small and the contract is unproven.

---

## 5. Token Economics

The COMMON governance token serves three purposes: participating in futarchy prediction markets, earning rewards through auction participation, and unlocking zero auction fees above a community-set threshold. It does not directly control votes — that power belongs to the NFT.

> *Table: Token distribution — see original .docx for formatted table.*

### Fee Tier Structure

Auction fees are tiered based on COMMON token holdings. The threshold for zero fees is the most important early governance decision the community will make — it determines how much COMMON is worth holding and sets the incentive structure for the entire platform.

> *Table: Fee tiers — see original .docx for formatted table.*

### Auction Reward Mechanics

The 10% auction reward pool distributes COMMON to all participants in the daily auction ecosystem, including artists who contribute to the daily highlight.

- **Sellers**: earn COMMON proportional to final sale price
- **Winning bidders**: earn a bonus COMMON for successful purchases
- **Outbid participants**: earn a consolation COMMON for showing up
- **Daily highlight artists**: earn COMMON bounty for accepted submissions

---

## 6. Daily Auction System

The Commoner's SubDAO runs one MidEvils NFT auction per day. Each auction is not just a transaction — it is a daily content event built around a single NFT. The seller isn't paying a fee for liquidity. They're paying for their MidEvil to become part of the story.

### 6.1 The Auction Mechanism

1. Holder schedules an auction by locking their MidEvils NFT into the auction smart contract
2. Auctions are assigned dates in order of scheduling — first come, first served
3. Once locked, the NFT cannot be withdrawn until the auction date
4. On auction day, a 24-hour bidding window opens automatically
5. At close, the highest bid above reserve price wins
6. Sale proceeds split automatically by smart contract based on seller's COMMON holdings
7. If no bids meet the reserve, the NFT is returned to the seller — no fee charged

### 6.2 Fee Structure

> *Table: Fee breakdown by COMMON tier — see original .docx for formatted table.*

### 6.3 The Daily Highlight

Every auction day, the platform dedicates its full attention to a single MidEvil. This is what makes listing here different from listing anywhere else. The daily highlight has two components that run simultaneously:

**Artist Bounties**
On each auction day, an open bounty is posted for artwork inspired by or featuring that day's MidEvil. Any artist — human or AI — can submit. The community engages with submissions throughout the day. Accepted work is permanently attached to that NFT's on-chain history and the artist earns COMMON from the auction rewards pool.

- Human artists and AI-generated submissions compete on equal footing
- Community engagement determines which submissions gain traction
- No gatekeeping — anyone can submit
- Accepted artists earn COMMON bounty from the auction rewards pool
- The NFT accumulates a permanent body of commissioned artwork over time

> *Diagram: Daily highlight flow — see original .docx for formatted diagram.*

**Social Media Auto-Post**
Every auction day triggers an automatic social media post built around that day's MidEvil. The post includes the NFT's traits, the auction link, the artist bounty call, and any early highlight submissions. This is the platform's primary outreach mechanism — every single day, a new piece of content goes out to a wider audience, expanding the community one auction at a time.

> *Diagram: Social media flow — see original .docx for formatted diagram.*

---

## 7. Proposal Types

The following templates define the scope of governance. This list is non-exhaustive — the community can vote to add new proposal types at any time.

### COMMON Threshold — First Governance Proposal

The very first proposal the community will vote on: what COMMON token balance unlocks zero auction fees? This single number sets the incentive structure for the entire platform. Too low and the treasury never fills. Too high and nobody can reach it. The community — who holds the tokens and understands the economics — is the right body to decide.

### Treasury Grant

Fund a project, creator, initiative, or cause. Subject to treasury spending thresholds in Section 3.3. The futarchy market asks: will this allocation increase COMMON token value?

### Builder Bounty

Commission a specific deliverable from community members — a tool, a website, a piece of art, a piece of merchandise. Payment released on delivery confirmation. This is the primary mechanism for compensating coders, artists, and builders.

### Daily Highlight Bounty

Post an open artist bounty tied to a specific upcoming auction date. Any artist — human or AI-assisted — may submit. The community engages with and elevates submissions organically. Accepted work earns COMMON from the auction rewards pool and is permanently associated with the auctioned NFT. This is the platform's core daily content engine.

### Parameter Change

Modify any configurable system parameter: auction fee tiers, COMMON threshold, quorum thresholds, holding periods, market durations, spending caps. Standard majority unless the change directly affects treasury access.

### Governance Experiment

Trial a new governance mechanism for a fixed period — typically 30 days — before a follow-up vote on whether to make it permanent. This proposal type exists specifically so the community can push boundaries without permanent commitment. Failures are expected and welcome.

### Local Impact Initiative

Proposals that direct community energy, skills, or treasury funds toward real-world local impact. This could be physical merchandise production, local event sponsorship, community education, or anything else the community defines. These are the proposals that make the mission real.

### Community Initiative

Non-financial proposals: partnerships, recognition, campaigns, social coordination. Standard majority, no futarchy market required.

---

## 8. Talent Coordination

The Commoner's SubDAO is not just a treasury and a governance token. It is a coordination layer for real human skills. The financial incentives exist to bring people in — the DAO exists to put them to work on things that matter.

### For Coders

Builder Bounties are the primary mechanism. The community identifies a tool it needs — an auction interface, a trait explorer, a governance dashboard — and posts a bounty. Any coder can claim it, build it, and earn COMMON. The DAO becomes a client with a treasury, not a corporation with a payroll.

### For Collectors

The auction system is the primary value driver. Daily auctions create price discovery and liquidity for MidEvils NFTs. IRL merchandise proposals create physical artifacts that bridge the digital collection into the real world. Collectors who participate in auctions also earn COMMON rewards.

### For Artists

The daily highlight bounty is a recurring revenue stream tied directly to platform activity. Every auction day is a paid brief. Human artists and AI-generated submissions compete on equal footing — the community engages with both, and the market decides what resonates. There is no official position on which is better. The SubDAO's aesthetic — minimal, raw, stripped back — gives every artist a clear brief rather than a blank canvas. Over time, the platform becomes a marketplace where both human and AI creativity showcase their work and let users vote with their attention.

### For Everyone

Local Impact Initiatives are the mechanism that turns online attention into real-world action. What that looks like is entirely up to the community to define — but the infrastructure exists to fund it, coordinate it, and give it legitimacy through governance.

---

## 9. Launch Roadmap

> *Timeline graphic — see original .docx for formatted timeline.*

---

## 10. Open Questions for the Community

The following decisions are intentionally left for the founding community to resolve through governance. The first four are the most time-sensitive — the COMMON threshold in particular should be the very first proposal submitted after token deployment.

1. What COMMON balance unlocks zero auction fees? *(First governance proposal — sets the entire incentive structure)*
2. What should the initial minimum liquidity threshold be for futarchy markets to be valid?
3. Should the initial 20 SOL treasury spending cap be higher or lower at launch?
4. What is the first Builder Bounty? What tool does the community most need built?
5. What is the first Local Impact Initiative? Where does the SubDAO's energy go first?
6. What governance experiment should the community try first?
7. Should there be a formal stewardship role, or remain fully flat?
8. Should the social auto-post expand beyond Twitter/X? Which platforms?

---

**120 NFTs. 73 Holders. One Mission.**
**We use self-interest to build something selfless.**
