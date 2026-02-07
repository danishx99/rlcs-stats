# Data Integrity Presentation

## Issue 1: Some Games Do Not Have Exactly Two Teams

### Plain-English Problem
In a normal 3v3 RLCS game, we should always see exactly **two teams**:
- Team A
- Team B

In our dataset, some games do not follow that rule.  
We found games with:
- only **1** team (missing opponent),
- **3** teams (usually naming inconsistency + merge behavior),
- **4** teams (two games merged together under one match ID).

### What We Confirmed

```text
team_count  games
1           593
2           4558
3           1
4           4
```

### Visual Explanation (ASCII)

```text
Expected game shape:
  [Team A] vs [Team B]       -> team_count = 2

Observed error shapes:
  [Team A]                   -> team_count = 1   (missing opponent)
  [Team A] [Team B] [Team C] -> team_count = 3   (naming/collision issue)
  [A] [B] [C] [D]            -> team_count = 4   (two matches merged)
```

```text
Distribution (Game Count by Team Count)

team_count=1 | ################################################## (593)
team_count=2 | ##################################################...############################ (4558)
team_count=3 | # (1)
team_count=4 | #### (4)
```

### Real Examples

#### Example A: `team_count = 1` (missing opponent)
- Season: `2021-22`
- Date: `2021-10-22`
- Match ID: `20211022-195500-2021-22-Fall-Regional Event 1-Swiss-3-G1`
- Teams: `EXPANDAS`

```text
Expected:  EXPANDAS vs [Opponent]
Actual:    EXPANDAS only
Impact:    One-sided game data; totals and outcomes can be incomplete.
```

#### Example B: `team_count = 3` (inconsistent team naming)
- Season: `2021-22`
- Date: `2022-02-25`
- Match ID: `20220225-17.11-2021-22-Winter-Regional Event 3-Groups-3-G3`
- Teams: `Bravado Gaming | BRAVADO GAMING | LOST LEGION GIANTS`

```text
Expected:  BRAVADO GAMING vs LOST LEGION GIANTS
Actual:    Bravado Gaming + BRAVADO GAMING + LOST LEGION GIANTS
Impact:    Same team appears as two labels, creating false multi-team shape.
```

#### Example C: `team_count = 4` (two games merged)
- Season: `2021-22`
- Date: `2021-11-12`
- Match ID: `20211112-180631-2021-22-Fall-Regional Event 2-Swiss-2-G1`
- Teams: `DALA WHAT YOU MUST | INFERNO | MIST | OUT OF RETIREMENT`

```text
Expected:  [Team A vs Team B]
Actual:    [Team A vs Team B] + [Team C vs Team D] merged together
Impact:    Winner and series logic become unreliable for this match ID.
```

### Why This Matters
- Game-level trust drops because some rows are missing or merged.
- Series, standings, and comparison views can become misleading.
- Any metric built from game counts or wins is affected by malformed games.

### How We Checked
We grouped rows by `Match ID` and counted distinct teams in each group.
That is the direct integrity test for “does each game contain exactly two teams?”

## Issue 2: Many Games Do Not Have the Expected 6 Player Rows

### Plain-English Problem
A normal 3v3 game should produce:
- 6 total rows (3 players per team)
- 3 rows for each team

In our dataset, many games do not meet that shape.

### What We Confirmed

```text
check                                        failing_groups
Match IDs with row_count != 6                717
MatchID+Team groups with row_count != 3      284
MatchID+Team groups with player identity issues 296
```

Row-count distribution for malformed `Match ID`s:

```text
row_count  matches
1          53
2          109
3          536
4          6
5          9
12         4
```

### Visual Explanation (ASCII)

```text
Expected 3v3 game row shape:
  Team A: [P1] [P2] [P3]
  Team B: [P4] [P5] [P6]
  Total : 6 rows

Observed malformed shapes:
  - Only 1 row for a team
  - Only 2 rows for a team
  - Entire game has only 3 rows
  - Entire game has 12 rows (merged matches)
```

### Real Examples

#### Example A: Team appears with only 1 player row
- Season: `2021-22`
- Date: `2022-01-22`
- Match ID: `20220122-170938-2021-22-Winter-Regional Event 1-Playoffs-LR1-G1`
- Team: `AIPX GAMING`
- Rows for team: `1`
- Distinct players for team: `1`

```text
Expected: 3 player rows for AIPX GAMING
Actual:   1 player row
Impact:   Team performance is incomplete and undercounted.
```

#### Example B: Team appears with only 2 player rows
- Season: `2021-22`
- Date: `2022-02-04`
- Match ID: `20220204-193825-2021-22-Winter-Regional Event 2-Groups-3-G4`
- Team: `LOST LEGION GIANTS`
- Rows for team: `2`
- Distinct players for team: `2`

```text
Expected: 3 player rows
Actual:   2 player rows
Impact:   Team totals and per-player averages are distorted.
```

