# Is the internet down, or is it just me?

[Español](README.md) · **English**

A single-purpose page for Colombia: **is the internet down, or is the problem only on my side?** It combines four views and answers in one word (in Spanish): **No**, **Yes**, **Yes, on «carrier»**, **Maybe**, **No: it's «service»**, **Just you** or **Don't know**.

- **Your connection:** the browser tries to reach 6 large sites (Google, Cloudflare, Wikipedia, Microsoft, Amazon, GOV.CO) and times it.
- **Colombia:** last 24 h of [IODA](https://ioda.inetintel.cc.gatech.edu/country/CO) signals (Georgia Tech): BGP, active probing and network telescope, plus recent alerts and outages.
- **Carriers:** Claro (home and mobile), Movistar, Tigo UNE and ETB, using IODA per ASN and BGP visibility from [RIPEstat](https://stat.ripe.net/).
- **Big services:** Statuspage status of GitHub, Cloudflare, Discord, ChatGPT, Reddit, Dropbox, Twitch, Epic Games and Zoom, and Cloudflare's data centers in Bogotá, Medellín, Barranquilla and Cali.
- Each panel loads and fails on its own. If a source is unreachable, a fallback labeled "offline: sample data from 10 Nov 2026" is used.
- `/proceso/` (Spanish): what each source measures, discarded sources and why, thresholds, how the verdict is decided, a real outage (15 Oct 2026) charted, design, limitations and errata.

Not an official monitor: to report an outage, call your carrier.

## Usage

```bash
python3 -m http.server 8000   # then open http://localhost:8000
node --test                   # 27 tests (Node 20+)
```

Add `?sin-conexion` to the URL to force sample-data mode. For GitHub Pages, serve the `main` branch from the root.

## Origin

From the coursework "Caída de Internet: informe detallado" (Internet outage report) and Mario and David's list of cybersecurity tools (idea 17).

## Credits and licenses

- Data: [IODA](https://ioda.inetintel.cc.gatech.edu/), © Georgia Tech Research Corporation · [RIPEstat](https://stat.ripe.net/), RIPE NCC · each service's public status page.
- Fonts: Bangers, Atkinson Hyperlegible and IBM Plex Mono (Google Fonts, OFL).
- [Mario Puerta «ale0009»](https://github.com/ale0009) × [David Rincón «Kuronoma»](https://www.linkedin.com/in/davidalexanderrinconcorredorkuronoma/)

MIT-licensed code © 2026 Mario Alejandro Puerta Alarcón and David Alexander Rincón Corredor.
