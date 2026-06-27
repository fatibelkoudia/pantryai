# Plan de correction des bogues

This is how we handle bugs on PantryAI: where they get logged, how we rank them,
and how they get closed. We run everything through GitHub Issues so there is one
trail from "found a problem" to "fixed and verified".

It pairs with the [cahier de recettes](./cahier-de-recettes.md): when an acceptance
scenario fails, we open a bug here and link it back to the scenario id. The
scenario stays red until the bug is closed and the scenario re-runs green.

## Where bugs come from

- A failed scenario in the cahier de recettes (most common during validation).
- An error caught in production by Sentry (see [monitoring.md](./monitoring.md)).
- Something a user or the team reports during normal use.

Whatever the source, it becomes one GitHub Issue with the bug template, so it is
tracked the same way.

## Severity

We rank every bug so we fix the important ones first.

| Niveau         | Meaning                                              | Exemple                                       | Délai cible                      |
| -------------- | ---------------------------------------------------- | --------------------------------------------- | -------------------------------- |
| **Bloquant**   | A Must feature is unusable, or data is lost / leaked | Login is down, one user reads another's stock | Fix before any release, same day |
| **Majeur**     | A feature works wrong but there is a workaround      | OCR misses items on one retailer              | Within the current iteration     |
| **Mineur**     | Small functional issue, low impact                   | A filter misses an edge case                  | Next iteration                   |
| **Cosmétique** | Visual or wording only                               | Misaligned badge, typo                        | When convenient                  |

A bug that fails a **Must** scenario is at least Majeur, and Bloquant if it loses
or leaks data or takes the feature down. A Must scenario can never ship red.

## Labels

We use a small, consistent label set so the board is easy to filter:

- `bug` on every issue.
- Severity: `severity:bloquant`, `severity:majeur`, `severity:mineur`,
  `severity:cosmetique`.
- Area: `area:auth`, `area:stock`, `area:ocr`, `area:web`, `area:mobile`,
  `area:infra`, `area:rgpd`.
- `regression` when something that used to work broke.

## Lifecycle

An issue moves through these states (tracked with labels or a project board):

```
Ouvert ─▶ Trié ─▶ En cours ─▶ En revue ─▶ Corrigé ─▶ Vérifié / Fermé
```

1. **Ouvert** — the issue is created with the template filled in.
2. **Trié** — we set the severity and area labels and decide when it gets done.
3. **En cours** — someone is working on it on a `fix/...` branch.
4. **En revue** — a pull request is open, CI is green, it is being reviewed.
5. **Corrigé** — the fix is merged.
6. **Vérifié / Fermé** — the linked cahier scenario was re-run and passes. Only
   then do we close the issue.

## The fix-verification rule

A bug is not closed because code was merged. It is closed when the scenario that
caught it runs green again. The closing comment records:

- the linked scenario id (for example `CR-OCR-04`),
- the commit or pull request that fixed it,
- the date the scenario was re-run and passed.

For a production bug found by Sentry with no existing scenario, we add a new
scenario to the cahier de recettes so the case is covered from then on, then close
the bug against it.

## Branch and commit convention

Fixes follow the project git flow: a `fix/<short-name>` branch off `develop`, a
Conventional Commit (`fix(ocr): ...`), and a pull request that references the issue
with `Closes #123`. CI has to be green before merge.

## Worked example

| Champ        | Valeur                                               |
| ------------ | ---------------------------------------------------- |
| Titre        | Native Carrefour PDF still calls Mistral             |
| Scénario     | CR-OCR-04                                            |
| Sévérité     | Majeur (`severity:majeur`, `area:ocr`)               |
| Étapes       | Upload the native PDF fixture, watch the logs        |
| Attendu      | Zero Mistral calls, items parsed from the text layer |
| Constaté     | Mistral is called, names come back garbled           |
| Correctif    | `fix(ocr): use text layer before Mistral` (PR #42)   |
| Vérification | CR-OCR-04 re-run on 2026-06-28, green. Issue closed. |

## Issue template

The repository ships a bug form at
`.github/ISSUE_TEMPLATE/bug_report.yml`, so every bug is filed with the same
fields: description, linked scenario id, steps, expected vs actual, severity, and
environment. New bugs should use it rather than a blank issue.
