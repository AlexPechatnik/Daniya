/**
 * Яндекс.Геокодер — получение координат и района по тексту адреса.
 *
 * Чтобы включить:
 *   1. Зарегистрировать ключ на https://developer.tech.yandex.ru/
 *      (тип «JavaScript API и HTTP Геокодер», бесплатный лимит 25 000 запросов/сутки)
 *   2. Прописать YANDEX_GEOCODER_KEY в .env
 *   3. Без ключа адаптер тихо возвращает null — и работает regex-fallback из districts.ts.
 */

export interface GeocodeResult {
  lat: number;
  lng: number;
  /** Район в каноническом виде, напр. «Невский». null если Яндекс не смог определить */
  district: string | null;
  /** Полный адрес как его понял Яндекс */
  formatted: string;
}

export interface AddressSuggestion {
  value: string;
  title: string;
  subtitle: string;
  lat: number | null;
  lng: number | null;
  district: string | null;
}

import { shortenSpbAddress } from "./address";
export { shortenSpbAddress };

const GEOCODE_URL = "https://geocode-maps.yandex.ru/1.x/";
const REQUEST_TIMEOUT_MS = 4000;

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const key = process.env.YANDEX_GEOCODER_KEY;
  if (!key || !address?.trim()) return null;

  const query = address.toLowerCase().includes("санкт-петербург") || address.toLowerCase().includes("спб")
    ? address
    : `Санкт-Петербург, ${address}`;

  const params = new URLSearchParams({
    apikey: key,
    format: "json",
    geocode: query,
    results: "1",
    lang: "ru_RU",
  });

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const res = await fetch(`${GEOCODE_URL}?${params}`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) {
      console.warn("[geocoder] yandex returned", res.status);
      return null;
    }
    const data: any = await res.json();
    const feature = data?.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject;
    if (!feature) return null;

    const pos = feature.Point?.pos as string | undefined;
    if (!pos) return null;
    const [lng, lat] = pos.split(" ").map(Number);
    if (!isFinite(lat) || !isFinite(lng)) return null;

    const formatted = feature.metaDataProperty?.GeocoderMetaData?.text || feature.name || query;

    // Район из административных компонентов
    let district: string | null = null;
    const components: any[] = feature.metaDataProperty?.GeocoderMetaData?.Address?.Components || [];
    for (const c of components) {
      if (c.kind === "district") {
        district = String(c.name || "").replace(/\s+район$/i, "").trim() || null;
        if (district) break;
      }
    }

    return { lat, lng, district, formatted };
  } catch (e: any) {
    if (e?.name !== "AbortError") console.error("[geocoder]", e?.message || e);
    return null;
  }
}

export async function suggestYandexAddresses(text: string, limit = 8): Promise<AddressSuggestion[]> {
  const key = process.env.YANDEX_GEOCODER_KEY;
  const q = text?.trim();
  if (!key || !q || q.length < 3) return [];

  const query = q.toLowerCase().includes("санкт-петербург") || q.toLowerCase().includes("спб")
    ? q
    : `Санкт-Петербург, ${q}`;

  const params = new URLSearchParams({
    apikey: key,
    format: "json",
    geocode: query,
    results: String(limit),
    lang: "ru_RU",
  });

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const res = await fetch(`${GEOCODE_URL}?${params}`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) {
      console.warn("[geocoder:suggest] yandex returned", res.status);
      return [];
    }

    const data: any = await res.json();
    const members: any[] = data?.response?.GeoObjectCollection?.featureMember || [];
    const suggestions: AddressSuggestion[] = [];

    for (const member of members) {
      const geo = member?.GeoObject;
      if (!geo) continue;

      const formatted = geo.metaDataProperty?.GeocoderMetaData?.text || geo.name;
      if (!formatted) continue;

      const pos = geo.Point?.pos as string | undefined;
      const [lng, lat] = pos ? pos.split(" ").map(Number) : [NaN, NaN];
      const components: any[] = geo.metaDataProperty?.GeocoderMetaData?.Address?.Components || [];
      const districtComponent = components.find((c) => c.kind === "district");
      const locality = components.find((c) => c.kind === "locality")?.name;
      const street = components.find((c) => c.kind === "street")?.name;
      const house = components.find((c) => c.kind === "house")?.name;
      const district = districtComponent?.name
        ? String(districtComponent.name).replace(/\s+район$/i, "").trim()
        : null;

      // В value подставляем сокращённый адрес — клиенту в поле попадает
      // только то, что реально полезно: «Мурино, улица Шоссе в Лаврики, 59к1».
      const short = shortenSpbAddress(formatted);
      suggestions.push({
        value: short || formatted,
        title: [street, house].filter(Boolean).join(", ") || short || geo.name || formatted,
        subtitle: [locality, district ? `${district} район` : null].filter(Boolean).join(" · "),
        lat: isFinite(lat) ? lat : null,
        lng: isFinite(lng) ? lng : null,
        district,
      });
    }

    const seen = new Set<string>();
    return suggestions.filter((item) => {
      const key = item.value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } catch (e: any) {
    if (e?.name !== "AbortError") console.error("[geocoder:suggest]", e?.message || e);
    return [];
  }
}
