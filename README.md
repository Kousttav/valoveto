# Valorant Map Veto (React + Express)

Two captains get private links, a fair coin toss decides who chooses, then the
map veto runs live (Server-Sent Events) according to the selected mode.

## Features
- Create a match: 2 team names, mode (Bo1 / Bo2 / Bo3 / Single / Double / Triple), map pool
- Private captain links + public spectator link (`/m/:id/:token`, `/m/:id`)
- Server-side fair coin toss (`crypto.randomInt`) + standalone `/toss` page
- Toss winner chooses **map first** or **side**; the other team picks the side on each pick
- All veto rules enforced on the server (captains can't act out of turn)
- Admin panel (`/admin`, password protected): add/remove maps, upload map images, toggle default pool
- Hype UI: splash intro, glitch titles, lock-in flashes, custom Valorant cursor, click bursts

## Run (development)
```bash
npm run install:all
ADMIN_PASSWORD=yourpass npm run dev      # API :4000, React :5173
```
Open http://localhost:5173

## Run (production, single process)
```bash
npm run install:all
npm run build
ADMIN_PASSWORD=yourpass SECRET=some-long-random-string PORT=4000 npm start
```
Express serves the built React app and the API on one port.

## Env vars
| Var | Default | Notes |
|-----|---------|-------|
| `PORT` | 4000 | |
| `ADMIN_PASSWORD` | admin123 | **change it** |
| `SECRET` | random each start | set to keep admin sessions across restarts |

Data lives in `server/data/db.json`, uploaded images in `server/uploads/`
(back both up / mount a volume when deploying).

## Veto sequences
- **Bo1**: alternate bans until one map is left (decider)
- **Bo2**: ban, ban, pick, pick
- **Bo3**: ban, ban, pick, pick, bans until one is left (decider)
- **Single / Double / Triple**: alternating picks only
Each pick: the opposing team chooses Attack/Defense. Decider side: the team whose turn is next.

## API
`GET /api/maps` · `POST|PUT|DELETE /api/maps[/:id]` (admin) · `POST /api/admin/login`
`POST /api/matches` · `GET /api/matches/:id?token=` · `GET /api/matches/:id/stream` (SSE)
`POST /api/matches/:id/{toss|choice|action}` · `GET /api/toss`
