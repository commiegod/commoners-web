# Commoner's SubDAO — Governance Framework v1.2

> **Status:** Phase 1–2 · February 2026
> **Voting:** Off-chain (shared, persistent), transitioning to Realms NFT Community DAO (Phase 3) and autonomous on-chain execution (Phase 4)

---

## 1. Mission & Philosophy

The Commoner's SubDAO converts individual self-interest into collective good. By aligning the incentives of 120 Commoner NFT holders around a shared treasury, daily auctions, and artist bounties, the DAO creates a self-sustaining institution on Solana that grows in value with every auction and every participating member.

**Core principles:**
- One NFT, one vote — no whale capture
- Autonomous treasury execution (no multi-sig trust assumptions)
- Open participation — any MidEvil can be auctioned, any artist can submit bounties
- Progressive decentralization — Phase 4 removes all admin controls

---

## 2. Community Snapshot

### Holder Data (February 2026)

| Metric | Value |
|--------|-------|
| Total Commoner NFTs | 120 |
| Unique Holders | ~85 |
| Largest Single Holding | 24 NFTs |
| Average Holding | 1.4 NFTs |
| Eligible Voters | All holders of ≥1 Commoner |

### Trait Composition

| Trait | Non-None Values | Notes |
|-------|----------------|-------|
| Background | Brown, Blue, Purple, Green, Red, Yellow | All Commoners have this |
| Skin | Wolf, Gorilla, Ape, Ogre, Bear, Human, … | All Commoners have this |
| Clothing / Eyewear | Revelry Shirt, Green Shades, Hooded Cloak, … | The defining 3rd trait |
| All other traits | None | Distinguishes Commoners from full-trait MidEvils |

*Commoners are defined as MidEvils with exactly 3 non-"None" trait values.*

---

## 3. Governance Architecture

### Layer 1 — NFT Vote

All proposals begin here. Commoner holders vote yes/no/abstain. One NFT = one vote.

| Proposal Category | Majority Threshold | Quorum | Window |
|---|---|---|---|
| Community initiative | 51% | 24 / 120 | 72 hours |
| Parameter change | 51% | 24 / 120 | 72 hours |
| Builder bounty | 51% | 24 / 120 | 72 hours |
| COMMON threshold | 51% | 24 / 120 | 72 hours |
| Artist commission | 51% | 24 / 120 | 72 hours |
| Treasury ≤ 5 SOL | 51% | 24 / 120 | 72 hours |
| Treasury 5–20 SOL | 67% | 36 / 120 | 72 hours |
| Treasury > 20 SOL | 75% + futarchy | 36 / 120 | 72 hours |

### Layer 2 — Futarchy Prioritization (Phase 4)

When multiple proposals compete for the same treasury slot, MetaDAO prediction markets rank them by expected positive impact on the DAO treasury. The market's collective forecast determines execution order.

| Component | Description |
|---|---|
| Market type | Conditional value prediction (MetaDAO) |
| Resolution metric | 30-day treasury SOL balance |
| Market duration | Matches voting window (72 hours) |
| Activation | Phase 4 deployment |

### Layer 3 — Treasury Supermajority

| Treasury Ask | Majority | Quorum | Additional |
|---|---|---|---|
| < 5 SOL | 51% | 24 / 120 | Standard vote |
| 5 – 20 SOL | 67% | 36 / 120 | Standard vote |
| > 20 SOL | 75% | 36 / 120 | + futarchy market |

---

## 4. Autonomous Treasury & Attack Mitigation

The treasury program executes proposals autonomously — no multi-sig, no admin key. All funds are protected by:

### Threat Model

| Threat | Mitigation |
|---|---|
| Whale accumulation | 1 vote per NFT; max 120 votes total; no vote stacking |
| Flash loan / borrow attack | Snapshot at proposal creation time; can't borrow Commoners (no lending protocol) |
| Sybil attacks | NFT-gated; each NFT is a unique on-chain asset |
| Governance spam | Quorum requirement filters low-participation proposals |
| Large treasury drain | 75% supermajority + futarchy for >20 SOL |
| Emergency | 12 NFTs can trigger treasury freeze (10% of supply) |

### Additional Safeguards

- **Time-lock:** Treasury transactions execute after a 24-hour delay post-vote, allowing emergency freeze if collusion is detected.
- **Spending cap:** 20 SOL per 30-day rolling window at launch.
- **Liquidity reserve:** Minimum 5 SOL always held in treasury for operational continuity.
- **Emergency freeze:** Any 12 Commoner holders can co-sign a freeze transaction, pausing all treasury outflows for 72 hours.

---

## 5. Token Economics

### Token Details

| Property | Value |
|---|---|
| Name | COMMON |
| Supply | 1,000,000,000 (fixed, no mint authority post-launch) |
| Blockchain | Solana (SPL token) |
| Decimals | 6 |
| Launch | Phase 3 |

