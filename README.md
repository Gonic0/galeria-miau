# Galería Miau

Galería virtual de arte solidario en WebGPU/WebGL2 con three.js r184. Recorrido 3D inmersivo con post-procesamiento TSL (SSR, GTAO, SMAA, Film, LUT, Anamorphic, Outline) y diseño visual de museo (cédulas tipográficas serif, iluminación cinematográfica con tone mapping ACES).

## Stack

- **three.js 0.184** con `WebGPURenderer` + fallback automático a WebGL2
- **TSL (Three Shading Language)** para todo el pipeline post-pro
- **Vite 8** con Rolldown + code splitting de three-core / three-postprocess / lucide / app
- **lucide** para iconografía
- **Cormorant Garamond** vía Google Fonts para tipografía de cédulas
- **WebAudio sintético** para ambiente, pasos y maullidos (sin assets)

## Desarrollo

```bash
pnpm install
pnpm dev
```

Abrir `http://localhost:5173`. Requiere navegador con WebGPU o WebGL2 habilitado. Probado en Chrome 121+, Edge 121+, Safari 18+.

### Scripts

```bash
pnpm dev                  # servidor dev en :5173
pnpm build                # build de producción a dist/
pnpm preview              # servidor de preview del build
pnpm compress-textures    # convierte PNG en public/artworks/ a WebP (sharp)
pnpm verify               # smoke test con Playwright
```

## Deploy a Vercel

El proyecto está pre-configurado con `vercel.json` y code splitting optimizado. Tres opciones:

### Opción A: GitHub + Vercel UI

1. Push del repo a GitHub
2. En Vercel: **New Project** → importar el repo
3. Vercel detecta el `vercel.json` y usa:
   - Build: `pnpm build`
   - Install: `pnpm install --frozen-lockfile`
   - Output: `dist`
4. Deploy automático en cada push

### Opción B: Vercel CLI

```bash
pnpm dlx vercel
# Primera vez: link al proyecto
pnpm dlx vercel --prod
```

### Opción C: drag-and-drop

```bash
pnpm build
# subir la carpeta dist/ a vercel.com/new
```

### Cache headers configurados

`vercel.json` aplica `Cache-Control: public, max-age=31536000, immutable` a:
- `/assets/*` — chunks JS/CSS con hash
- `/artworks/*` — imágenes WebP de obras
- `/hdr/*` — mapas HDR para PMREM environment

`index.html` queda con `must-revalidate` para que cada deploy invalide el shell.

### Variables de entorno

Ninguna requerida. La galería corre 100% client-side. Si más adelante agregamos Mercado Pago u otros endpoints, las claves van en Vercel → Settings → Environment Variables.

## Estructura

```
.
├── public/
│   ├── artworks/          # WebP de las obras (970KB total)
│   ├── hdr/               # HDR equirectangular para environment (1KB)
│   └── user-photos/       # placeholders para futuras obras
├── src/
│   ├── main.js            # entry point, escena 3D, pipeline TSL, UI logic
│   ├── styles.css         # CSS app-wide, cédula serif, modal
│   └── gallery/
│       ├── catalog.js     # config de obras, donaciones, sponsors
│       └── audio.js       # WebAudio sintético
├── scripts/
│   ├── compress-textures.mjs    # PNG → WebP con sharp
│   └── verify-gallery.mjs       # smoke test
├── vite.config.js         # code splitting + asset paths
├── vercel.json            # cache headers + framework=null
├── index.html             # shell con splash, welcome, modal
└── package.json
```

## Inyectar nuevas obras

1. Agregá la foto en `public/artworks/` (preferentemente WebP — usá `pnpm compress-textures` para convertir desde PNG).
2. Sumala a `temporaryPhotos` en `src/gallery/catalog.js` con `id`, `title`, `artist`, `year`, `image`, `frame`, `accent`, `story`, `prompt`.
3. La sala rellena las 15 posiciones de `artworkSlots` repitiendo las fotos disponibles.

Las paredes son `front`, `back`, `left` y `right`. El `offset` mueve cada marco a lo largo de esa pared. Las fotos se recortan automáticamente sin deformarse.

## Configuración de campaña

`galleryConfig.donation` y `sponsors` en `src/gallery/catalog.js` definen el panel de aportes y la franja de patrocinadores. Cambiá `checkoutUrl` cuando tengas la URL real de Mercado Pago u otro proveedor.

## Performance objetivo

- **Mobile portrait (390px)**: 60+ FPS WebGPU, 30+ FPS WebGL2 fallback
- **Tablet (768px)**: 60 FPS WebGPU
- **Desktop (1280px)**: 60+ FPS
- Bundle gzip: ~300KB (three-core 233KB + postprocess 46KB + app 16KB + lucide 2KB)

## Roadmap

- [ ] Postal compartible al completar las 4 obras únicas (Web Share API)
- [ ] Audio guía con Speech Synthesis al enfocar cada obra
- [ ] `prefers-reduced-motion` para desactivar animaciones
- [ ] Mercado Pago Checkout Bricks para donaciones reales
- [ ] KTX2/BasisU para texturas comprimidas GPU-side
