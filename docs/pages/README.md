# Pages

Documentation for each page served by the RLCS Stats web application.

All pages are React components rendered via `react-router-dom` in `web/src/App.tsx`. There is no persistent navigation bar; each page provides its own back-to-dashboard button.

| Page | Route | Source |
|------|-------|--------|
| [Home](home.md) | `/` | `web/src/pages/HomePage.tsx` |
| [Player](player.md) | `/players/:uniqueId` | `web/src/pages/PlayerPage.tsx` |
| [Roster](roster.md) | `/rosters/:rosterId` | `web/src/pages/RosterPage.tsx` |
| [Event](event.md) | `/events/:eventId` | `web/src/pages/EventPage.tsx` |
| [Stat](stat.md) | `/stats/:statKey` | `web/src/pages/StatPage.tsx` |
| [Compare](compare.md) | `/compare` | `web/src/pages/ComparePage.tsx` |
