import { emptyCreds } from "@/lib/authApi";

const ACTIVE_LOCATION_KEY = "timeclock-active-location";

export function getStoredActiveLocationId(): number | undefined {
  if (typeof window === "undefined") return undefined;
  const raw = localStorage.getItem(ACTIVE_LOCATION_KEY);
  if (!raw) return undefined;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : undefined;
}

export function setStoredActiveLocationId(locationId: number | null) {
  if (typeof window === "undefined") return;
  if (locationId == null) {
    localStorage.removeItem(ACTIVE_LOCATION_KEY);
    return;
  }
  localStorage.setItem(ACTIVE_LOCATION_KEY, String(locationId));
}

export function adminApiInput(restaurantId?: number) {
  const stored = restaurantId ?? getStoredActiveLocationId();
  return {
    ...emptyCreds,
    ...(stored ? { restaurantId: stored } : {}),
  };
}
