WCAG 2.2 AA + Section 508 audit — Round 3 (t_30f64725)
Auditor: lara (a11y-seo-workflow) · Method: token-level + component-level contrast math (WCAG formula), DOM/keyboard review of source

VERDICT: A11y NEEDS_REVISION — dark-mode contrast (mandatory item) fails in both themes. SEO PASS.

═══════════════════════════════════════════
MANDATORY ITEM — DARK MODE CONTRAST: FAIL
═══════════════════════════════════════════
Token audit (globals.css:405-495) computed actual WCAG ratios for every semantic
token in light + dark on all three surfaces (page/card/sunken). 12/40 token-level
checks and 12/32 component-level checks FAIL. Details:

[HIGH] --ink-faint fails in BOTH themes on ALL surfaces
  globals.css:29 (#9CA3AF light) / globals.css:477 (#64748b dark)
  Light: 2.39:1 page · 2.54:1 card · 2.31:1 sunken (need 4.5:1)
  Dark:  4.05:1 page · 3.64:1 card · 3.90:1 sunken (need 4.5:1)
  Used as real text at 9-13px in 12+ places, e.g.:
  - LearnHub.tsx:83 group headers (12px bold uppercase)
  - PathCard.tsx:66 "Coming soon" badge (11px bold)
  - LearnFilters.tsx:98,112 inactive subgroup chips (11px bold)
  - ProfileForm.tsx:100,120 helper text (11.5px)
  - settings/page.tsx:80,107,127 helper text (12px/xs)
  - profile/page.tsx:101,107 email + "Change password" (11.5/13px)
  - CertificateSection.tsx:48,138,160 empty states + earned date (12-13px)
  - AvatarMenu.tsx:260 + Header.tsx:174 "Signed in as" (9px)
  Fix: darken light-theme ink-faint to ~#6B7280 (gray-500, 4.7:1 on white),
  lighten dark-theme to ~#94A3B8 (slate-400, 6.7:1 on card).

[HIGH] --accent as text fails in DARK on card surfaces
  globals.css:484 #E8354A on card #121a2e = 4.15:1; on card-soft = 4.37:1 (< 4.5:1)
  Used as 10.5-13px text: settings/page.tsx:30,60 kickers; profile/page.tsx:74,
  115,125; learn/page.tsx:61; LearnHub.tsx:86 count badge (3.94:1 on 8% accent bg);
  ProfileForm.tsx:128 error alert; CertificateSection.tsx:166 "View cert" link;
  AvatarMenu.tsx:107 danger item; Header.tsx:198 mobile sign-out.
  Fix: dark accent needs to be lighter (e.g. #F0506A) to pass 4.5:1 on cards,
  or use a dedicated dark-mode accent token.

[HIGH] --accent-hover fails in DARK on cards
  globals.css:485 #C8102E on card #121a2e = 2.94:1; on card-soft = 3.09:1
  Used: AvatarMenu.tsx:107 hover, CertificateSection.tsx:166 hover,
  LearnFilters.tsx:98,112 chip hover.

[HIGH] White-on-accent chip fails in DARK (LearnFilters active subgroup)
  LearnFilters.tsx:97,111 — bg-[var(--accent)] + text-white: #FFF on #E8354A
  = 4.17:1 (< 4.5:1 for 11px bold). Light passes (5.88:1).

[HIGH] Learn h1 gradient tail invisible in DARK
  learn/page.tsx:65 — bg-gradient to-[var(--surface-inverse-hover)]; tail
  #334155 on page #0a0e1a = 1.86:1 (large text needs 3:1). The right end of
  the "Learn" headline fades into the background in dark mode.
  Fix: dark-mode gradient endpoint should be a light slate (e.g. #94A3B8),
  not --surface-inverse-hover.

[HIGH] --signal-done fails as text/icon in LIGHT on white cards
  ProfileForm.tsx:133 "Saved." status (#10B981 on #FFF = 2.54:1, needs 4.5:1)
  settings/page.tsx:86 check icon (#10B981 on #FFF = 2.54:1, non-text needs 3:1)
  (dark pair passes: #34d399 on card = 9.01:1)

[MED] --signal-done-bg / --signal-warn-bg light pairs
  globals.css:455-457 — #10B981 on #d1fae5 = 2.24:1; #F59E0B on #fef3c7 =
  1.93:1. Verify quiz/read-state components that use these bgs keep text off
  them or use dark text.

PASS (dark-mode): ink-strong/primary/body/muted on all surfaces (6.75-17.58:1);
ink-on-inverse on navy/slate (13.7-14:1); signal-done/signal-warn text on dark
cards (9.01/10.37:1); ContinueLearning white/65-70 on inverse (7.0-8.7:1);
PathCard badges white-on-black (4.7-19.8:1).

═══════════════════════════════════════════
KEYBOARD + FOCUS — 2 FINDINGS
═══════════════════════════════════════════
[HIGH] AvatarMenu theme quick-toggle is not keyboard operable (WCAG 2.1.1)
  AvatarMenu.tsx:291-298 — the theme row is <div role="menuitem" tabIndex={-1}
  onClick=...> wrapping <ThemeToggle compact/> (a <button>). Roving focus via
  getItems() (AvatarMenu.tsx:139-145) targets the DIV, not the button; the div
  has no onKeyDown, so Enter/Space on the focused row do nothing (native
  activation only works on real buttons/links). The inner button is never
  focused by the roving pattern.
  Fix: put role="menuitem" + roving focus on the actual <button> (or forward
  Enter/Space on the div to the button).

[MED] ProfileForm input focus indicator is too subtle (WCAG 2.4.7)
  ProfileForm.tsx:98,118 — focus:outline-none + border change + 3px ring at
  8% opacity (focus:ring-[var(--accent)]/[0.08]). On dark cards the ring is
  nearly invisible; the global a/button:focus-visible outline (globals.css:
  99-104) does NOT apply to inputs. Recommend a 2px outline or ring ≥ 0.25
  opacity on :focus-visible for inputs.

PASS: ProfileForm labels (htmlFor) + role=alert/status; segmented ThemeToggle
aria-pressed + role=group; Escape/outside-click/Tab handling in AvatarMenu;
skip link + focus-visible outlines present globally.

═══════════════════════════════════════════
LEARN HUB GUEST GATING — PASS
═══════════════════════════════════════════
PathCard.tsx:70-93,112-117: guest cards render as non-clickable <div> (no Link),
CTA is a real <Link> with descriptive text ("Sign in to access courses"),
lock icon aria-hidden with visible text, series name + description readable,
"Start track" hover overlay suppressed for guests (PathCard.tsx:36). SEO-safe:
name + description stay server-rendered in the DOM. Empty series → "Coming soon"
badge, non-interactive. Heading hierarchy h1→h2(group)→h3(card) has no skips.

═══════════════════════════════════════════
SPACING — PASS (no regression)
═══════════════════════════════════════════
WS-1 scale (globals.css:405-430) applied consistently: --space-card-pad 22px
(PathCard.tsx:57, LearnHub grid gap-5), --space-gutter-page 24px (px-6),
--space-section-bottom 96px. Round 3 files use token-consistent values
(px-[22px], py-5, px-7, mb-3/6). spacing-audit-round3.md documents the fixes;
no new off-scale spacing introduced in the audited files.

═══════════════════════════════════════════
SEO — PASS
═══════════════════════════════════════════
/learn: metadata via buildMetadata (title, desc, canonical, OG, Twitter),
JSON-LD ItemList (learn/page.tsx:31-43), h1→h2→h3 hierarchy, guest cards
server-rendered for crawlers. /profile + /settings: metadata set, auth-gated
(redirect for guests) — correct. No duplicate-title or canonical issues.

═══════════════════════════════════════════
SEVERITY COUNTS
═══════════════════════════════════════════
Critical: 0 · High: 6 · Medium: 2 · Low: 0
A11y verdict: NEEDS_REVISION (dark-mode contrast — mandatory item)
SEO verdict: PASS
