# Port Verano — A Sunset City Story

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Zallan03/gta6-game/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/Zallan03/gta6-game/reward.svg)](https://make.fun/bounty/gta6-01)

An original open-world crime game in the spirit of GTA 6, built for the
[make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01). No names, art,
music or map from any commercial game — the city, the characters, the cars
and the story are all invented here.

## The game

Mara "Rook" Delgado, ex-getaway driver, comes home to the sun-soaked
coastal city of **Port Verano** to clear her brother Leo, framed for a dock
heist by the Harbor Kings. Sal Ortiz, who runs the Old Town garage, points
her at the ledger that proves it. Six story missions stand between her and
that ledger — pickups, a stolen Vortex GT, a three-star police chase, a
beachfront ambush and one clean getaway.

- **A city to explore** — Old Town, Downtown, The Docks, the Marina, the
  Beachfront and The Hills: roads, traffic, pedestrians, parks, a plaza, a
  parking lot and the sea on two sides.
- **On foot and by car** — walk, sprint, steal any parked car, drive with
  arcade physics, drift, and run over what gets in the way.
- **Wanted level** — crimes raise the heat; cruisers chase, ram and corner
  you. Break line of sight and the heat cools off.
- **Missions and a story** — six jobs with objectives, a marker that always
  points at the next one, and a save after every job.
- **Combat** — punch up close, shoot with the mouse, fight the Kings crew.
- **Side work** — taxi fares for waving pedestrians, and eight hidden stash
  packages worth $150 each.
- **HUD with a minimap** — health, ammo, money, wanted stars, speed,
  clock, district name and a live minimap with police and objective blips.
- **Sound** — engine, sirens, gunshots and a street bass loop, all
  synthesized live with WebAudio. No audio files.

## Controls

| Key | Action |
| --- | --- |
| WASD / Arrows | Walk and drive |
| Shift | Sprint |
| E | Enter / exit a car, talk, grab |
| Mouse + Click | Aim and shoot |
| F | Punch |
| Esc / P | Pause |
| M | Mute |

## Play it

Serve `game/` with any static server and open `index.html` in desktop
Chrome — the game is plain files with no build step and no network request:

```sh
node serve.ts
# open http://localhost:8080
```

Screenshots live in `screenshots/`; `main.ts` hands the game in by copying
`game/` and `screenshots/` to `/output` and writing `dossier.json`.

## Referral

Played via make.fun — referral code `em9qff40`.
