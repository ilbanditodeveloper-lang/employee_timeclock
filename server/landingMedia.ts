import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { landingMedia } from "../drizzle/schema";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

/** Max decoded payload ~1.2 MB (base64 is larger). */
export const LANDING_MEDIA_MAX_BYTES = 1_200_000;

export function isAllowedLandingImageType(contentType: string): boolean {
  return ALLOWED_TYPES.has(contentType.toLowerCase());
}

export async function insertLandingMedia(input: {
  purpose?: string;
  contentType: string;
  dataBase64: string;
}): Promise<{ id: number; urlPath: string }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const contentType = input.contentType.toLowerCase();
  if (!isAllowedLandingImageType(contentType)) {
    throw new Error("Tipo de imagen no permitido. Usa JPG, PNG o WebP.");
  }

  const raw = input.dataBase64.replace(/^data:[^;]+;base64,/, "").trim();
  if (!raw) throw new Error("Imagen vacía");

  const approxBytes = Math.floor((raw.length * 3) / 4);
  if (approxBytes > LANDING_MEDIA_MAX_BYTES) {
    throw new Error("La imagen es demasiado grande (máx. ~1 MB). Prueba con otra más ligera.");
  }

  const [row] = await db
    .insert(landingMedia)
    .values({
      purpose: input.purpose?.trim() || "audience",
      contentType,
      dataBase64: raw,
    })
    .returning({ id: landingMedia.id });

  return { id: row.id, urlPath: `/api/landing-media/${row.id}` };
}

export async function getLandingMediaById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(landingMedia).where(eq(landingMedia.id, id)).limit(1);
  return rows[0];
}