### Allocation Table

No team or founder allocation. All COMMON is distributed to the community. The founder participates in the airdrop like every other holder.

| Allocation | Amount | % | Purpose |
|---|---|---|---|
| Commoner Airdrop | 600,000,000 | 60% | ~5,000,000 per Commoner NFT — pro-rata to all 120 holders at Phase 3 snapshot |
| MidEvil Airdrop | 100,000,000 | 10% | ~20,490 per non-Commoner MidEvil (~4,880 NFTs) — futarchy participation for the broader community |
| Bounty Rewards | 150,000,000 | 15% | Artist bounty pool; DAO can vote to replenish via open-market buys from treasury |
| DAO Liquidity | 100,000,000 | 10% | SOL/COMMON liquidity pool; LP fees build the treasury over time |
| Staking Emissions | 50,000,000 | 5% | Earned by locking COMMON (Phase 4); locked at launch, released only by governance vote |

**Airdrop design rationale:** Commoner holders control ~85% of the community-distributed supply (600M out of 700M), maintaining clear governance dominance. The broader MidEvils airdrop (~14% of community float) gives regular holders enough COMMON to participate meaningfully in futarchy prediction markets without granting them voting rights or enough aggregate supply to harm token value. Individual non-Commoner holders receive ~20,490 COMMON — enough to take a position in futarchy markets but small relative to a Commoner's ~5,000,000 allocation.

### Fee Tier Table

| COMMON Held | Auction Fee | Notes |
|---|---|---|
| < 1,666,667 | 9% (standard) | Default for all sellers |
| 1,666,667 – 3,333,332 | 6% (reduced) | Reachable via bounty accumulation or market purchase |
| 3,333,333 – 4,999,999 | 3% (reduced) | Serious COMMON holders; ~67% of a Commoner's airdrop |
| ≥ 5,000,000 | 0% (fee-free) | Full Commoner airdrop; first governance proposal confirms threshold |

**Listing minimum:** 20,000 COMMON required to list an NFT for auction (covers the MidEvil airdrop threshold, ensuring listed NFTs come from engaged community members).

*Thresholds are equidistant: 5,000,000 ÷ 3 = 1,666,667. The exact amounts are confirmed by the first governance proposal and stored in `data/fee-config.json`.*

### Staking Mechanics (Phase 4)

COMMON holders can lock tokens to earn from the 50,000,000 staking emissions pool. Longer locks earn higher multipliers.

| Lock Period | Multiplier | Notes |
|---|---|---|
| 30 days | 1× | Base rate |
| 90 days | 1.5× | 50% bonus |
| 180 days | 2× | Double rate |

- **Emission rate:** ~10,000,000 COMMON/year (pool depletes in ~5 years at constant rate)
- **Eligible stakers:** Any COMMON holder — Commoners, MidEvil airdrop recipients, bounty earners, open-market buyers
- **Distribution:** Pro-rata to (stake amount × multiplier) each epoch
- **Governance:** The DAO can vote to adjust emission rate, lock periods, or pause staking at any time
- **Rationale:** Staking rewards create a rational reason for both Commoner holders and MidEvil airdrop recipients to lock rather than sell immediately, reducing sell pressure at launch and aligning long-term incentives

### Reward Mechanics

