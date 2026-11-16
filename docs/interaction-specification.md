# Cook Mode — Interaction Specification

**Version:** 1.1 · Complete behavioural draft for review  
**Date:** 16 November 2026  
**Scope:** One adaptive recipe cooking session in a web app  
**Source:** Continuation of [Cookbook App Brainstorm](chatgpt-conversation://6afb06f2-1fe0-83ed-b94f-e4d9f9a09aba). This document supersedes its partial version 1.0.

> The cookbook should never demand more attention than the food itself.

## 1. Purpose, authority and scope

This specification defines product behaviour before visual design and implementation. It covers preparation, cooking, parallel work, checkpoints, interruptions, recovery and completion. It defines what the companion may infer, what requires confirmation, and what must remain available when capabilities fail.

“Must” is a required behaviour. “May” is optional behaviour with the stated constraints. Rules, acceptance criteria and scenarios describe the same contract. Example recipe timings are fictional test fixtures, not cooking advice.

Decisions inherited from the brainstorm are retained: guided and assisted modes; explicit mode changes; cook-controlled completion; independent timers; contextual quantities; one optional suggestion; dismissible suggestions; interruption overlays; and recovery based on confirmed state.

Newly specified product defaults include suggestion timing margins, alert repetition, return-to-session thresholds, voice disambiguation and concurrent-session ownership. These are reviewable decisions, not claims that the earlier conversation already settled them. Changing these defaults must preserve the invariants below.

Out of scope: visual layouts, styling, motion design, implementation code, technical architecture, recipe invention, meal planning, shopping, nutrition, connected appliances, camera inference, multiple cooks coordinating one session, and automatic scheduling across multiple recipes. Reading preferences are included only where they affect access to instructions.

## 2. Behavioural invariants

| ID | Required behaviour |
|---|---|
| I01 | Only an explicit cook action confirms physical progress. Time passing, navigation, silence, speech playback and suggestion acceptance never prove completion. |
| I02 | Every current action retains its relevant quantities, units, equipment settings, completion cues and critical instructions. Simplification must preserve meaning and provide the original text. |
| I03 | Focus, task progress, timers, attention events and assistance mode are independent. Changing one affects another only through an explicit rule in this document. |
| I04 | The app offers at most one optional suggestion. It can offer none. Ignoring a suggestion has no penalty and does not accept it. |
| I05 | Alerts preserve the previous focus and incomplete work. They do not silently switch the cook to another task. |
| I06 | Leaving, hiding, pausing assistance or changing mode does not pause cooking timers. No control claims to pause the food. |
| I07 | Recipe facts and cook-confirmed facts are distinguishable from estimates, unverified imported information and unknowns. Unknowns are never filled with invented instructions. |
| I08 | Attention-sensitive work suppresses optional distractions. A timer does not make a task passive. |
| I09 | Every essential action is possible without voice, sound, colour recognition or a precise gesture. |
| I10 | Timer expiry means “check”, never “ready”. Acknowledging an alert is different from resolving its physical condition. |
| I11 | Confirmed changes persist. When persistence or time accuracy is uncertain, the app states the uncertainty and reconciles it before relying on it. |
| I12 | A delayed or repeated input must not complete a different task or apply the same timer change twice. |

## 3. Assistance modes and shared controls

The first session defaults to **Guided**. Subsequent sessions use the last explicitly chosen mode. Settings are available during preparation and cooking; setup is optional unless recipe ambiguity prevents a reliable instruction.

| Behaviour | Guided | Assisted |
|---|---|---|
| Current action, quantities and completion cues | Always available | Always available |
| Advance or confirm readiness | Cook confirms | Cook confirms |
| Recipe timer controls | Available with the relevant instruction | Same, with one contextual offer to start when eligible |
| Start a timer | Explicit cook command only | Explicit cook command only |
| Parallel tasks | Available through overview or “What can I do?” | One eligible suggestion offered at a natural pause |
| Timer expiry and attention events | Always surfaced | Always surfaced |
| Spoken instruction | On request | On request; optional event announcements |
| Silent task switching or completion | Never | Never |

“Adaptive” means the assistance responds to task context within the selected mode. It does not change modes on its own. Selecting Assisted during sensitive work applies immediately, but suggestions remain suppressed until eligible. Selecting Guided removes an unaccepted automatic suggestion; it preserves accepted work, timers and unresolved events.

**Pause assistance** suppresses optional suggestions and optional narration until explicitly resumed. Essential timer and attention events remain available. It does not switch mode. “Sound off” changes audio only. “Leave cooking” keeps an unfinished session resumable. “End unfinished session” is a separate explicit action.

Reading-distance and text preferences persist independently of cooking state. Changing them must not remove quantities or critical instructions. No camera-based distance detection is assumed.

## 4. Session, task and event information

### 4.1 Recipe plan

The original recipe remains available throughout. A cooking plan contains a fixed recipe revision, selected servings, ingredient allocations, equipment, tasks, dependencies and authored conditions. The cook can inspect and correct an imported plan before starting.

| Record | Required information and meaning |
|---|---|
| Recipe revision | Identity, source/original instructions, revision, selected servings and scaling decisions. An active session retains this revision. |
| Ingredient allocation | Ingredient identity; total and per-task quantities; unit; preparation; any “divided”, reserved or “to taste” qualification; scaling exceptions. |
| Task | Stable identity; recipe order; component; action; linked source text; quantities; equipment; attention classification; interruptibility; duration estimate/range; prerequisites; completion condition; required/optional status; suggestion permission. |
| Dependency | Exact predecessor condition: confirmed completed, confirmed started, specific checkpoint passed, or explicit branch choice. Completed is the default when no alternate condition is authored. |
| Resource | Equipment or ingredient needed, exclusivity, and when it is released. An oven-temperature conflict is a resource conflict even if physical space exists. |
| Timing rule | Timer duration or range, physical start trigger, check instructions, authored follow-up intervals, urgency and any known attention deadline. Unknown values remain unknown. |
| Branch | Alternatives and conditions, which tasks become applicable, and whether selection requires cook confirmation. |
| Checkpoint | Question; observable condition; Ready/Not yet/Unsure outcomes; permitted follow-up; whether it gates dependent tasks. |

Attention and interruptibility are separate attributes:

| Classification | Attention expectation | Parallel suggestion behaviour |
|---|---|---|
| Passive | No continuous attention, subject to stated checks | Can create an opportunity for parallel work |
| Active | Hands-on work requiring attention | No competing hands-on suggestion while underway |
| Attention-sensitive | Close monitoring or timing essential | Suppress all optional suggestions |

Interruptibility is **interruptible**, **not interruptible**, or **unknown**. Unknown is treated as not interruptible for suggestion eligibility. A task may have explicit phases, such as active stirring followed by passive simmering. The phase changes only after the cook confirms the authored transition.

Duration is an estimate for planning. An attention deadline is a separate authored constraint. Neither is inferred solely from recipe order. Required completion conditions cannot be replaced by a duration estimate.

### 4.2 Session record

The session records: recipe revision and servings; assistance and accessibility preferences; base state; focused task and navigation preview; each task's status; confirmed physical start times where known; timers; checkpoints; unresolved events; suggestion opportunity and dismissal history; last confirmed action; last presence time; and an ordered record of confirmed changes.

An optional completion note or substitution is separate from the recipe's original text. It is not automatically applied to another session.

### 4.3 Task lifecycle

| Status | Meaning | Permitted transitions |
|---|---|---|
| Not started | No confirmed physical start | Start → In progress; confirmed optional skip → Skipped; branch exclusion → Not applicable |
| In progress | Physical action confirmed started | Enter authored passive phase → Waiting; request condition check → Awaiting check; explicit action completion → Completed; interruption confirmation → Suspended |
| Waiting | Food or process continues without continuous action | Check due/requested → Awaiting check; resume authored active phase → In progress; physical interruption confirmed → Suspended |
| Awaiting check | Required condition unresolved | Ready → Completed or next authored phase; Not yet → Waiting/In progress; Unsure → remains Awaiting check |
| Suspended | Cook confirms the physical process has stopped or been made safe | Reconcile actual condition → In progress/Waiting/Awaiting check; abandon → Abandoned |
| Completed | Cook confirms the required result | Explicit correction → prior unresolved status, subject to dependency review |
| Skipped / Not applicable | Optional task explicitly omitted / excluded by branch | Restore applicability → Not started, subject to dependency review |
| Abandoned | Cook has chosen not to continue this task | Reconcile and restart explicitly, or end the session unfinished |

“Blocked” and “available” are derived eligibility conditions on an unresolved task, not physical progress states. Waiting for a dependency is **blocked**, not a task's **Waiting** state. Lack of app interaction never makes a task Suspended.

For a simple hands-on instruction, “Done” may record both its start and completion in one explicit action. When start time affects timers, dependencies or resource use, the action must have a separate physical-start confirmation. A Start control must identify the physical action it records; inspecting an instruction is not Start.

Tasks with required checkpoints cannot use generic Done to bypass them. Completing an untimed passive task still requires its authored completion confirmation.

## 5. Session state and transitions

There are **six unfinished base states**—Preparing, Active, Waiting, Parallel, Checkpoint and Finishing—followed by Completed. Ended unfinished is a separate terminal outcome. Interrupted and Recovery are overlays, not additional cooking phases. This resolves the partial outline's inconsistent state count.

For a session already cooking, determine its base state in this order:

1. Finishing if the cook has explicitly entered final review and no new required work has been reopened.
2. Checkpoint if the cook has opened a checkpoint interaction.
3. Parallel if two or more physical task processes remain in progress, waiting, awaiting check or suspended, excluding tasks confirmed stopped and resource-free. A pending expired process still counts until reconciled.
4. Active if the focused physical task is hands-on or attention-sensitive.
5. Waiting if all underway work is passive and there is no focused hands-on work.
6. Active otherwise, presenting an available action, or explaining the blocker if none is eligible.

Focusing a not-started task does not itself make the session Parallel. “Up next” is a preview, not a selected or started task. The cook may inspect any task without changing the physical-state model.

| State | Required information | Event and transition |
|---|---|---|
| Preparing | Recipe, servings, ingredients, equipment, unresolved import questions, estimate qualifications and preferences | Start cooking → first eligible action in Active; restore existing session → Recovery; leave → no physical progress assumed |
| Active | Current action, exact relevant quantities, condition/cue, known running work, upcoming eligible action | Confirm action → update task and recompute base state; confirm passive phase → Waiting/Parallel; open check → Checkpoint; start second process → Parallel |
| Waiting | What is underway, countdown or condition, check action and at most one suggestion | Check → Checkpoint; accept parallel suggestion → focus candidate without completing or starting either task; confirm its start → Parallel; expiry → attention event overlay |
| Parallel | One focus, other running tasks, their next required attention and any conflicts | Switch focus → no physical changes; complete one process → recompute; open check → Checkpoint; due event → Interrupted |
| Checkpoint | Task identity, authored condition, known elapsed time, Ready/Not yet/Unsure | Ready → record condition and update dependencies; Not yet → stated follow-up; Unsure → retain unresolved condition and offer source guidance; close/back → preserve unresolved check and recompute |
| Finishing | Final serving actions, unresolved required work, all remaining timers and attention events | New work required → return to relevant state; explicit Finish when gates pass → Completed; leave → resumable Finishing |
| Completed | Confirmed outcome, notes and remaining independent reminders | Cook again → new Preparing session; notes → no progress changes |
| Ended unfinished | Incomplete outcome and retained history | Start again → new session; no claim that the recipe was completed |

Any unfinished base state may open Recovery or be interrupted by an attention event. Preparing has no cooking timers unless a previously created session is being restored. Terminal records are not silently reopened by a stale control or late voice command.

### 5.1 Navigation and correction

- “Next step” and “Back” navigate instructions only. “Done”, “Ready” and explicit physical-start commands change cooking state. Navigation shows whether an inspected instruction is incomplete, complete or blocked.
- After Done, focus moves to the next eligible action in the same component; if none, to the earliest eligible required task in recipe order. A tie between branches requires selection. A suggestion is not accepted as a side effect.
- Returning to an earlier instruction does not undo it. “Correct completion” is a separate action.
- Correcting completion re-evaluates dependencies. Unstarted dependents become blocked; already-started dependents keep their recorded physical status and are flagged for reconciliation. No physical action is automatically reversed.
- A required blocked task cannot be marked complete through ordinary progression. If the cook already performed it, “Record work already done” collects the missing prerequisite facts and any affected checkpoints before updating the plan. Unknown prerequisite conditions remain unresolved.
- Skip is available for optional tasks. Omitting a required task requires an explicit plan change, a review of affected dependents, and acknowledgement that the recipe has changed; it must not masquerade as Done.

## 6. Preparing and recipe integrity

**Start cooking** creates the session using the reviewed plan; viewing the preparation checklist does not confirm preparation tasks. Returning cooks can start directly with retained preferences and no mandatory settings tour.

Before a task becomes actionable, its instruction must be unambiguous enough to follow: quantities, temperatures where specified, dependencies and required conditions must be available or explicitly identified as absent in the source. Source omissions must not be replaced with guesses.

Imported-plan problems receive these treatments:

| Problem | Behaviour |
|---|---|
| Uncertain task separation or attention classification | Preserve original wording; suppress affected automatic suggestions until reviewed |
| Dependency cycle or missing prerequisite | Explain the affected tasks; block guided execution of that branch until corrected; original recipe stays readable |
| Conflicting ingredient allocations | Ask the cook to reconcile the affected quantities before the instruction uses them |
| Missing duration | Permit manual/untimed cooking with the authored condition; do not invent a timer or use it to estimate spare time |
| Conflicting equipment or oven settings | Do not suggest overlap; require an explicit revised plan or wait for resource release |
| Missing condition with only a duration | At expiry ask the cook to check against the original instruction; do not invent a readiness cue |

Servings may be changed before starting. Scaling must retain exceptions and divided/reserved allocations; it must not automatically scale cooking duration, equipment temperature or all ingredients indiscriminately. Once physical work starts, servings are fixed for that session unless the cook makes an explicit plan revision that reconciles ingredients already used. Recipe-library edits do not silently alter an active session.

## 7. Timer model and operations

### 7.1 Timer record and lifecycle

A timer has a unique identity, clear label and component, optional linked task/checkpoint, kind, duration, start reference, expected due time, actual expiry state, adjustment history, urgency metadata, and separate alert acknowledgement. Kinds are cooking countdown, follow-up check reminder and independent cook-created reminder. One task can have several named timers; an identical start request cannot create a duplicate by accident.

| Timer state | Meaning and transitions |
|---|---|
| Offered | Authored duration available; no clock started. Explicit Start → Running. |
| Running | Counts toward its due time. Adjust → Running with new deadline; expiry → Expired; explicit pause → Paused; cancel → Cancelled. |
| Paused | Only the clock is stopped. Resume → Running with remaining duration; cancel → Cancelled. Linked food remains physically underway unless separately reconciled. |
| Expired | Due time passed; retain elapsed-overdue information. Acknowledge → still Expired; explicit extension → Running with history; resolve check → Resolved. |
| Resolved / Cancelled | No further expiry alert. Restart creates a new run with a distinct history; cancelled linked tasks remain unresolved. |

Timers continue across focus changes, assistance modes, overlays, tab hiding and navigation away. Restoration uses the elapsed time and original due time, rather than restarting from the last displayed countdown. A clock discrepancy produces “Timing uncertain”; it does not display a confidently restored deadline.

### 7.2 Control rules

| Action | Exact behaviour |
|---|---|
| Start linked timer | Ask for or include confirmation of the authored physical start trigger, e.g. “Pasta is in the water — start timer”. An accepted suggestion never supplies this confirmation. |
| Started earlier | Cook supplies elapsed time or known start time; retain that it is cook-reported. If unknown, mark timing uncertain and offer a manual check, not a guessed countdown. |
| Use a duration range | Preserve the full source range. Default check at the earliest authored time, labelled as a first check; readiness still requires confirmation. |
| Adjust running timer | Explicit increase/decrease changes its deadline and immediately recomputes suggestions. A decrease to/past now creates expiry immediately. Reject a negative duration. |
| Pause linked timer | State “This pauses the timer only.” Record physical status separately. No suggestion window may be derived from a paused cooking timer. |
| Resume | Uses saved remaining time; if cooking continued while the timer was paused, reconcile elapsed cooking time before using it as a planning reference. |
| Reset/restart/cancel | Identify the timer and confirm before replacing or ending an active run. Keep previous timing in history. Cancel never completes its task. |
| Extend after expiry | For an authored interval, offer that exact interval. Otherwise ask the cook to enter a duration, or continue untimed. Never generate a cooking duration. |
| Add time after expiry | Start a new check interval from now; preserve the original expired deadline and amount overdue. Do not silently subtract overdue time from the requested interval. |
| Remind me | Create a labelled follow-up reminder; it does not extend a cooking duration or resolve readiness. |

An unstarted offer is not an active timer. Finishing a task with a running linked timer requires explicit confirmation to stop that timer; a contextual action may combine “Ready and stop [timer]” when both effects are named. Acknowledgement, cancellation and physical readiness remain separately recorded.

The app must explain once at the point of relying on timers if background alerts are unavailable. If capability changes mid-session, provide one actionable capability notice. Timer accuracy on return does not imply an alert was delivered while the browser was closed.

## 8. Suggestions: eligibility, selection and suppression

### 8.1 Opportunity definition

A suggestion opportunity belongs to one confirmed passive phase and has one automatic-offer budget. Its eligible window opens only when enough known time remains before the next attention requirement. A due checkpoint, interruption, recovery or hands-on work closes that window. If waiting resumes in the same physical phase, eligibility may reopen but the original offer budget and dismissal history remain. Only a newly confirmed passive phase creates a fresh opportunity; extending a timer, completing a check that continues the same phase, reading the overview or toggling modes does not.

Guided mode runs this evaluation only when requested. Assisted mode evaluates after a confirmed transition into a natural pause, after completing a check that permits further waiting, or after a material plan change. It does not continually reshuffle an offer as seconds tick by.

### 8.2 Eligibility gates — all must pass

1. The task is in the reviewed recipe or explicitly approved plan, applicable, unfinished and permitted for suggestion.
2. Required predecessor conditions are confirmed. A blocked task is never suggested as immediately executable.
3. Required ingredients and resources are available; no overlapping exclusive equipment or temperature conflict exists.
4. No unresolved immediate attention event, due checkpoint, recovery decision or current hands-on task competes for attention.
5. No physically underway attention-sensitive task exists anywhere in the session, even if another task has focus.
6. The candidate's first hands-on phase has a known conservative duration estimate and known interruptibility. The app has a credible next-attention time for all underway processes. Unknown monitoring needs suppress automatic parallel suggestions.
7. There is sufficient time before the earliest attention requirement, including check cadence, expiry and authored deadlines. Default: the candidate's upper estimated hands-on duration plus a **60-second return margin** must fit. A 3-minute upper estimate therefore needs at least 4 minutes. An interruptible task may use a shorter segment only if that segment and a safe stopping point are explicitly authored.
8. Starting the task will not create a known future conflict between non-interruptible or attention-sensitive phases. If future compatibility cannot be established, suppress the automatic suggestion.
9. The cook has not dismissed this task in the current opportunity, assistance is not paused, and the opportunity's offer budget is available.

Cook-requested “What can I do?” uses the same safety, dependency and resource gates and explains when none qualifies. The full overview can show other tasks with their restrictions without presenting them as suitable parallel work. The cook can choose a different plan explicitly; the app must not hide known conflicts.

These margins are product defaults, not cooking instructions or guarantees. Suggestion eligibility is conservative; recipe estimates are not promises.

### 8.3 Deterministic priority

First handle required attention events under section 9. Optional suggestions never outrank them. Among eligible candidates use this order:

1. A task with an authored start-by constraint that can still be met.
2. A task needed to unlock the next blocked required component or join/assembly point.
3. A required task before an optional task.
4. Less hands-on effort and fewer equipment changes.
5. Shorter conservative duration.
6. Original recipe order as a stable tie-break.

Known urgency affects ranking only when authored in the plan. If urgency is unknown, the app cannot claim one task is more urgent. Order for stability without making that claim. A task whose deadline cannot be met is a plan conflict needing review, not an enticing suggestion.

### 8.4 Offer behaviour

- Offer one specific action with a plain reason: “While the sauce simmers, grate the cheese?” No productivity pressure.
- One automatic offer is permitted per opportunity. “Not now” or closing the offer consumes it; do not replace it with a different task. Doing nothing leaves it unaccepted; it disappears when no longer eligible.
- A cook-requested suggestion may be requested again after dismissal. This request does not re-enable automatic offers in that opportunity.
- Accept changes focus only. It identifies any physical Start action still required. It never completes or pauses the previous task and never silently starts a timer.
- Revalidate at acceptance. If time has run short or another process now needs attention, withdraw the offer, explain briefly and preserve focus. A stale offer cannot start work.
- Once offered, retain it while eligible. A marginally better candidate does not replace it. Withdraw immediately when a gate fails; no automatic replacement in that opportunity.
- Switching to Guided removes the offer. Returning to Assisted does not create a new budget. An offer may be made only if no offer has yet been shown in that opportunity.
- No spoken optional suggestion by default. The cook may explicitly enable suggestion announcements; these remain subject to the same eligibility and one-offer rules.

## 9. Attention events and interruption handling

### 9.1 Event information and priority

An attention event records identity, linked task/timer, source, required check/action, known urgency/deadline, occurrence time, acknowledgement, reminder state and physical resolution. Events are not tasks themselves.

| Priority | Event | Behaviour |
|---|---|---|
| 1 | Authored immediate attention instruction or cook-reported urgent issue | Interrupt current optional speech; expose action and source instruction; do not claim sensor detection |
| 2 | Time-sensitive checkpoint, check cadence or timer expiry | Present attention request while preserving current work |
| 3 | Focused action and unresolved non-urgent work | Remain available beneath the interruption |
| 4 | Optional suggestion | Suppressed while any higher-priority decision is active |
| 5 | General progress and optional information | No interruption |

Within the same priority, use known earlier attention deadlines. If urgency cannot be distinguished, group as equal attention requests. Stable occurrence time and recipe order may determine reading order, but must not imply a safety ranking.

Events due within a **5-second window** may be grouped, without delaying the first event. A later event joins the existing group. Never stack competing modal decisions. Present all unresolved items and one selected action at a time; selecting an item does not resolve the others. A new higher-priority event can become the active interruption without deleting prior decisions.

### 9.2 Interruption transitions

| Cook/system event | Required result |
|---|---|
| Timer expires while chopping | Save chopping focus; create unresolved timer event; retain chopping as incomplete; open Interrupted overlay |
| Check now | Open linked Checkpoint; preserve return focus; condition remains unresolved until answered |
| Acknowledge | Silence that event's current alarm and record receipt; keep the unresolved check accessible; restore prior focus if the overlay closes |
| Remind me | Offer authored reminder intervals, or ask for a cook-entered duration; keep original event unresolved; return focus |
| Close interruption | Equivalent to acknowledge receipt only; never record readiness |
| Ready / action performed | Confirm the exact physical condition/action; resolve only relevant events; re-evaluate task dependencies and resume saved focus if still valid |
| Not yet | Keep condition unresolved; use authored extension or cook-entered interval, or continue untimed; return to Waiting/Parallel as appropriate |
| Unsure | Keep checkpoint open or accessible; provide original cues; no inference of readiness |
| Previous focus is no longer applicable | Explain changed context and offer next eligible action; do not resurrect an obsolete task |

For an immediate-attention instruction, acknowledge may silence sound, but the unresolved action remains prominent until the cook confirms what happened. “Remind me” cannot be offered as an authored-safe delay unless the recipe explicitly permits it; a cook-created reminder is clearly their choice and does not imply the issue is handled.

### 9.3 Ignored events, repetition and sound

- Expiry creates one event, not a fresh event on every update.
- Default timer audio, when enabled: one finite alert at expiry and one finite repeat after 30 seconds if still unacknowledged. After this, retain the unresolved overdue state without repeated sound. The cook may opt into repeat-until-acknowledged alerts with an explicitly chosen interval.
- An authored new attention deadline may create an additional event. The app never invents a hazard merely because a timer is overdue.
- Acknowledgement cancels pending repetitions for that event. It does not stop the timer history, mark food ready or suppress a distinct new event.
- Group simultaneous sounds into one alert. Speech uses the event labels, e.g. “Sauce and vegetables need checking.”
- Optional sound is separate from optional spoken announcements. Selecting Sound off suppresses audio in every mode; equivalent text/status remains available.
- Announcements, pending reminders and acknowledgement survive recovery. On return, summarise outstanding events once; do not replay every missed alarm.

## 10. Real-life interruptions and recovery

The app cannot know whether the cook left the kitchen. It records app visibility and confirmed actions, not inferred physical behaviour. Hiding the tab does not stop work. “I need to step away” opens guidance to review active heat/processes using recipe instructions; it does not claim they have been made safe.

Recovery opens on:

- “Where was I?” at any time in an unfinished session;
- reload, crash restoration, device-owner handover or a stale-session restore;
- return after at least **2 minutes** hidden, or any hidden period during which an event became due;
- timing uncertainty, lost persistence or conflicting state that affects the current plan.

A shorter return with no due event or uncertainty restores focus directly. Foreground inactivity alone does not demand a recovery interaction.

### 10.1 Recovery sequence

1. Restore the last confirmed record and recompute timer expiry before offering the next action.
2. Surface immediate attention events first. Recovery remains pending underneath an Interrupted overlay.
3. Summarise the last confirmed action, last focus, physically underway tasks, active/paused/expired timers, unresolved checkpoints and uncertain facts.
4. Ask only necessary reconciliation questions: “Did you add the pasta?” or “Has this been checked?” Do not ask again about confirmed facts without evidence of conflict.
5. Offer “Still doing this”, “Already done”, “Not started”, “Stopped/changed”, and “Unsure” where applicable. Each identifies the task and what fact it records.
6. For “Already done”, collect any required checkpoint or physical-start facts. A report of an earlier start must supply time or remain timing-uncertain. For stopped/changed work, reconcile resource use and linked timers explicitly.
7. On Resume, restore the reconciled focus and recompute base state and eligibility. Unresolved uncertain dependencies remain blocked. The cook can resume another independent eligible task while uncertainty remains visible.

Recovery does not restart timers, replay Done commands or bulk-complete elapsed tasks. If nothing is known, provide the original recipe and let the cook reconstruct the plan. Never guess a safe condition after a long absence; stale sessions remain unfinished until explicitly reconciled or ended.

### 10.2 Persistence, offline use and ownership

- An acknowledged action must be recoverable. If the app cannot save it durably, show that it is unsaved and retain the working record while available; do not imply reliable restoration.
- A previously saved recipe and locally retained progress remain usable offline. Voice, external source links and cross-device features may be unavailable; core reading, manual controls and local timer tracking remain available.
- If a recipe is not available offline, state the missing content rather than presenting a partial instruction as complete.
- Only one tab/device is the active controller of a session. A second opens read-only and can explicitly take control after reconciliation. The previous controller becomes read-only when the handover is known.
- An offline device cannot claim exclusive control over an unseen remote session. Conflicting changes are kept for review; do not merge contradictory physical confirmations or silently overwrite timers. Cross-device continuation is unavailable if the session cannot be retrieved.
- Duplicate state deliveries and repeated control activation have one effect. Distinct concurrent user changes require explicit review when their meanings conflict.

## 11. Voice, speech and accessible interaction

Voice recognition and spoken output are separate optional capabilities. They are never prerequisites for starting or finishing. Request microphone permission only after a voice action. State whether listening is active, unavailable or stopped; do not imply continuous background listening.

### 11.1 Command contract

| Command | Behaviour |
|---|---|
| “Next step” / “Back” | Preview adjacent instruction; no completion or timer change |
| “Done” / “Mark this done” | Confirm the named focused action if it has no unresolved checkpoint; otherwise open the checkpoint |
| “Ready” / “Not yet” / “Unsure” | Apply only to the checkpoint currently asking that question |
| “Repeat” / “Read this” | Read current essential action, quantities and critical cues; no progress change |
| “How much [ingredient]?” | Read the current task's allocation and unit; clarify if several allocations are relevant |
| “What's next?” | Describe the next eligible action and any dependency; do not navigate or start it |
| “Start [name] timer” | Start only with an unambiguous timer and physical-start confirmation where required |
| “Add two minutes to [name]” | Identify timer, apply once and read back the resulting remaining time or new check interval |
| “Stop timer” / “Reset timer” | Ask which if ambiguous; confirm cancellation/reset before changing an active run |
| “Stop reading” | Stop speech immediately; no timer or task effect |
| “Pause assistance” | Suppress optional assistance; timers and required events remain active |
| “Pause” / “Stop” alone | Clarify whether speech, assistance or a named timer; make no cooking-state change |
| “What can I do?” | Evaluate one eligible suggestion or state that none fits |
| “Where was I?” | Open Recovery |
| “Finish cooking” | Open Finishing review; never bypass unresolved gates |

If recognition, target or intent is uncertain, ask a short clarification and leave state unchanged. “Next” alone means instruction navigation, never Done. A generic “yes” only answers the most recent still-valid named question; a new interruption invalidates an earlier pending confirmation.

Commands remain bound to the task/timer context in which they were recognised. If focus or state changes before application, reconfirm; never complete the newly focused task by accident. Read back meaningful mutations with their target: “Pasta timer started.” Duplicate recognition of the same utterance has one effect.

Self-generated speech must not trigger cooking commands. Background conversation must not be treated as a command without an active listening interaction. Listening failure retains manual controls and does not discard confirmed progress.

### 11.2 Speech arbitration

Immediate attention can interrupt optional narration. Ordinary timer events interrupt at the next brief speech boundary, without hiding the event meanwhile. Multiple events produce one concise grouped announcement. Optional suggestions wait until essential speech finishes and never queue for later playback if their opportunity has ended.

Screen-reader announcements and app narration must not compete. When a screen reader is being used, app narration remains an explicit opt-in. “Stop reading” does not silence independently enabled timer alerts. The global Sound off control does.

### 11.3 Accessibility requirements

- All actions work with keyboard, assistive technology and explicit touch controls. No hidden whole-screen advance area, hover-only action, drag-only action or camera gesture is required.
- Labels state intent and target: “Stop pasta timer”, “Mark onions done”, “Check potatoes”. Statuses distinguish running, timer-paused, expired, acknowledged and condition-resolved in words.
- Keyboard focus remains on the current work for non-urgent status updates. If an interruption opens a decision interaction, focus moves to its heading/action and returns to the initiating location when closed. Nested decisions do not trap or lose focus.
- Countdown changes do not announce every second. Announce expiry once, explicitly requested remaining time, and meaningful status changes. Group related events.
- Text enlargement, reflow and reading-distance controls preserve full essential content and operable controls. Break long source steps into navigable sub-actions only when meaning and dependencies remain intact; navigating sub-actions does not confirm them.
- No arbitrary time limit applies to answering a checkpoint or clarification. Real cooking deadlines remain communicated, with no automatic acceptance when they pass.
- Muting, reduced-motion preferences, contrast adjustments and non-visual operation must not remove critical information. No flashing or required motion is used to communicate urgency.
- Keep-screen-awake is optional and capability-dependent. Failure changes neither progress nor timers; explain the limitation once when relevant.
- Product instruction language and command vocabulary are consistent. Unsupported speech languages fall back to manual control; unit conversions retain the original measurement and do not silently introduce rounding changes.

## 12. Checkpoints, finishing and ending

Each checkpoint names the component, condition and source-supported observation. Ready is an explicit condition confirmation. Not yet never defaults to a made-up extension. Unsure preserves uncertainty and offers the original instructions; it does not choose Ready after a timeout.

Join/assembly tasks require all applicable component dependencies to be confirmed. If one finishes first, show only authored holding instructions. Do not invent a holding duration, temperature or reheat method. A longer-than-expected component updates planning estimates without changing facts about the others.

Finishing is entered when the cook requests it, or accepts an offer after all required cooking tasks are resolved. Serving actions remain tasks; simply opening Finishing does not complete them.

**Completed requires all of the following:**

1. All applicable required tasks and serving actions are confirmed complete, with optional tasks completed or explicitly skipped and excluded branches marked not applicable.
2. All required physical checkpoints and immediate-attention instructions are resolved.
3. Each remaining running, paused, expired or follow-up timer is reviewed explicitly. The cook cancels/resolves a recipe-linked timer, or explicitly detaches an independent reminder to continue after the session. No timer disappears silently.
4. The cook explicitly selects Finish.

A generic acknowledgement of unresolved food is insufficient for Completed. It allows the cook to close a notice or return to cooking. This makes the partial draft's “explicit acknowledgement before completion” concrete: the acknowledgement must record actual resolution, or an explicit choice to end unfinished.

**End unfinished session** is always available. It names unresolved work and asks what to do with each remaining timer: retain as an independent reminder or cancel explicitly. Confirming this ends app tracking; it makes no claim that physical cooking or heat has stopped. The outcome is retained as unfinished, never celebrated as recipe completion.

After completion, notes, substitutions and favourites are optional. Cook again creates a new session, resetting task progress and timers while retaining explicitly chosen preferences. Retained independent reminders stay separately labelled with their original session.

## 13. Edge-case decisions

| Case | Required outcome |
|---|---|
| Expiry and suggestion acceptance arrive together | Apply due attention event first; revalidate and withdraw stale suggestion; no physical start assumed |
| Two timers expire with unknown relative urgency | Group as equal attention requests; preserve both; no invented urgency ranking |
| Checkpoint becomes due during non-interruptible work | Surface the known conflict; preserve both tasks; use only authored handling guidance; offer no optional work |
| Cook ignores an offer | Leave unaccepted; withdraw at opportunity end; no automatic progression |
| Cook dismisses, then extends the same simmer timer | Do not repeat automatic suggestions in that passive phase |
| Candidate becomes blocked after correction | Withdraw offer; retain correction; reconcile any already-started dependent work |
| Timer expires in a hidden tab | Recompute on return and show overdue check once; never claim an undelivered alert was heard |
| System clock changes or restored timestamps conflict | Label timing uncertain, preserve evidence and ask for cook reconciliation; no authoritative spare-time calculation |
| Timer paused but pan still heating | Keep task physically underway; suppress timer-based suggestions until reconciled |
| Duration is zero, negative or unrecognised | Zero means check now when explicitly requested; reject negative or ambiguous inputs; no silent coercion |
| “Not yet” with no authored follow-up | Ask for manual duration or continue untimed; retain condition unresolved |
| Food ready before timer expires | Confirm readiness and named timer cancellation together or separately; preserve actual finish and timer history |
| Cook already did several tasks | Record each required fact/checkpoint; no bulk confirmation that skips unresolved conditions |
| Required ingredient/equipment missing | Explain blocked tasks; allow independent eligible work or a reviewed plan change; do not invent a substitution |
| Extra/ad hoc timer | Require clear label and duration; it does not create a recipe task or satisfy a dependency |
| Resource capacity is unknown | Do not suggest overlapping use of that resource; user can revise its availability explicitly |
| Permission denied or speech unsupported | Manual controls remain complete; optional speech output remains separately available if supported |
| Battery, browser close or device loss | No guaranteed alert delivery; restore saved facts when possible; clearly distinguish missing/unsaved state |
| Local and remote records disagree | Preserve conflicting reports for review; no silent latest-write completion of physical work |
| Double tap or repeated speech event | One mutation for the same interaction; no skipping two tasks or doubling time |
| Cook revisits completed task | Show it as complete; no timer restart and no undo unless separately requested |
| Recipe edited while cooking | Continue pinned revision; offer deliberate review rather than replacing current quantities |
| Attempt to finish with an unresolved timer/check | Open review and prevent Completed; allow return or End unfinished |
| Late reminder after completion | Show only if explicitly retained as independent; no reopened session or duplicated completion |

## 14. Acceptance criteria

These criteria are required for a first complete Cook Mode release. Timing constants below are this draft's explicit defaults.

| ID | Given / when | Observable result |
|---|---|---|
| AC01 | First-ever cook starts without changing settings | Guided is selected; preparation tasks remain unconfirmed; first eligible action opens |
| AC02 | Assisted changes to Guided during two running timers | Focus, task facts and deadlines remain identical; unaccepted automatic offer disappears |
| AC03 | Cook navigates Next/Back or hears an instruction | No task completion or timer change occurs |
| AC04 | Cook confirms Done on an ordinary action | Exactly that action completes once; next eligible action gets focus; blocked actions stay blocked |
| AC05 | A required checkpoint exists and cook uses Done | Checkpoint opens; dependent tasks stay unavailable until Ready |
| AC06 | Passive task has 5 minutes until attention; candidate estimate is 2–4 minutes | Candidate fits the 60-second margin; at 4 minutes 59 seconds it does not |
| AC07 | Attention-sensitive task is underway in another component | No optional suggestion appears even if a passive timer has spare time |
| AC08 | Candidate has unknown duration/interruptibility or resource conflict | Candidate is excluded; the system may remain quiet |
| AC09 | Eligible candidates tie without known urgency | Stable recipe-order tie-break; no claim one is more urgent |
| AC10 | Cook dismisses an automatic suggestion then extends the same passive phase | No automatic replacement or repeat; explicit request remains available |
| AC11 | Cook accepts a valid parallel suggestion | Only focus changes; prior work remains incomplete and its timer runs; candidate awaits physical Start |
| AC12 | An accepted offer becomes stale before the command applies | Attention/dependency changes are honoured; no start or completion is inferred |
| AC13 | Physical start is confirmed and named timer is started | One timer starts from the stated reference; repeat delivery creates no duplicate |
| AC14 | Timer expires during chopping | Interrupted appears with chopping preserved; no readiness or chopping completion is recorded |
| AC15 | Two events arrive within 5 seconds | First is not delayed; second joins one group; both remain independently unresolved |
| AC16 | Expired timer is acknowledged | Repeats stop for that event; elapsed-overdue and unresolved checkpoint remain available |
| AC17 | Unacknowledged timer has default audio enabled | One finite alert at expiry, one at 30 seconds, then no repeated sound absent opt-in or a distinct event |
| AC18 | Not yet is selected without authored extension | Only cook-entered duration or untimed continuation is offered; no generated interval |
| AC19 | A linked timer is paused but food continues cooking | App describes timer-only pause; no planning window is derived from it |
| AC20 | App reloads after timer due time | Recovery shows expired timer and last confirmed work; no restart, automatic Ready or alarm backlog |
| AC21 | Tab returns after 90 seconds with no due event | Focus restores directly; after 2 minutes, or any missed due event, Recovery opens |
| AC22 | A priority-one event occurs during Recovery | Interrupted takes precedence; Recovery reconciliation remains pending |
| AC23 | Clock accuracy cannot be trusted | Timing uncertainty is explicit; timer-based suggestions are suppressed until reconciled |
| AC24 | Screen reader follows a running countdown | No every-second announcement; expiry and relevant changes are announced without competing default narration |
| AC25 | Voice says “next” or ambiguous “stop” | Next navigates only; Stop asks clarification with no mutation |
| AC26 | A Done utterance is recognised before focus changes and applied after it | Old context is checked/reconfirmed; the new task is not completed |
| AC27 | Voice is denied, audio muted and keyboard used | All cooking, timer, checkpoint, recovery and completion actions remain operable |
| AC28 | Cook enlarges text or changes distance | Essential quantities, units and instructions remain accessible; state is unchanged |
| AC29 | Completion is corrected after a dependent starts | Physical history remains; dependent is flagged for review; unstarted dependents become blocked |
| AC30 | Cook requests Finish with an unresolved food check | Completed is unavailable; actionable review, return and End unfinished are available |
| AC31 | All required work resolves but an independent timer runs | Cook explicitly retains/detaches or cancels it before Finish; retained timer stays labelled |
| AC32 | Saved recipe is used offline | Available local instructions and state operate; unavailable capabilities are disclosed without invented content |
| AC33 | Second controller requests ownership | It begins read-only; explicit handover/reconciliation precedes edits; conflicts are not silently merged |
| AC34 | Active-session recipe is edited in the library | Session quantities/instructions retain pinned revision until explicit revision review |
| AC35 | Cook selects Cook again after completion | New session has no completed tasks or linked running timers; retained reminders remain separate |
| AC36 | Import contains a dependency cycle | Affected branch cannot start as guided execution; explanation and original instructions are available |
| AC37 | Save fails after a confirmation | Unsaved state is identified; app does not promise recovery of that action |
| AC38 | Cook cancels timer for an incomplete task | Timer stops after explicit confirmation; task and checkpoint remain unresolved |

## 15. End-to-end scenarios

### S01 — Straightforward guided recipe

**Fixture:** Chop herbs → mix dressing → dress salad → serve. No timers; all required.

1. Cook opens Preparing, leaves Guided selected and starts.
2. Inspecting herbs and listening to the instruction leaves progress unchanged.
3. Done confirms chopping. Mixing becomes the focused eligible action.
4. Back revisits herbs without undoing completion; returning to mixing restores incomplete status.
5. Cook completes mixing, dressing and serving, then opens Finishing.
6. With no unresolved work/timers, explicit Finish creates Completed. Optional notes do not alter task history.

**Pass:** No physical progress occurs before explicit confirmation. Covers AC01, AC03–04, AC35.

### S02 — Assisted waiting and optional parallel preparation

**Fixture:** Sauce is confirmed simmering with an 8-minute check timer. Grating cheese takes 1–2 minutes, is interruptible and uses no conflicting resource. A final combine task requires sauce readiness and grated cheese.

1. Cook confirms simmer start and starts the timer. Session becomes Waiting.
2. Assisted offers cheese once because dependencies, resources and timing fit.
3. Accept focuses cheese; sauce timer continues; cheese is still Not started.
4. Cook starts grating. Session becomes Parallel, with sauce still underway.
5. Done confirms cheese. Focus returns to sauce waiting; no other automatic offer replaces the accepted one during the same opportunity.
6. Sauce expiry creates an attention event. Cook selects Check now, confirms Ready and stops the named timer.
7. Combine becomes eligible. Cook completes combine/serve and finishes.

**Pass:** Suggestion acceptance neither starts cheese nor completes sauce; assembly waits for both confirmations. Covers AC06, AC11, AC13–14.

### S03 — Dismissal and silence

**Fixture:** Same sauce and cheese plan; cook prefers to wait.

1. Cook chooses Not now on the cheese offer.
2. No alternative suggestion appears. Toggling Guided/Assisted does not reset the budget.
3. At the sauce check, cook selects Not yet and uses an authored 2-minute interval.
4. The same simmer phase continues; cheese is not automatically reoffered.
5. Cook explicitly asks What can I do? If cheese no longer fits the duration plus margin, the companion says no suitable parallel task fits and stays quiet.
6. Sauce becomes ready; cook later selects cheese as ordinary required work, completes it and finishes.

**Pass:** Dismissal has no guilt message or hidden completion and does not make required cheese disappear. Covers AC08, AC10, AC18.

### S04 — Simultaneous checks during hands-on work

**Fixture:** Vegetables and sauce are physically underway. Cook is chopping garnish. Two check timers expire 3 seconds apart with no authored relative urgency.

1. First expiry opens Interrupted immediately; garnish remains incomplete.
2. Second joins the same group; both are identified as needing attention, with no invented urgency claim.
3. Cook acknowledges the group to silence audio, then opens the sauce check. Acknowledgement alone resolved neither check.
4. Sauce is Ready; vegetables are Not yet. Only sauce's condition resolves.
5. No authored vegetable extension exists. Cook chooses their own labelled 1-minute check reminder.
6. Cook returns to preserved garnish focus. On reminder, vegetables are checked and confirmed Ready.
7. Garnish is completed; join/serving dependencies resolve and Finishing succeeds.

**Pass:** One interruption group, independent physical resolutions, no automatic focus loss or invented extension. Covers AC14–18.

### S05 — Phone call, closed browser and uncertain physical work

**Fixture:** Oven process with a running check timer; focused task is mixing a dressing, not yet confirmed done.

1. Cook answers a call and closes the browser. No task is suspended automatically; timer time continues to elapse.
2. Cook returns after its due time. Recovery shows last confirmed task, dressing incomplete, oven timer overdue and check unresolved.
3. If no background alert was available, the app does not claim it was delivered. It summarises the overdue event once.
4. Check now takes precedence. Cook confirms the oven condition based on the recipe and stops its timer.
5. Recovery asks about dressing. Cook says Already done and confirms its required condition; the app records that report.
6. Resume focuses the next eligible assembly step. Cook finishes remaining work and completes the session.

**Pass:** No timer reset, automatic dressing completion, guessed oven readiness or repeated alarm backlog. Covers AC20–22.

### S06 — Attention-sensitive work and competing deadlines

**Fixture:** An authored attention-sensitive pan phase is underway; a separate oven timer is running; a preparation task would otherwise fit.

1. Assisted offers no preparation task because the sensitive phase is active, regardless of current focus.
2. Oven check becomes due. The app surfaces the conflict and both known attention requirements without completing or pausing the pan work.
3. Cook uses recipe-authored handling guidance and explicitly reports the pan process stopped/made safe before switching attention. Linked timing and resource status are reconciled.
4. Cook checks the oven, then explicitly resumes the pan phase with timing reviewed.
5. Required conditions are checked and resolved before finishing.

**Pass:** No claim that a timer makes frying passive, no invented physical remedy, no optional distraction. Covers AC07, AC19, AC22.

### S07 — Voice ambiguity and accessible fallback

**Fixture:** Two named running timers; a hands-on action is focused; optional speech is enabled.

1. “Next step” previews the next instruction without completing the current action.
2. “Stop timer” produces a target clarification and changes neither timer.
3. Before the answer, a timer event changes context. A later generic “yes” cannot answer the stale stop confirmation.
4. Voice becomes unavailable. Cook uses keyboard/manual controls to return, complete the action and check the timer.
5. Sound off leaves the overdue status and checkpoint operable. Countdown changes do not repeatedly interrupt the screen reader.
6. Cook reconciles both timers and completes using manual controls.

**Pass:** Hands-free failure does not strand the session or mutate the wrong object. Covers AC24–28.

### S08 — Recipe correction, blocked assembly and unfinished ending

**Fixture:** Assembly requires a prepared component. The cook mistakenly marks that component complete and then starts assembly.

1. Cook corrects the component's completion. The app preserves assembly's actual recorded start and flags the dependency conflict.
2. Recovery asks which physical actions happened. The cook confirms the component is not ready; dependent unstarted work is blocked.
3. The app exposes original guidance without inventing a recovery method. Cook chooses not to continue.
4. Finish is unavailable because required conditions remain unresolved.
5. End unfinished lists incomplete work and the remaining timer. Cook explicitly cancels or detaches the timer and confirms ending.
6. The record says Ended unfinished. Cook again starts a fresh session with no inherited completion.

**Pass:** Correction does not reverse food, and abandonment never becomes successful completion. Covers AC29–31, AC35, AC38.

### S09 — Offline restoration and controller conflict

**Fixture:** A locally saved recipe and session have a timer running. A second device has an older record.

1. Primary device goes offline; available recipe instructions and manual controls remain usable, with unsynced status identified.
2. A local action is confirmed. If durable local save fails, the app labels it unsaved rather than promising restoration.
3. Second device attempts continuation. It cannot establish current ownership/state and does not claim exclusive control or overwrite the first record.
4. When both records are available, Recovery shows contradictory facts and timer histories for explicit reconciliation.
5. Cook selects the current physical facts and explicitly takes control on one device.
6. Restored timers reflect reconciled elapsed time; any uncertain timing suppresses suggestions until resolved. Cook finishes remaining work normally.

**Pass:** No silent conflict merge, guessed readiness or false cross-device timer assurance. Covers AC23, AC32–33, AC37.

## 16. Review and release boundary

This is a complete interaction contract for review, with no visual or implementation decisions required to understand it. The first release must satisfy the invariants, state transitions, edge-case rules and acceptance criteria, and support the end-to-end scenarios above through manual interaction even where voice or background notifications are unavailable.

The following defaults are deliberately collected for easy editing: Guided on first use; one automatic offer per passive-phase opportunity; 60-second suggestion return margin; 5-second event grouping window without initial delay; one default repeat at 30 seconds; and Recovery after 2 minutes hidden or any missed due event. Product testing may adjust these values, but must not introduce automatic physical completion, conceal unresolved conditions or promise background capabilities the session does not have.
