# ShowFlow — English Devpost draft

Status: working draft, not submitted. Replace the pending cloud and video sections with verified results before final submission.

## Tagline
From your pitch deck to a presentation you can deliver.

## Inspiration
Founders often prepare a pitch across disconnected tools: a deck editor, a browser full of reference decks, an AI chat, and a timer. The transition between these tools can lose the original story, introduce unsupported claims, and leave little time to rehearse. ShowFlow brings this preparation loop into one workspace.

## What it does
Import an existing PPTX while keeping its original bytes. Discover similar companies through a live public pitch catalog, retain source links and write concrete borrowing notes. Ask for edits to selected slides, compare the suggestions and selectively adopt them. Change global or per-slide visual styles, export editable PowerPoint, then rehearse with planned timings, pause and flag moments for review.

## How we built it
A React/Vite interface connects a browser-local PPTX parser, IndexedDB project storage, editable PPTX export and a timed Stage Console. Firebase AI Logic is called at runtime through the official JavaScript SDK, with App Check and explicit processing scope. Device-only editing uses ONLY_ON_DEVICE. Optional consented cloud and hybrid paths use ONLY_IN_CLOUD and PREFER_ON_DEVICE, with the actual SDK inference source recorded per slide.

## What is verified now
Two English synthetic slides generated real ON_DEVICE output with verified App Check locally. The product preserves prototype/pilot qualifications and requires the presenter to review wording and claims. One suggestion in the recorded run was intentionally rejected. The hosted preview provides the non-AI preparation workflow and clearly states that hosted live AI activation is pending.

## Challenges
Cloud calls on the original free Spark project returned an eligibility 403. We have requested a temporary hackathon account, kept the free baseline, and have not claimed a successful cloud response or fallback. Exact Nano 4 identity is still being independently checked. PPTX content previews also differ from native PowerPoint for complex objects, so originals are retained separately.

## Accomplishments
An end-to-end editable preparation and rehearsal flow, genuine private device inference, selective adoption, explicit source provenance, and an English judging experience using a synthetic deck without customer data.

## What we learned
Human review is part of the product. A shorter AI suggestion can still add an unsupported implication. Local inference protects the selected content path, but setup, attestation and offline loading have distinct requirements.

## What's next
Validate the issued quota and a real consented device-to-cloud handoff, configure production attestation for hosted live AI, independently confirm the required device model, and finish the public English YouTube demonstration and final submission.

## Built with
Firebase AI Logic, Firebase App Check, Gemini Nano, Gemini API (cloud integration pending validation), React, Vite, IndexedDB, JSZip, fast-xml-parser, PptxGenJS, Phosphor Icons. AI coding assistance and generated synthetic artwork are disclosed in README and THIRD_PARTY.md.

## Work during the submission period
The ShowFlow application, reference and style workflows, PPTX pipeline, Firebase device integration, English interface and judging materials were built November 15–17, 2026. Standard packages and AI development tools were used; no existing third-party product is submitted as original ShowFlow code.
