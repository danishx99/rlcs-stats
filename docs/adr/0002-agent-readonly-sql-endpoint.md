# Agent Chat: backend-mediated read-only SQL with bounded execution

For the Pi SDK chat widget, we will execute analytics queries through a backend endpoint (not direct DB access from the agent runtime) and allow broad table reads under a strict read-only execution boundary. We chose this to preserve agent freedom for open-ended RLCS questions while still enforcing safety with server-side SQL validation, parameterized execution, statement timeout, result-size bounds, per-turn query budget, and structured JSONL audit logging.

