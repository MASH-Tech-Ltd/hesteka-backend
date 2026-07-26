import axios from "axios";
import config from "../../config";
import CustomError from "../../helpers/CustomError";
import { locationCacheModel } from "./location.models";
import {
  AutocompletePrediction,
  PlaceDetails,
  GeocodeResult,
  AddressComponent,
  AutocompleteQuery,
  PlaceDetailsQuery,
  GeocodeQuery,
} from "./location.interface";

class LocationService {
  // In-memory map to store 6-second idle timers for auto-fetching place details
  private idleTimers = new Map<string, NodeJS.Timeout>();

  /**
   * Read from MongoDB cache. Returns null if missing or expired.
   */
  private async getFromCache<T>(key: string): Promise<T | null> {
    try {
      const cached = await locationCacheModel.findOne({ key }).lean();
      if (!cached) return null;
      if (new Date() > new Date(cached.expiresAt)) {
        await locationCacheModel.deleteOne({ key }).catch(() => {});
        return null;
      }
      return cached.data as T;
    } catch (e) {
      console.error("[LocationService] Database cache read error:", e);
      return null;
    }
  }

  /**
   * Save to MongoDB cache with TTL timestamp.
   * MongoDB automatically deletes documents when Date.now() > expiresAt due to TTL index.
   */
  private async setToCache<T>(key: string, data: T, ttlSeconds: number): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
      await locationCacheModel.findOneAndUpdate(
        { key },
        { $set: { data, expiresAt } },
        { upsert: true, new: true }
      );
    } catch (e) {
      console.error("[LocationService] Database cache write error:", e);
    }
  }

  private isOsmProvider(): boolean {
    const provider = config.locationProvider || "osm";
    return provider.toLowerCase() === "osm" || provider.toLowerCase() === "nominatim";
  }

  private getApiKey(): string {
    const key = config.googleMapsApiKey;
    if (!key || key.trim() === "") {
      throw new CustomError(
        500,
        "Google Maps API key is not configured on the server. Please set GOOGLE_MAPS_API_KEY in .env or use LOCATION_PROVIDER=osm"
      );
    }
    return key;
  }

  private getOsmHeaders(): Record<string, string> {
    return {
      "User-Agent": "Hesteka-Backend-Location-Service/1.0 (contact@hesteka.com)",
    };
  }

  private buildOsmAddressComponents(addr: Record<string, any> = {}): AddressComponent[] {
    const components: AddressComponent[] = [];
    if (addr.road || addr.pedestrian || addr.street || addr.house_number) {
      const street = [addr.house_number, addr.road || addr.pedestrian || addr.street].filter(Boolean).join(" ");
      components.push({ long_name: street, short_name: street, types: ["route", "street_address"] });
    }
    if (addr.city || addr.town || addr.village || addr.municipality || addr.suburb || addr.county || addr.locality) {
      const cityName = addr.city || addr.town || addr.village || addr.municipality || addr.suburb || addr.county || addr.locality;
      components.push({ long_name: cityName, short_name: cityName, types: ["locality", "city", "town", "political"] });
    }
    if (addr.postcode || addr.postal_code) {
      components.push({ long_name: addr.postcode || addr.postal_code, short_name: addr.postcode || addr.postal_code, types: ["postal_code", "postcode"] });
    }
    if (addr.state || addr.region) {
      components.push({ long_name: addr.state || addr.region, short_name: addr.state || addr.region, types: ["administrative_area_level_1", "state"] });
    }
    if (addr.country) {
      components.push({ long_name: addr.country, short_name: addr.country_code?.toUpperCase() || addr.country, types: ["country", "political"] });
    }
    return components;
  }

  /**
   * Autocomplete search supporting OpenStreetMap (Nominatim) and Google Places.
   * Pre-caches Place Details for OSM results to make subsequent details queries instant and free.
   * TTL: 15 minutes (900 seconds)
   */
  async autocomplete(query: AutocompleteQuery): Promise<AutocompletePrediction[]> {
    if (!query.input || query.input.trim() === "") {
      return [];
    }

    const inputClean = query.input.trim();
    const lang = query.language || "fr";
    const providerPrefix = this.isOsmProvider() ? "osm" : "gcp";

    // Normalize cache key without sessionToken so identical searches share cache across users
    const cacheKey = `ac:${providerPrefix}:${JSON.stringify({
      i: inputClean.toLowerCase(),
      l: lang,
      t: query.types || "",
      c: query.components || "",
      loc:
        query.lat !== undefined && query.lng !== undefined
          ? `${Number(query.lat).toFixed(2)},${Number(query.lng).toFixed(2)}`
          : "",
    })}`;

    let predictions = await this.getFromCache<AutocompletePrediction[]>(cacheKey);
    if (!predictions) {
      if (this.isOsmProvider()) {
        // OPENSTREETMAP NOMINATIM + KOMOOT PHOTON (100% FREE ELASTICSEARCH ENHANCEMENT FOR FUZZY/LANDMARK SEARCH)
        try {
          const nomParams: Record<string, any> = {
            q: inputClean,
            format: "json",
            addressdetails: 1,
            limit: 5,
            "accept-language": lang,
          };

          const [nomRes, photonRes] = await Promise.allSettled([
            axios.get<any>("https://nominatim.openstreetmap.org/search", {
              params: nomParams,
              headers: this.getOsmHeaders(),
            }),
            axios.get<any>("https://photon.komoot.io/api/", {
              params: {
                q: inputClean,
                limit: 8,
                lang: lang === "fr" || lang === "en" || lang === "de" ? lang : "en",
              },
            }),
          ]);

          let nomPredictions: AutocompletePrediction[] = [];
          if (nomRes.status === "fulfilled" && nomRes.value?.data) {
            nomPredictions = (nomRes.value.data || []).map((item: any) => {
              const placeIdStr = String(item.place_id || `osm_${item.osm_type}_${item.osm_id}`);
              const mainText =
                item.name ||
                item.address?.road ||
                item.address?.city ||
                item.display_name?.split(",")[0] ||
                "";
              const secondaryText = item.display_name?.split(",").slice(1).join(",").trim() || "";

              const detailsCacheKey = `pd:osm:${placeIdStr}:${lang}`;
              const placeDetails: PlaceDetails = {
                place_id: placeIdStr,
                name: mainText,
                formatted_address: item.display_name,
                geometry: {
                  location: {
                    lat: parseFloat(item.lat || "0"),
                    lng: parseFloat(item.lon || "0"),
                  },
                },
                address_components: this.buildOsmAddressComponents(item.address || {}),
                types: [item.type || item.class || "geocode"],
              };
              this.setToCache(detailsCacheKey, placeDetails, 604800).catch(() => {});

              return {
                description: item.display_name,
                place_id: placeIdStr,
                structured_formatting: {
                  main_text: mainText,
                  secondary_text: secondaryText,
                },
                types: [item.type || item.class || "geocode"],
              };
            });
          }

          let photonPredictions: AutocompletePrediction[] = [];
          if (photonRes.status === "fulfilled" && photonRes.value?.data?.features) {
            const features: any[] = photonRes.value.data.features;
            photonPredictions = features.map((feat: any) => {
              const props = feat.properties || {};
              const coords = feat.geometry?.coordinates || [0, 0];
              const placeIdStr =
                props.osm_id && props.osm_type
                  ? `osm_${String(props.osm_type).toLowerCase()}_${props.osm_id}`
                  : `photon_${Math.random().toString(36).substring(2, 9)}`;

              const mainText = props.name || props.street || props.city || "Location";
              const parts = [
                props.street,
                props.housenumber ? `n° ${props.housenumber}` : "",
                props.city || props.town || props.village,
                props.state,
                props.country,
              ].filter(Boolean);
              const secondaryText = parts.join(", ");
              const displayName = [mainText, secondaryText].filter(Boolean).join(", ");

              const detailsCacheKey = `pd:osm:${placeIdStr}:${lang}`;
              const placeDetails: PlaceDetails = {
                place_id: placeIdStr,
                name: mainText,
                formatted_address: displayName,
                geometry: {
                  location: {
                    lat: parseFloat(String(coords[1] || "0")),
                    lng: parseFloat(String(coords[0] || "0")),
                  },
                },
                address_components: [
                  props.street ? { long_name: props.street, short_name: props.street, types: ["route"] } : null,
                  props.city || props.town ? { long_name: props.city || props.town, short_name: props.city || props.town, types: ["locality"] } : null,
                  props.state ? { long_name: props.state, short_name: props.state, types: ["administrative_area_level_1"] } : null,
                  props.country ? { long_name: props.country, short_name: props.country, types: ["country"] } : null,
                  props.postcode ? { long_name: props.postcode, short_name: props.postcode, types: ["postal_code"] } : null,
                ].filter(Boolean) as any,
                types: [props.osm_value || props.osm_key || "geocode"],
              };
              this.setToCache(detailsCacheKey, placeDetails, 604800).catch(() => {});

              return {
                description: displayName,
                place_id: placeIdStr,
                structured_formatting: {
                  main_text: mainText,
                  secondary_text: secondaryText || "France",
                },
                types: [props.osm_value || props.osm_key || "geocode"],
              };
            });
          }

          const seenIds = new Set<string>();
          const seenDesc = new Set<string>();
          const combined: AutocompletePrediction[] = [];

          for (const item of [...nomPredictions, ...photonPredictions]) {
            const descLower = item.description.toLowerCase();
            if (!seenIds.has(item.place_id) && !seenDesc.has(descLower)) {
              seenIds.add(item.place_id);
              seenDesc.add(descLower);
              combined.push(item);
            }
          }

          predictions = combined.slice(0, 10);
          await this.setToCache(cacheKey, predictions, 900);
        } catch (error: any) {
          console.error("[LocationService] OpenStreetMap / Photon Autocomplete Request Failed:", error?.message || error);
          throw new CustomError(500, "Failed to fetch location suggestions");
        }
      } else {
        // GOOGLE PLACES API (PAID)
        const apiKey = this.getApiKey();
        const params: Record<string, any> = {
          input: inputClean,
          key: apiKey,
          language: lang,
        };

        if (query.sessionToken) params.sessiontoken = query.sessionToken;
        if (query.types) params.types = query.types;
        if (query.components) params.components = query.components;
        if (query.lat !== undefined && query.lng !== undefined) {
          params.location = `${query.lat},${query.lng}`;
        }
        if (query.radius !== undefined) {
          params.radius = query.radius;
        }

        try {
          const response = await axios.get<any>("https://maps.googleapis.com/maps/api/place/autocomplete/json", {
            params,
          });
          const data: any = response.data;

          if (data.status === "OK" || data.status === "ZERO_RESULTS") {
            predictions = (data.predictions || []).map((p: any) => ({
              description: p.description,
              place_id: p.place_id,
              structured_formatting: p.structured_formatting,
              types: p.types,
            }));
            await this.setToCache(cacheKey, predictions, 900);
          } else if (data.status === "REQUEST_DENIED" || data.status === "OVER_QUERY_LIMIT") {
            console.error("[LocationService] Google Places Autocomplete API Error:", data.error_message || data.status);
            throw new CustomError(502, `Google Places API Error: ${data.status}`);
          } else {
            predictions = [];
          }
        } catch (error: any) {
          if (error instanceof CustomError) throw error;
          console.error("[LocationService] Google Autocomplete Request Failed:", error?.message || error);
          throw new CustomError(500, "Failed to fetch autocomplete predictions");
        }
      }
    }

    // 6-SECOND IDLE TIMER: If no autocomplete call occurs in the last 6 seconds for this session/query,
    // automatically request Place Details for the top prediction to pre-warm cache and close session tokens.
    if (predictions && predictions.length > 0 && predictions[0]?.place_id) {
      const topPlaceId = predictions[0].place_id;
      const timerKey = query.sessionToken || `auto_${providerPrefix}_${inputClean.toLowerCase()}_${lang}`;

      const existingTimer = this.idleTimers.get(timerKey);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const newTimer = setTimeout(async () => {
        this.idleTimers.delete(timerKey);
        try {
          const detailsCacheKey = `pd:${providerPrefix}:${topPlaceId.trim()}:${lang}`;
          const isCached = await this.getFromCache(detailsCacheKey);
          if (!isCached) {
            console.log(`[LocationService] 6s idle timer triggered for ${timerKey}. Auto-fetching Place Details for top prediction: ${topPlaceId}`);
            await this.getPlaceDetails({
              placeId: topPlaceId,
              sessionToken: query.sessionToken,
              language: lang,
            }).catch((err) => {
              console.error(`[LocationService] Error in 6s auto-details fetch:`, err?.message || err);
            });
          }
        } catch (err: any) {
          console.error(`[LocationService] Timer execution error:`, err?.message || err);
        }
      }, 6000); // 6 seconds

      this.idleTimers.set(timerKey, newTimer);
    }

    return predictions || [];
  }

  /**
   * Get Place Details supporting both OpenStreetMap (Nominatim) and Google Places.
   * TTL: 7 days (604800 seconds)
   */
  async getPlaceDetails(query: PlaceDetailsQuery): Promise<PlaceDetails> {
    if (!query.placeId || query.placeId.trim() === "") {
      throw new CustomError(400, "placeId is required");
    }

    const lang = query.language || "fr";
    const providerPrefix = this.isOsmProvider() ? "osm" : "gcp";
    const cacheKey = `pd:${providerPrefix}:${query.placeId.trim()}:${lang}`;

    const cached = await this.getFromCache<PlaceDetails>(cacheKey);
    if (cached) {
      return cached;
    }

    if (this.isOsmProvider()) {
      // OPENSTREETMAP NOMINATIM DETAILS / LOOKUP
      try {
        let url = "https://nominatim.openstreetmap.org/details";
        let params: Record<string, any> = {
          format: "json",
          addressdetails: 1,
          "accept-language": lang,
        };

        const placeIdClean = query.placeId.trim();
        if (/^\d+$/.test(placeIdClean)) {
          params.place_id = placeIdClean;
        } else if (placeIdClean.startsWith("osm_")) {
          // Format osm_node_123 -> N123 for lookup endpoint
          url = "https://nominatim.openstreetmap.org/lookup";
          const parts = placeIdClean.split("_");
          const typeChar = parts[1]?.charAt(0).toUpperCase() || "N";
          params.osm_ids = `${typeChar}${parts[2]}`;
        } else {
          params.place_id = placeIdClean;
        }

        const response = await axios.get<any>(url, {
          params,
          headers: this.getOsmHeaders(),
        });
        const data: any = response.data;
        const item = Array.isArray(data) ? data[0] : data;

        if (item && (item.lat || item.centroid)) {
          const latVal = parseFloat(item.lat || item.centroid?.coordinates?.[1] || "0");
          const lngVal = parseFloat(item.lon || item.centroid?.coordinates?.[0] || "0");
          const nameVal =
            item.name || item.localname || item.address?.road || item.address?.city || item.display_name?.split(",")[0] || "";

          const result: PlaceDetails = {
            place_id: placeIdClean,
            name: nameVal,
            formatted_address: item.display_name || item.address?.road || "",
            geometry: {
              location: { lat: latVal, lng: lngVal },
            },
            address_components: this.buildOsmAddressComponents(item.address || {}),
            types: [item.type || item.class || "geocode"],
          };
          await this.setToCache(cacheKey, result, 604800);
          return result;
        }
        throw new CustomError(404, "OpenStreetMap place details not found");
      } catch (error: any) {
        if (error instanceof CustomError) throw error;
        console.error("[LocationService] OpenStreetMap Place Details Failed:", error?.message || error);
        throw new CustomError(500, "Failed to fetch OpenStreetMap place details");
      }
    } else {
      // GOOGLE PLACES DETAILS
      const apiKey = this.getApiKey();
      const fields = "place_id,name,formatted_address,geometry,address_components,types";
      const params: Record<string, any> = {
        place_id: query.placeId.trim(),
        key: apiKey,
        language: lang,
        fields,
      };

      if (query.sessionToken) {
        params.sessiontoken = query.sessionToken;
      }

      try {
        const response = await axios.get<any>("https://maps.googleapis.com/maps/api/place/details/json", {
          params,
        });
        const data: any = response.data;

        if (data.status === "OK" && data.result) {
          const result: PlaceDetails = {
            place_id: data.result.place_id,
            name: data.result.name,
            formatted_address: data.result.formatted_address,
            geometry: data.result.geometry,
            address_components: data.result.address_components,
            types: data.result.types,
          };
          await this.setToCache(cacheKey, result, 604800);

          if (query.sessionToken && this.idleTimers.has(query.sessionToken)) {
            const timer = this.idleTimers.get(query.sessionToken);
            if (timer) clearTimeout(timer);
            this.idleTimers.delete(query.sessionToken);
          }

          return result;
        }

        if (data.status === "REQUEST_DENIED" || data.status === "OVER_QUERY_LIMIT") {
          console.error("[LocationService] Google Place Details API Error:", data.error_message || data.status);
          throw new CustomError(502, `Google Place Details API Error: ${data.status}`);
        }

        throw new CustomError(404, "Place details not found");
      } catch (error: any) {
        if (error instanceof CustomError) throw error;
        console.error("[LocationService] Google Place Details Failed:", error?.message || error);
        throw new CustomError(500, "Failed to fetch place details");
      }
    }
  }

  /**
   * Reverse Geocoding or Forward Geocoding supporting OpenStreetMap (Nominatim) and Google Geocoding.
   * TTL: 7 days (604800 seconds)
   */
  async geocode(query: GeocodeQuery): Promise<GeocodeResult[]> {
    const lang = query.language || "fr";
    const providerPrefix = this.isOsmProvider() ? "osm" : "gcp";
    let cacheKey = "";

    if (query.lat !== undefined && query.lng !== undefined) {
      const rLat = Number(query.lat).toFixed(4);
      const rLng = Number(query.lng).toFixed(4);
      cacheKey = `geo:${providerPrefix}:rev:${rLat},${rLng}:${lang}`;
    } else if (query.address && query.address.trim() !== "") {
      const cleanAddress = query.address.trim().toLowerCase();
      cacheKey = `geo:${providerPrefix}:fwd:${cleanAddress}:${lang}`;
    } else {
      throw new CustomError(400, "Either address or lat/lng coordinates must be provided for geocoding");
    }

    const cached = await this.getFromCache<GeocodeResult[]>(cacheKey);
    if (cached) {
      return cached;
    }

    if (this.isOsmProvider()) {
      // OPENSTREETMAP NOMINATIM GEOCODING
      try {
        if (query.lat !== undefined && query.lng !== undefined) {
          const response = await axios.get<any>("https://nominatim.openstreetmap.org/reverse", {
            params: {
              lat: query.lat,
              lon: query.lng,
              format: "json",
              addressdetails: 1,
              "accept-language": lang,
            },
            headers: this.getOsmHeaders(),
          });
          const data: any = response.data;

          if (data && data.display_name) {
            const results: GeocodeResult[] = [
              {
                place_id: String(data.place_id || ""),
                formatted_address: data.display_name,
                geometry: {
                  location: {
                    lat: parseFloat(data.lat || String(query.lat)),
                    lng: parseFloat(data.lon || String(query.lng)),
                  },
                },
                address_components: this.buildOsmAddressComponents(data.address || {}),
                types: [data.type || data.class || "geocode"],
              },
            ];
            await this.setToCache(cacheKey, results, 604800);
            return results;
          }
          return [];
        } else {
          const response = await axios.get<any>("https://nominatim.openstreetmap.org/search", {
            params: {
              q: query.address?.trim(),
              format: "json",
              addressdetails: 1,
              limit: 5,
              "accept-language": lang,
            },
            headers: this.getOsmHeaders(),
          });
          const data: any = response.data;

          const results: GeocodeResult[] = (data || []).map((item: any) => ({
            place_id: String(item.place_id || ""),
            formatted_address: item.display_name,
            geometry: {
              location: {
                lat: parseFloat(item.lat || "0"),
                lng: parseFloat(item.lon || "0"),
              },
            },
            address_components: this.buildOsmAddressComponents(item.address || {}),
            types: [item.type || item.class || "geocode"],
          }));
          await this.setToCache(cacheKey, results, 604800);
          return results;
        }
      } catch (error: any) {
        console.error("[LocationService] OpenStreetMap Geocoding Failed:", error?.message || error);
        throw new CustomError(500, "Failed to fetch OpenStreetMap geocoding results");
      }
    } else {
      // GOOGLE GEOCODING API
      const apiKey = this.getApiKey();
      const params: Record<string, any> = {
        key: apiKey,
        language: lang,
      };

      if (query.lat !== undefined && query.lng !== undefined) {
        params.latlng = `${query.lat},${query.lng}`;
      } else {
        params.address = query.address?.trim();
      }

      try {
        const response = await axios.get<any>("https://maps.googleapis.com/maps/api/geocode/json", {
          params,
        });
        const data: any = response.data;

        if (data.status === "OK" || data.status === "ZERO_RESULTS") {
          const results: GeocodeResult[] = (data.results || []).map((r: any) => ({
            place_id: r.place_id,
            formatted_address: r.formatted_address,
            geometry: r.geometry,
            address_components: r.address_components,
            types: r.types,
          }));
          await this.setToCache(cacheKey, results, 604800);
          return results;
        }

        if (data.status === "REQUEST_DENIED" || data.status === "OVER_QUERY_LIMIT") {
          console.error("[LocationService] Google Geocoding API Error:", data.error_message || data.status);
          throw new CustomError(502, `Google Geocoding API Error: ${data.status}`);
        }

        return [];
      } catch (error: any) {
        if (error instanceof CustomError) throw error;
        console.error("[LocationService] Geocode Request Failed:", error?.message || error);
        throw new CustomError(500, "Failed to fetch geocoding results");
      }
    }
  }

  /**
   * Admin dashboard: Get all saved locations from MongoDB cache with pagination and search
   */
  async getSavedLocations(page = 1, limit = 50, search = "", type = "all") {
    const query: any = {};
    const conditions: any[] = [];

    if (search) {
      conditions.push(
        { key: { $regex: search, $options: "i" } },
        { "data.description": { $regex: search, $options: "i" } },
        { "data.formatted_address": { $regex: search, $options: "i" } },
        { "data.name": { $regex: search, $options: "i" } }
      );
    }

    if (type && type !== "all") {
      if (type === "details") {
        query.key = { $regex: "^pd:", $options: "i" };
      } else if (type === "autocomplete") {
        query.key = { $regex: "^(ac:|auto_)", $options: "i" };
      } else if (type === "geocode") {
        query.key = { $regex: "^(gc:|rev_)", $options: "i" };
      }
    }

    if (conditions.length > 0) {
      query["$or"] = conditions;
    }

    const total = await locationCacheModel.countDocuments(query);
    const locations = await locationCacheModel
      .find(query)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Also get summary counts for stat cards
    const totalDetails = await locationCacheModel.countDocuments({ key: { $regex: "^pd:", $options: "i" } });
    const totalAutocomplete = await locationCacheModel.countDocuments({ key: { $regex: "^(ac:|auto_)", $options: "i" } });
    const totalGeocode = await locationCacheModel.countDocuments({ key: { $regex: "^(gc:|rev_)", $options: "i" } });
    const totalAll = await locationCacheModel.countDocuments({});

    return {
      locations,
      stats: {
        all: totalAll,
        details: totalDetails,
        autocomplete: totalAutocomplete,
        geocode: totalGeocode,
      },
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async deleteSavedLocation(id: string) {
    return await locationCacheModel.findByIdAndDelete(id);
  }

  async clearAllSavedLocations() {
    return await locationCacheModel.deleteMany({});
  }
}

export const locationService = new LocationService();
