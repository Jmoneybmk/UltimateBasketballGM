# Franchise upgrade status

## Implemented in this pass

- Development Division simulates rating-driven affiliate player lines on three days per week. Affiliate averages are separate from NBA averages. This is a player-stat simulation and currently has no affiliate fixtures, opponents, team standings, or box-score viewer.
- Scouting visits reveal more of a prospect report based on scout skill. The prospect view progressively exposes modeled overall, attributes, peak ages and annual progression. The draft room lists projected recommendations for remaining owned picks.
- The CFO page sets annual player salary, facility purchase, and individual staff-position allocations. Checks cover direct facility and roster transactions, staff assignments, free-agent offers and offer-sheet matches. Extension-year accounting and comprehensive assistant GM enforcement are pending.
- Training can delegate practice days and supplemental drills. Delegated practice skips game days and the rest day after a back-to-back. Drill selection considers health, energy, age, and positional attributes.
- Facility tier prices and program and inventory unlocks now cost ten times their previous amounts. Arena, parking, VIP, training and clinic each gained one tier. Purchased upgrades add upkeep.
- A defending champion and a team on a winning streak can retain more ticket demand above the base ticket price.
- Jersey settlement assigns available numbers across all rosters and avoids retired numbers for incoming players.
- Initial GM offers lead to an ownership conversation with contract terms, roster, staff and picks before signing.
- Local, Away, and League fans have conversation screens with a meeting, event, or memorabilia response.

## Earlier changes awaiting browser verification

- Scout-directed Development Division attribute change every 30 continuous days uses a final range of −0.15 to +0.30.
- Wider roster and contract tables, sorting by displayed stats, age, position, and jersey, and franchise dunks per game. Vertical scroll and roster search and sort are remembered by route during the session.
- Removed the official coaching snapshot from the franchise staff screen.
- Mock draft shows current pick owner, original team, and projected player. Standings use a weekly snapshot. Ownership reflects trades.

## Still missing or incomplete

- Live browser verification of the four Draft Scouting routes and personal draft board is pending. The isolated audit rendered all four route screens. The browser policy rejected the local file URL.
- Verify the Player Scouting controls and the prospect report reveal in a live browser. The isolated audit verified that advancing a week assigns reports to prioritized players and prospects near projected picks.
- Development Division now has a generated 50-game affiliate schedule and season-by-season logs for assigned NBA players. Full affiliate league rosters, showcase and playoffs remain open. Verify the schedule screen, recalls and rollover in a live browser.
- Live browser verification of staff contracts and the 12 staff workspaces remains. See STAFF-COMPLETION.md.
- Live browser verification of Assistant GM delegation and CFO budget checks remains. See STAFF-COMPLETION.md.
- Wide and narrow layout rules revised. Live visual checks across franchise screens remain.
- Added two expansion tiers to nine upgradeable facilities. The expansion audit checks both price and upkeep tiers, CFO enforcement, revenue impacts, and a paired 82-game Philadelphia ledger. Facility screen interactions still need live browser verification.
- Community outreach and relationship changes are covered by the fanAndPress and contracts audits. New activity prices, revenue rates, interview triggers, and trust effects are simulator rules. NBA Cares programs informed the outreach categories. NBA 2K26 MyGM served as the conversation reference, with no roster build needed for the comparison.

## Test results and gaps

- Targeted Development Division audit passed. It checks affiliate appearances, no NBA stat leakage, deterministic stats, 30-day attribute progression, early scouting coverage, same-day scout prevention, higher hot-team and champion ticket demand, upgrade price and upkeep, and rejection of a purchase above the CFO limit.
- The offseason audit passed in 127.5 seconds after the affiliate and initial facility changes. It covers the existing offseason flow.
- The finance audit passed across seven season ledgers using Philadelphia and Golden State. The lowest reported club season profit was −$130.1M in that run. This indicates a balance pass is still needed.
- Career audit passed in 143.7 seconds. It exercises existing franchise navigation and saves. The new owner, fan, staff, scouting and budget flows still need browser verification.
- Official reference: https://gleague.nba.com/assignments. The supplied MyNBA Eras captures informed scouting and draft layout. The exact edition and roster build are unconfirmed.
- A single isolated season covering every requested feature remains outstanding.




