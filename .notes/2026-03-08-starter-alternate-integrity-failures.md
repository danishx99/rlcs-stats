# Starter/Alternate Integrity Failures

Date: 2026-03-08
Source: Updated C20/C21/C22 rules in sql/data-integrity.sql

- C20 invalid team-event role shapes: 3
- C21 player role conflicts (starter+alternate in same event): 1
- C22 invalid game lineups by role shape: 3

## C20 Team-Event Role Shape Failures (Exhaustive)

| # | Season | Split | Event | Team | Total Players | Starters | Alternates | Mixed Role | Unlabeled | Unknown Role | Mixed Role Player IDs | Unlabeled Player IDs | Unknown Role Player IDs |
|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---|---|---|
| 1 | 2022-23 | Fall | Open | TEAM ESPIONAGE | 3 | 2 | 0 | 1 | 0 | 0 | `SSA-P-10078` | `` | `` |
| 2 | 2022-23 | Spring | Invitational | ICE ESPORTS | 4 | 2 | 2 | 0 | 0 | 0 | `` | `` | `` |
| 3 | 2024 | Major 2 | Open Qualifier 6 | LIMITLESS | 4 | 4 | 0 | 0 | 0 | 0 | `` | `` | `` |

## C21 Player Role Conflicts (Exhaustive)

| # | Season | Split | Event | Team | Player ID |
|---|---|---|---|---|---|
| 1 | 2022-23 | Fall | Open | TEAM ESPIONAGE | `SSA-P-10078` |

## C22 Game-Level Role Shape Failures (Exhaustive)

| # | Season | Split | Event | Team | Match ID | Game # | Players In Game | Starters In Game | Alternates In Game | Blank Role Players | Unknown Role Players | Player IDs |
|---|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---|
| 1 | 2022-23 | Spring | Invitational | ICE ESPORTS | `20230609-185336-2022-23-Spring-Invitational-Double Elim-LR1-G1` | 1 | 3 | 1 | 2 | 0 | 0 | `SSA-P-10008, SSA-P-10024, SSA-P-10140` |
| 2 | 2022-23 | Spring | Invitational | ICE ESPORTS | `20230609-185336-2022-23-Spring-Invitational-Double Elim-LR1-G2` | 2 | 3 | 1 | 2 | 0 | 0 | `SSA-P-10008, SSA-P-10024, SSA-P-10140` |
| 3 | 2022-23 | Spring | Invitational | ICE ESPORTS | `20230609-185336-2022-23-Spring-Invitational-Double Elim-LR1-G3` | 3 | 3 | 1 | 2 | 0 | 0 | `SSA-P-10008, SSA-P-10024, SSA-P-10140` |
