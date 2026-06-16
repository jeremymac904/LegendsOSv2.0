# LegendsOS v2.0 UI/UX PowerPoint Sprint Plan

## Source Reviewed

- PowerPoint: `/Users/JeremyMcDonald/Downloads/LegendsOS UI_UX May 20th Audit 9pm (1).pptx`
- Rendered review slides: `outputs/manual-20260520-uiux-audit/presentations/ppt-source/rendered/slide-01.png` through `slide-10.png`
- Slides reviewed: Login, Dashboard, Training, Marketing Materials, LF Resources, Atlas Workspace, Settings, and impersonation preview banner.

## Boardroom Review Summary

- UI and visual design: unify gold into burnt/champagne brand tokens, reduce flat black blocks, and make cards translucent liquid glass.
- Mortgage LO UX: make Dashboard, Training, Marketing Materials, and LF Resources answer "what do I do next?" instead of feeling like admin directories.
- Admin and owner workflow: keep owner-only controls protected, preserve impersonation, and make setup surfaces actionable without exposing secrets.
- LO simplicity: keep external Drive links secondary; cards should open internal guidance first.
- Atlas Hermes workspace: make chat the focus, keep Projects and Resources collapsible, and support screenshots/attachments clearly.
- Training/content library: add useful detail pages, video support, nuggets, next steps, and internal guidance.
- Settings/integrations: make every setup-needed card open an explanation panel with exact env names and safe next actions.
- QA/deployment: validate lint, typecheck, build, routes, click targets, role preview, and production after deploy.

## Priority Fixes

1. Brand color and liquid glass system across shell, cards, buttons, chips, and login.
2. Wider responsive app shell so content uses available desktop width.
3. Login page copy, logo size, video/download card alignment, and premium styling.
4. Training, Marketing Materials, and LF Resources internal detail routes so cards are not dead or Drive-first.
5. Settings connection setup cards that open real setup guidance panels.
6. Atlas workspace focus with collapsible side panels and attachment-only sending.
7. Impersonation guard gaps so owner-only pages respect effective LO preview.

## Implemented In This Sprint

- Global Tailwind/CSS brand tokens for richer gold, champagne highlights, charcoal glass, and transparent card surfaces.
- Wider protected app layout.
- Login page visual update and stronger command-center copy.
- Resource detail pages for Training, Marketing Materials, and LF Resources.
- Starter marketing content for webinars, buyer guides, realtor guides, AI seminars, newsletter templates, social campaign packs, open house material, handouts, outlines, and scripts.
- LF Resources internal landing pages for all required Loan Factory categories, with the provided Drive folder as a secondary source action.
- Settings setup panel component for n8n, HeyGen, Google, Drive, social channels, MCP, Telegram, and AI providers.
- Atlas side panel defaults/collapse behavior, attachment-only send, and desktop/window capture guidance.
- Admin/impersonation safeguards for effective role preview and audited DELETE stop behavior.

## Deferred

- Full CMS editing for resource detail content.
- Direct Google Drive folder introspection.
- Live social publishing or live email sending.
- Apple notarized desktop release work, which remains documented separately.

## Blockers

- The provided Google Drive folder was not directly read through a connector in this sprint. The UI uses the supplied URL and internal starter structure so Jeremy can add approved private links manually.
