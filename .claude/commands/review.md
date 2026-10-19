---
description: Run the read-only reviewer on an implemented ticket (Rule 16). Usage - /review AB-1002
---

Ticket: $ARGUMENTS

This must run in a FRESH terminal with a clean context. If the session already holds implementation context, tell the user to start a new Claude instance and stop.

Delegate to the `reviewer` agent and print its table unchanged. The result must be all ✅ before `/pr` (Rule 17). Do not fix anything from this command.