- **Bounty reward:** Accepted artist submissions receive COMMON from the bounty rewards pool, distributed vote-weighted (each approved submission's share is proportional to votes received from Commoner holders during the live auction window).
- **Pool sustainability:** The 150,000,000 COMMON bounty pool funds daily auctions. The DAO may vote to replenish it by using treasury SOL to buy COMMON from the open market.
- **LP rewards:** The DAO liquidity allocation earns trading fees from the SOL/COMMON pool, which flow back to the treasury.
- **Commoner airdrop:** ~5,000,000 COMMON per Commoner NFT at Phase 3 launch snapshot. Wallets holding multiple Commoners receive proportionally more.
- **MidEvil airdrop:** ~20,490 COMMON per non-Commoner MidEvil at Phase 3 snapshot. This allocation enables futarchy market participation but does not grant governance voting rights.

---

## 6. Daily Auction System

### Mechanism

1. A MidEvil NFT is listed for a specific date (via on-chain `list_slot` instruction).
2. At midnight UTC on that date, the auction activates.
3. Any wallet can bid. Each bid must exceed the previous by ≥ 5% (or a minimum floor).
4. The auction runs for 24 hours. If a bid arrives in the last 10 minutes, the clock extends by 10 minutes (anti-snipe).
5. At close, the winner claims the NFT; the seller receives proceeds minus fees; fees go to treasury.
6. If no bids are placed, the auction expires with no fee and the NFT returned to the seller.

### Fee Structure

| Scenario | Seller Receives | Treasury Receives |
|---|---|---|
| Auction with bids (< 1,666,667 COMMON) | Sale price − 9% | 9% of sale |
| Auction with bids (1,666,667–3,333,332 COMMON) | Sale price − 6% | 6% of sale |
| Auction with bids (3,333,333–4,999,999 COMMON) | Sale price − 3% | 3% of sale |
| Auction with bids (≥ 5,000,000 COMMON) | Full sale price | 0% |
| Auction with no bids | NFT returned | Nothing |

### Daily Highlight

Each auction day features:
- The NFT on the homepage carousel
- Bounty artwork by human and AI artists in the carousel side panels
- Auto-generated social post (planned Phase 3) with image and bid link

### Social Auto-Post Table (Phase 3)

| Platform | Content | Timing |
|---|---|---|
| X / Twitter | NFT image + bid link + traits | Auction open (midnight UTC) |
| X / Twitter | Winner announcement + price | Auction close |
| Discord #announcements | Embed with all details | Both events |

---

## 7. Proposal Types

| Type | Description | Example |
|---|---|---|
| `community-initiative` | General community proposals | Host a Twitter Space |
| `parameter-change` | Modify governance or auction parameters | Change minimum bid increment |
| `builder-bounty` | Commission a developer or builder | Hire someone to build a mobile wallet view |
| `artist-commission` | Commission specific artists | Pay 0.5 SOL for 3 human paintings |
| `common-threshold` | Set/change the COMMON fee-waiver threshold | Set threshold to 3,000 COMMON |
| `treasury-small` | Treasury spend < 5 SOL | Pay for server costs |
| `treasury-large` | Treasury spend ≥ 5 SOL | Fund a 10 SOL bounty program |

---

## 8. Talent Coordination

### Roles Within the SubDAO

| Role | Who | Contribution |
|---|---|---|
| Coders | Developers holding Commoner NFTs | Smart contract work, frontend, tooling |
| Collectors | All Commoner holders | Governance votes, treasury stewardship |
| Artists | Human artists + AI practitioners | Bounty artwork, community aesthetics |
| Everyone | Any MidEvil holder | Auction participation, community building |

### How to Get Involved

1. **Hold a Commoner NFT** — acquire one on Magic Eden to gain voting rights.
2. **Join Discord** — propose ideas in #governance, share artwork in #bounties.
3. **Submit a governance proposal** — draft it on the Governance page, post to Discord.
4. **Submit bounty art** — visit the Bounty page, submit artwork for any scheduled auction.
5. **List your MidEvil** — use the "List Your NFT" flow on the homepage to schedule an auction.

---

## 9. Launch Roadmap

| Phase | Status | Key Deliverables |
|---|---|---|
| Phase 1 | ✅ Complete | Site launch, gallery, holders, treasury, governance UI, bounty system, rarity rankings, off-chain voting |
| Phase 2 | 🔄 In Progress | Anchor auction program mainnet deploy, first real auctions, Realms NFT Community DAO setup, multi-sig |
| Phase 3 | Planned | COMMON token mint, holder airdrop, SOL/COMMON liquidity pool, bounty reward distribution, social auto-posting |
| Phase 4 | Future | On-chain treasury program, MetaDAO futarchy integration, autonomous proposal execution |

---

## 10. Open Questions for the Community

These are unresolved decisions the community should vote on:

1. **COMMON fee tiers** — Proposed: 9% standard / 6% at 1,666,667 / 3% at 3,333,333 / 0% at 5,000,000 COMMON. Vote to confirm or adjust thresholds and rates.
2. **Listing minimum** — Proposed: 20,000 COMMON to list an NFT for auction. Vote to confirm or adjust.
3. **Staking emission rate** — Is ~10M COMMON/year the right pace? Too fast inflates supply; too slow reduces staking appeal.
4. **Staking lock multipliers** — Are 1× / 1.5× / 2× the right multipliers for 30 / 90 / 180 days?
5. **MidEvil airdrop snapshot date** — When does the snapshot happen? Announcing it early gives holders time to prepare.
6. **Auction fee rate** — Should the standard fee be 5%? Could go lower to attract sellers.
7. **Anti-snipe window** — Should the 10-minute extension be shorter or longer?
8. **Spending cap** — Is 20 SOL per 30 days the right cap for launch?
9. **Bounty reward size** — How much COMMON should a submitted (accepted) artwork earn per vote received?
10. **Listing requirement** — Should COMMON be required to list an NFT for auction, and if so, how much?
11. **Phase 4 audit** — Which firm should audit the treasury program before Phase 4 launch?

---

*Document version: 1.3 · Last updated: February 2026 · Maintained by the Commoner's SubDAO*
