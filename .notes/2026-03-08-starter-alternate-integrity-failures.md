# Starter/Alternate Integrity Failures

Date: 2026-03-08
Source: role-aware checks aligned to C20/C21/C22 in sql/data-integrity.sql

- C20 invalid team-event role shapes: 28
- C21 player role conflicts (starter+alternate in same event): 1
- C22 invalid game lineups by role shape: 3

## C20 Team-Event Role Shape Failures

| # | Season | Split | Event | Team | Total Players | Starters | Alternates | Mixed Role | Unlabeled | Unknown Role | Mixed Role Player IDs |
|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---|
| 1 | 2021-22 | Fall | Regional Event 1 | EXOTIC ESPORTS | 3 | 2 | 1 | 0 | 0 | 0 | `` |
| 2 | 2021-22 | Fall | Regional Event 2 | INFERNO | 3 | 2 | 1 | 0 | 0 | 0 | `` |
| 3 | 2021-22 | Spring | Regional Event 1 | DIGITAL DEVILS | 3 | 2 | 1 | 0 | 0 | 0 | `` |
| 4 | 2021-22 | Spring | Regional Event 1 | MILLENNIAL TIMES GAMING | 3 | 2 | 1 | 0 | 0 | 0 | `` |
| 5 | 2021-22 | Spring | Regional Event 2 | MILLENNIAL TIMES GAMING | 3 | 2 | 1 | 0 | 0 | 0 | `` |
| 6 | 2021-22 | Spring | Regional Event 3 | AUREON ACES | 3 | 2 | 1 | 0 | 0 | 0 | `` |
| 7 | 2021-22 | Spring | Regional Event 3 | DIGITAL DEVILS | 3 | 2 | 1 | 0 | 0 | 0 | `` |
| 8 | 2021-22 | Spring | Regional Event 3 | KITSUNE | 3 | 2 | 1 | 0 | 0 | 0 | `` |
| 9 | 2021-22 | Spring | Regional Event 3 | NIBBLE ESPORTS | 3 | 2 | 1 | 0 | 0 | 0 | `` |
| 10 | 2021-22 | Spring | Regional Event 3 | UNITY | 3 | 2 | 1 | 0 | 0 | 0 | `` |
| 11 | 2021-22 | Winter | Regional Event 3 | ANARCHY GAMING | 3 | 2 | 1 | 0 | 0 | 0 | `` |
| 12 | 2021-22 | Winter | Regional Event 3 | BARNEY & HIS DINOSAURS | 3 | 2 | 1 | 0 | 0 | 0 | `` |
| 13 | 2021-22 | Winter | Regional Event 3 | DNMK ESPORTS | 3 | 2 | 1 | 0 | 0 | 0 | `` |
| 14 | 2021-22 | Winter | Regional Event 3 | ROYALTY ESPORTS | 3 | 2 | 1 | 0 | 0 | 0 | `` |
| 15 | 2021-22 | Winter | Regional Event 3 | SUZAKU | 3 | 2 | 1 | 0 | 0 | 0 | `` |
| 16 | 2022-23 | Fall | Cup | LUPO ROSSO | 3 | 2 | 1 | 0 | 0 | 0 | `` |
| 17 | 2022-23 | Fall | Open | ICE ESPORTS | 3 | 2 | 1 | 0 | 0 | 0 | `` |
| 18 | 2022-23 | Fall | Open | TEAM ESPIONAGE | 3 | 2 | 0 | 1 | 0 | 0 | `SSA-P-10078` |
| 19 | 2022-23 | Spring | Invitational | ICE ESPORTS | 4 | 2 | 2 | 0 | 0 | 0 | `` |
| 20 | 2022-23 | Spring | Invitational | RED CROWN ESPORTS | 3 | 2 | 1 | 0 | 0 | 0 | `` |
| 21 | 2022-23 | Winter | Cup | UNITY | 3 | 2 | 1 | 0 | 0 | 0 | `` |
| 22 | 2022-23 | Winter | Invitational | DIGITAL DEVILS | 3 | 2 | 1 | 0 | 0 | 0 | `` |
| 23 | 2024 | Major 1 | Open Qualifier 3 | MANIACS | 3 | 2 | 1 | 0 | 0 | 0 | `` |
| 24 | 2024 | Major 1 | Open Qualifier 3 | NETTSPEND TEMU | 3 | 2 | 1 | 0 | 0 | 0 | `` |
| 25 | 2024 | Major 2 | Open Qualifier 5 | BIRD | 3 | 2 | 1 | 0 | 0 | 0 | `` |
| 26 | 2024 | Major 2 | Open Qualifier 6 | LIMITLESS | 4 | 4 | 0 | 0 | 0 | 0 | `` |
| 27 | 2025 | Raleigh Major | Open 4 | AKIMBO ESPORTS | 3 | 2 | 1 | 0 | 0 | 0 | `` |
| 28 | 2025 | Raleigh Major | Open 5 | WE LOVE FARMING | 3 | 2 | 1 | 0 | 0 | 0 | `` |

## C21 Player Role Conflicts

| # | Season | Split | Event | Team | Player ID |
|---|---|---|---|---|---|
| 1 | 2022-23 | Fall | Open | TEAM ESPIONAGE | `SSA-P-10078` |

## C22 Game-Level Role Shape Failures

| # | Season | Split | Event | Team | Match ID | Game # | Players In Game | Starters In Game | Alternates In Game | Player IDs |
|---|---|---|---|---|---|---:|---:|---:|---:|---|
| 1 | 2022-23 | Spring | Invitational | ICE ESPORTS | `20230609-185336-2022-23-Spring-Invitational-Double Elim-LR1-G1` | 1 | 3 | 1 | 2 | `SSA-P-10008, SSA-P-10024, SSA-P-10140` |
| 2 | 2022-23 | Spring | Invitational | ICE ESPORTS | `20230609-185336-2022-23-Spring-Invitational-Double Elim-LR1-G2` | 2 | 3 | 1 | 2 | `SSA-P-10008, SSA-P-10024, SSA-P-10140` |
| 3 | 2022-23 | Spring | Invitational | ICE ESPORTS | `20230609-185336-2022-23-Spring-Invitational-Double Elim-LR1-G3` | 3 | 3 | 1 | 2 | `SSA-P-10008, SSA-P-10024, SSA-P-10140` |