### Why This Matters
- Player and team totals can be undercounted.
- Per-game averages become unreliable.
- Any leaderboard or comparison built from row totals is affected.

### How We Checked
1. Group by `Match ID` and count total rows.
2. Group by (`Match ID`, `Team`) and count rows and distinct players.

## Issue 3: Winner Flags Are Sometimes Missing or Contradict the Score

### Plain-English Problem
For a valid two-team game:
- exactly one team should be marked as winner.

We found a small number of games where:
- no team is marked winner, or
- score says one team won but winner flag points to the other team.

### What We Confirmed

```text
category                                games
two-team games with no winner           5
two-team games with multiple winners    0
goals vs winner-flag mismatch           1
```

### Visual Explanation (ASCII)

```text
Expected:
  Team A (Victory=true)  vs Team B (Victory=false)
  -> exactly 1 winner

Observed:
  Team A (false) vs Team B (false)  -> no winner
  Team A goals > Team B goals, but winner flag says Team B
```

### Real Examples

#### Example A: No winner flagged
- Season: `2022-23`
- Date: `2023-05-12`
- Match ID: `20230512-193341-2022-23-Spring-Open-Double Elim-LR1-G5`
- Winners flagged: `0`

```text
Expected: one team marked winner
Actual:   zero teams marked winner
Impact:   Match result can be dropped or miscounted in win-based stats.
```

#### Example B: Score and winner flag disagree
- Season: `2026`
- Date: `2025-11-30`
- Match ID: `20251130-195938-2026-Boston Major-Open 1-Playoffs-SF-G1`
- Goal winner: `PIONEERS` (1)
- Flagged winner: `LOOKING FOR ORGANIZATION` (0)

```text
Expected: higher-goal team is winner
Actual:   winner flag points to the lower-goal team
Impact:   Direct result contradiction in game outcome data.
```

### Why This Matters
- Win/loss metrics are directly impacted.
- Series outcomes and historical comparisons can be wrong.

### How We Checked
1. Aggregate team-level `Victory` per `Match ID`.
2. Compare winner-flag outcome vs summed team goals for non-tied games.

## Issue 4: Some Series Groupings Still Merge Unrelated Teams

### Plain-English Problem
A series key should represent one matchup between two teams.
We still have series keys that include 3 or 4 teams, which means unrelated games were merged.

### What We Confirmed

```text
current series keys with >2 teams    14
legacy series keys with >2 teams     249
worst legacy merged-team count       16
worst current merged-team count      4
```

Current series team-count distribution:

```text
team_count  series_keys
1           446
2           4614
3           3
4           11
```

### Visual Explanation (ASCII)

```text
Expected series:
  Series X = [Team A vs Team B]

Merged series (bad):
  Series X = [Team A vs Team B vs Team C vs Team D]
```

### Real Examples

#### Example A: 4-team merged series key
- Season: `2021-22`
- Date: `2021-11-12`
- Series key: `20211112-180631-2021-22-Fall-Regional Event 2-Swiss-2`
- Teams: `DALA WHAT YOU MUST | INFERNO | MIST | OUT OF RETIREMENT`

#### Example B: Conflicting Best-of inside one derived series
- Series key: `2023-02-24|2022-23|Winter|Invitational|Playoffs|R1|NIXUH|TEAM FUSION`
- Best-of values found: `5` and `7`

```text
Expected: one stable Best-of per series
Actual:   one derived series key maps to two Best-of values
Impact:   Series-level analytics can be internally inconsistent.
```

### Why This Matters
- Series counts and win rates can be inflated or split incorrectly.
- Head-to-head history can include impossible pairings.

### How We Checked
1. Build current series keys (match-level key without game suffix).
2. Count distinct teams per series key.
3. Validate `Best of` consistency within each derived series key.

## Issue 5: Text Formatting Inconsistencies Create Duplicate Categories

### Plain-English Problem
Some labels differ only by spaces or capitalization.
This makes one real category appear as multiple categories.

### What We Confirmed

```text
dimensions with outer-whitespace variants    5
team canonical keys with case variants       1
```

Whitespace-affected dimensions:

```text
dimension  rows_with_outer_whitespace
Split      1566
Stage      132
Regional   108
Team       27
Round      9
```

### Visual Explanation (ASCII)

```text
Expected (single label):
  "Fall"

Observed (split labels):
  "Fall"
  "Fall "   <- trailing space

Expected (single team label):
  "BRAVADO GAMING"

Observed:
  "Bravado Gaming"
  "BRAVADO GAMING"
```

### Real Examples
- `Split` values with trailing spaces:
  - `Fall ` (852 rows)
  - `Raleigh Major ` (714 rows)
- Team case variant:
  - `Bravado Gaming`
  - `BRAVADO GAMING`

### Why This Matters
- Filters and groupings can split one value into multiple buckets.
- Dashboards can show duplicate-looking categories.

### How We Checked
1. Compare raw text values vs `TRIM(raw_value)` across key dimensions.
2. Compare raw team names vs uppercase-trimmed canonical names.
