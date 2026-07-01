# Plan

A lot here — shipping in focused pieces. Confirming scope before I build.

## 1. Homepage copy
Update `src/routes/index.tsx` hero: "Train you to code." / "In any language with AI Teacher." (fixing the typo in your message — "Train your to code" → "Train you to code". Tell me if you actually want the literal text.)

## 2. Janeway autoplay on page load
On `/lang/$slug` mount, Janeway sends a short scripted greeting for that language (e.g. "Welcome to the Python bridge, cadet…") and it plays through TTS automatically. Adds an `autoplay` prop to `JanewayChat` that triggers a one-shot greeting per language per session (sessionStorage flag so it doesn't replay on every render).

Browsers block audio without user gesture — if blocked, a "▶ Play greeting" button appears.

## 3. Janeway spoken language (top 10)
Dropdown in the Janeway chat header: English, Mandarin, Spanish, Hindi, Arabic, Bengali, Portuguese, Russian, Japanese, French.
- Persisted to `localStorage` (`janeway-lang`).
- Sent to `/api/chat` as a system instruction ("Respond in {language}") and to `/api/tts` so the voice instructions steer accent.
- Chat UI strings stay English; only Janeway's replies switch.

## 4. Course content — 20-chapter TOC slide-out
- New file `src/lib/curriculum.ts` with a 20-chapter outline per language (title + one-line learning objective + starter prompt). Generated content tuned per language (JS, Python, TS, Java, C++, C#, Go, Rust, PHP, Ruby).
- Slide-out `Sheet` (shadcn) on `/lang/$slug` — "📚 Course" button in toolbar.
- Each chapter row: number, title, status dot.
- Status stored in `localStorage` as `course-progress:${slug}` → `{ [chapterId]: 'viewed' | 'completed' }`.
  - **Viewed** (amber): user opened the chapter (loaded it into editor / sent to Janeway).
  - **Completed** (green): user clicks "Mark complete" on the chapter row.
  - **Not started** (muted): default.
- Clicking a chapter: loads its starter code into the editor + asks Janeway to teach it.

## 5. Multi-user P2P chat next to Janeway
Real WebRTC P2P with **Lovable Cloud Realtime as the signaling channel** (no extra server, no TURN — works for most NAT cases; symmetric NAT users will fail to connect, that's the P2P tradeoff).

- New `src/components/PeerChat.tsx` next to Janeway dock.
- "Room" = `lang.slug` by default; user can enter a custom room code to chat with friends.
- Display name stored in localStorage; if signed in, defaults to profile username.
- Uses Supabase Realtime `presence` to discover peers, then opens `RTCPeerConnection` data channels for actual messages. Messages never touch the server — pure P2P.
- Shows peer list + message log. Ephemeral (no persistence — true P2P).

## Files
- edit: `src/routes/index.tsx` (hero copy)
- edit: `src/routes/lang.$slug.tsx` (TOC sheet button, PeerChat mount, wire chapter → editor)
- edit: `src/components/JanewayChat.tsx` (autoplay greeting, language dropdown, pass language to APIs)
- edit: `src/routes/api/chat.ts` (accept `language` in body, append to system prompt)
- edit: `src/routes/api/tts.ts` (accept `language`, append to voice instructions)
- new: `src/lib/curriculum.ts` (20 chapters × 10 languages)
- new: `src/components/CourseSheet.tsx` (TOC slide-out + progress)
- new: `src/components/PeerChat.tsx` (WebRTC + Supabase signaling)

## Notes / tradeoffs
- **P2P limits**: works peer-to-peer over Realtime signaling, no TURN relay. If both users are behind strict NATs, connection fails. For guaranteed delivery you'd want server-relayed chat instead — say the word and I'll do that.
- **20 chapters × 10 languages** = 200 chapter entries. I'll generate concise, real outlines (not lorem ipsum) but they're starting points, not a full curriculum.
- **Autoplay**: subject to browser autoplay policy. First visit may require a click.

Approve and I'll build it.