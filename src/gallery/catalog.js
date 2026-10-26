export const galleryConfig = {
  name: 'Galeria Miau',
  room: {
    units: 'meters',
    width: 8.6,
    depth: 34,
    height: 7.1,
    springHeight: 4.65,
    eyeHeight: 1.62,
    artworkCenterY: 2.15,
    baseboardHeight: 0.22,
    start: { x: 0, y: 1.62, z: 14.2, yaw: 0 }
  },
  donation: {
    title: 'Una demo abierta a colaboración',
    copy:
      'Esta sala es una demostración técnica: no recibe donaciones ni procesa pagos. Puedes explorar el código, reportar un error o proponer mejoras en GitHub.',
    checkoutUrl: 'https://github.com/Gonic0/galeria-miau',
    tiers: []
  },
  sponsorRotationSeconds: 12
};

export const sponsors = [
  {
    label: 'Galería Miau · Demo interactiva',
    cta: 'Código en GitHub',
    url: 'https://github.com/Gonic0/galeria-miau'
  }
];

export const temporaryPhotos = [
  {
    id: 'black-renaissance-cat',
    title: 'El ministro de medianoche',
    artist: 'Motor de imagenes Codex',
    year: '2026',
    image: '/artworks/black-renaissance-cat.webp',
    frame: '#4c2d1f',
    accent: '#c69b58',
    story:
      'Un retrato solemne que abre la muestra con humor fino: nobleza felina, mirada verde y toda la gravedad de una corte imaginaria.',
    prompt:
      'Gato negro con ojos esmeralda como sujeto renacentista, oleo detallado, luz calida de museo.'
  },
  {
    id: 'orange-garden-cat',
    title: 'Siesta botanica',
    artist: 'Motor de imagenes Codex',
    year: '2026',
    image: '/artworks/orange-garden-cat.webp',
    frame: '#25433a',
    accent: '#d9823b',
    story:
      'Una pieza luminosa para equilibrar la sala: hojas grandes, flores suaves y un gato naranjo que parece haber elegido su propio invernadero.',
    prompt:
      'Gato tabby naranjo entre hojas y flores, oleo impresionista, color aireado, textura visible.'
  },
  {
    id: 'moonlit-silver-cat',
    title: 'Azotea lunar',
    artist: 'Motor de imagenes Codex',
    year: '2026',
    image: '/artworks/moonlit-silver-cat.webp',
    frame: '#273744',
    accent: '#bcc8cb',
    story:
      'El tramo nocturno propone pausa y contemplacion, con curvas elegantes y reflejos plateados sobre una ciudad lejana.',
    prompt:
      'Gato gris plateado en azotea iluminada por luna, inspiracion art nouveau, azules profundos.'
  },
  {
    id: 'calico-stretch-cat',
    title: 'Estiramiento de martes',
    artist: 'Motor de imagenes Codex',
    year: '2026',
    image: '/artworks/calico-stretch-cat.webp',
    frame: '#203f48',
    accent: '#f16f3b',
    story:
      'La obra mas juguetona usa campos geometricos y una pose cercana para recordar que una exposicion tambien puede sonreir.',
    prompt:
      'Gato calico estirandose, pintura acrilica contemporanea, campos geometricos suaves.'
  }
];

export const artworkSlots = [
  { wall: 'left', offset: 11.8, width: 2.05, height: 2.45 },
  { wall: 'right', offset: 11.8, width: 2.05, height: 2.45 },
  { wall: 'left', offset: 7.2, width: 1.8, height: 2.2 },
  { wall: 'right', offset: 7.2, width: 1.8, height: 2.2 },
  { wall: 'left', offset: 2.6, width: 1.65, height: 2 },
  { wall: 'right', offset: 2.6, width: 1.65, height: 2 },
  { wall: 'left', offset: -2, width: 1.65, height: 2 },
  { wall: 'right', offset: -2, width: 1.65, height: 2 },
  { wall: 'left', offset: -6.6, width: 1.8, height: 2.2 },
  { wall: 'right', offset: -6.6, width: 1.8, height: 2.2 },
  { wall: 'left', offset: -11.2, width: 2.05, height: 2.45 },
  { wall: 'right', offset: -11.2, width: 2.05, height: 2.45 },
  { wall: 'back', offset: 0, width: 3.4, height: 4.1 },
  { wall: 'front', offset: -1.6, width: 1.55, height: 1.95 },
  { wall: 'front', offset: 1.6, width: 1.55, height: 1.95 }
];

export const artworks = artworkSlots.map((slot, index) => {
  const source = temporaryPhotos[index % temporaryPhotos.length];
  const copy = Math.floor(index / temporaryPhotos.length) + 1;
  return {
    ...source,
    ...slot,
    id: `${source.id}-${index + 1}`,
    title: copy > 1 ? `${source.title} ${copy}` : source.title
  };
});
