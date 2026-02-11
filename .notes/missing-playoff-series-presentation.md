# Playoff Data Issues

Detected by integrity checks `C17` (missing follow-up series) and `C18` (bracket depth/date conflicts). Both run via `psql -f sql/data-integrity.sql`.

---

## 1. Mis-tagged event — LIMITLESS & YOUNG MONEY CLAN

**Event:** 2024 / Major 1 / Open Qualifier 1
**Source:** `2024 Season Database - 2024 Major 1 (1).csv`
**Check:** C18

Limitless completed OQ1 playoffs Feb 2-4:

| Date | Round | Result |
|------|-------|--------|
| Feb 2 | QF | LIMITLESS 4-0 LOS ANGELES SIGNAL |
| Feb 3 | SF | LIMITLESS 4-2 SHMONGOLIA |
| Feb 3 | GF | LIMITLESS 4-0 YOUNG MONEY CLAN |

But a second QF appears a month later:

| Date | Round | Result |
|------|-------|--------|
| Mar 2 | QF | LIMITLESS 4-0 YOUNG MONEY CLAN |

This Mar 2 series (`528d2998`) falls inside the OQ3 date window (Mar 1-3 playoffs). It's OQ3 data labeled as OQ1.

**Fix:** Re-tag `Regional` from `Open Qualifier 1` → `Open Qualifier 3` for series `528d2998b536a299885741c22c5e7769`.

---

## 2. Backward lower bracket — BOT GAMING

**Event:** 2021-22 / Winter / Regional Event 3
**Source:** `2021-22 Season Database - 2021-22 Season (2).csv`
**Check:** C17 + C18

BOT GAMING's lower bracket runs backwards:

| Date | Round | Result | Series ID |
|------|-------|--------|-----------|
| Feb 25 | LQF | ATK 4-0 BOT GAMING | `9e44866d` |
| Feb 25 | LR1 | BOT GAMING 3-0 DNMK ESPORTS | `8cb3f936` |
| Feb 26 | LR2 | BOT GAMING 3-0 YANKEES WITH NO BRIM | `15c45f6a` |

LQF (deeper) on Feb 25, then LR1 and LR2 (shallower) on Feb 25-26. Normal lower bracket order is LR1 → LR2 → LQF. The LQF series is either mis-tagged or the LR1/LR2 rounds are wrong.

C17 also flags BOT GAMING because their last recorded win (LR2) has no follow-up series.

**Fix:** Verify round labels against the actual bracket. Either the LQF is actually LR1, or the later LR1/LR2 should be LR2/LR3 (or LQF/LSF).

---

## 3. Missing follow-up series — TRADUIS SI TU PUES

**Event:** 2025 / Raleigh Major / Open 6
**Source:** `2025 Season Database - 2025 Birmingham Major (1).csv`
**Check:** C17

| Date | Round | Result | Series ID |
|------|-------|--------|-----------|
| May 24 | LR1 | TRADUIS SI TU PUES 4-1 GENESIX | `5c1a359a` |

Team wins LR1 but no follow-up series exists. Zero forfeit rows for this event scope either — this is a source data absence, not a display issue.

**Fix:** Add the missing follow-up series rows to the source CSV, or confirm the team forfeited and add FF rows.

---

## 4. Name mismatch — AIPX / AIPX GAMING

**Event:** 2021-22 / Winter / Regional Event 2
**Source:** `2021-22 Season Database - 2021-22 Season (2).csv`
**Check:** C17

| Date | Round | Result | Series ID |
|------|-------|--------|-----------|
| Feb 4 | LR1 | AIPX 3-0 SYNGERGY GAMING | `3d2bc719` |

Team wins LR1 but no follow-up exists under "AIPX". The same team likely continues as "AIPX GAMING" in later rounds, breaking bracket linking.

**Fix:** Normalize team name to `AIPX GAMING` (or whichever variant is canonical) across all rows.

---

## Summary

| # | Type | Team(s) | Event | Fix |
|---|------|---------|-------|-----|
| 1 | Mis-tagged event | LIMITLESS, YOUNG MONEY CLAN | 2024 Major 1 OQ1 | Re-tag Regional → OQ3 |
| 2 | Wrong round labels | BOT GAMING | 2021-22 Winter RE3 | Fix round labels |
| 3 | Missing series | TRADUIS SI TU PUES | 2025 Raleigh Major Open 6 | Add missing rows |
| 4 | Name mismatch | AIPX | 2021-22 Winter RE2 | Normalize team name |
