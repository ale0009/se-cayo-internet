# ¿Se cayó internet o solo yo?

**Español** · [English](README.en.md)

Una página que responde una sola pregunta para Colombia: **¿se cayó internet o el problema es solo mío?** Junta cuatro miradas y contesta en una palabra: **No**, **Sí**, **Sí, en «operador»**, **Quizá**, **No: es «servicio»**, **Solo tú** o **No sé**.

- **Tu conexión:** el navegador intenta llegar a 6 sitios grandes (Google, Cloudflare, Wikipedia, Microsoft, Amazon, GOV.CO) y mide el tiempo.
- **Colombia:** señales de [IODA](https://ioda.inetintel.cc.gatech.edu/country/CO) (Georgia Tech) de las últimas 24 h: BGP, sondeo activo y telescopio de red, más alertas y caídas recientes.
- **Operadores:** Claro (hogar y móvil), Movistar, Tigo UNE y ETB, con IODA por ASN y la visibilidad BGP de [RIPEstat](https://stat.ripe.net/).
- **Servicios grandes:** páginas de estado (Statuspage) de GitHub, Cloudflare, Discord, ChatGPT, Reddit, Dropbox, Twitch, Epic Games y Zoom, y los centros de Cloudflare en Bogotá, Medellín, Barranquilla y Cali.
- Cada panel carga y falla por separado. Si una fuente no responde, usa un respaldo marcado «Sin conexión: datos de ejemplo del 10 nov 2026».
- `/proceso/`: qué mide cada fuente, qué fuentes se descartaron y por qué, umbrales, cómo se decide el veredicto, una caída real (15 oct 2026) graficada, diseño, limitaciones y fe de erratas.

No es un monitor oficial: para reportar una falla, llama a tu operador.

## Uso

```bash
python3 -m http.server 8000   # y abrir http://localhost:8000
node --test                   # 27 pruebas (Node 20 o superior)
```

Añade `?sin-conexion` a la URL para ver el modo con datos de ejemplo. Para GitHub Pages basta con servir la rama `main` desde la raíz.

## Estructura

```
index.html, proceso/index.html   las dos páginas (sin build)
css/estilo.css                   línea "Tinta y trama" (claro) y "Jisseki" (oscuro)
js/senales.js                    series de IODA, mediana, umbrales, combinación, alertas
js/operadores.js                 ASN verificados y visibilidad de RIPEstat
js/servicios.js                  Statuspage y centros de Cloudflare en Colombia
js/local.js                      resumen de la prueba local
js/evaluar.js, js/veredicto.js   evaluación de país/operador y veredicto final
js/graficas.js                   trazos SVG (funciones puras)
js/datos.js                      red: peticiones con tiempo límite y respaldo por panel
js/main.js, js/proceso.js        interfaz
datos/ejemplo-2026-11-10.json    respuestas reales guardadas para el modo sin conexión
datos/caida-2026-10-15.json      señales reales de la caída del 15 oct 2026
test/                            pruebas node --test con muestras reales en test/muestras/
```

## De qué trabajo sale

Del trabajo «Caída de Internet: informe detallado» y de la lista de herramientas de ciberseguridad de Mario y David (idea 17): convertir la pregunta de siempre en un diagnóstico rápido y explicado.

## Créditos y licencias

- Datos: [IODA](https://ioda.inetintel.cc.gatech.edu/), © Georgia Tech Research Corporation · [RIPEstat](https://stat.ripe.net/), RIPE NCC · páginas de estado públicas de cada servicio.
- Fuentes tipográficas: Bangers, Atkinson Hyperlegible e IBM Plex Mono (Google Fonts, licencia OFL).
- [Mario Puerta «ale0009»](https://github.com/ale0009) × [David Rincón «Kuronoma»](https://www.linkedin.com/in/davidalexanderrinconcorredorkuronoma/)

Código con licencia MIT © 2026 Mario Alejandro Puerta Alarcón y David Alexander Rincón Corredor.
