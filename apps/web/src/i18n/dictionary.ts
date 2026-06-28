const es = {
  "nav.label": "Navegacion principal",
  "nav.photos": "Fotos",
  "nav.drive": "Drive",
  "nav.documents": "Documentos",
  "nav.jobs": "Trabajos",
  "nav.settings": "Ajustes",
  "search.label": "Busqueda global",
  "search.placeholder": "Buscar por nombre, metadata o texto indexado",
  "shell.title": "Bento local",
  "shell.status": "El shell esta listo para conectar las superficies del producto.",
  "photos.placeholderTitle": "Fotos",
  "photos.placeholderBody": "La linea de tiempo se implementara en una etapa posterior.",
  "drive.placeholderTitle": "Drive",
  "drive.placeholderBody": "El navegador de archivos se implementara en una etapa posterior.",
} as const;

export type MessageKey = keyof typeof es;

export function t(key: MessageKey): string {
  return es[key];
}