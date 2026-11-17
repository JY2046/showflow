# ShowFlow — reviewer testing instructions

## Entry points

- Hosted preview: https://showflow-hybrid-ai.bambi2005star.chatgpt.site
- Public source: https://github.com/JY2046/showflow
- Sample: `public/samples/ShowFlow_English_Sample.pptx`
- Historical device evidence: `public/evidence/on-device-run.json`

The hosted preview is free, does not need an account, and currently supports the non-AI workflow. Hosted AI activation is pending. The local source includes the real Firebase inference path; configure your own test Firebase project for new inference. No project secrets or shared credentials are supplied.

## Five-minute hosted walkthrough

1. Open Reviewer guide and click Try English sample. The active project is replaced by a synthetic two-slide deck; the previous project and original remain in browser-local versions. You can also import a PPTX of up to 30 slides / 30 MB.
2. Collect references with `team collaboration SaaS pitch deck`. Expect up to six distinct companies from a freshly fetched public catalog. Open Source links and verify the original independently. Metadata matching is not a complete-deck reading or an endorsement.
3. Open Styles. Choose Minimal Paper globally, select slide 2 and choose a different theme/layout. Export the editable PPTX. Text and the main image per slide are restyled; complex objects/animations are retained only in the preserved original.
4. Open Director, inspect notes, and start rehearsal. Wait several seconds, pause, then mark and advance. Finish and review actual elapsed time against the plan. Export cue cards. Timing reflects this test run; it is not an automated speaking-quality score.
5. Reload. Confirm the imported project, styles and AI plan, if any, are restored. Rehearsal/Q&A state is currently session-only. A different origin or browser has a separate project store.

## New Firebase device test (local source)

Follow README setup with a supported desktop Chrome and your own Firebase/App Check configuration. Prepare the device model in the app, verify App Check, select device-only English editing, inspect scope, and generate. Expected evidence: `Firebase AI Logic`, `ON_DEVICE`, verified App Check, per-page source and duration in the exported revision record. Suggestions require review and selective adoption. Model text may be poor: reject unsupported implications. Do not paste a debug token into a public form, repository or submission.

## Cloud and hybrid acceptance still pending

After usable quota is issued: preserve the existing baseline, configure the issued project separately, verify App Check, obtain a real `IN_CLOUD` result, then deliberately test a consented device-unavailable handoff. Record actual SDK provenance. An error or a previous result must never be reported as a new success. No paid plan is authorized. Exact Nano 4 identity also remains a separate acceptance item.

The local historical record is dated and contains no credential. It is evidence of the prior run only, not proof that the hosted preview can generate new output.

## Review-state checklist

- Available: import, original retrieval, live catalog links, styles, editable export, timers, pause/mark, review, cue cards, local project persistence.
- Verified locally: genuine Firebase ON_DEVICE generation and App Check.
- Pending: hosted live AI, cloud generation, successful fallback, exact Nano 4 confirmation, final YouTube publication and final Devpost submission.

For the competition deadline and submission terms, consult the official contest rules. This guide is an implementation status report, not a guarantee of eligibility.
