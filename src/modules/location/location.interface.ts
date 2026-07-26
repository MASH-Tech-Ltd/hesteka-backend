export interface AutocompletePrediction {
  description: string;
  place_id: string;
  structured_formatting?: {
    main_text: string;
    secondary_text: string;
  } | undefined;
  types?: string[] | undefined;
}

export interface PlaceGeometry {
  location: {
    lat: number;
    lng: number;
  };
  viewport?: {
    northeast: { lat: number; lng: number };
    southwest: { lat: number; lng: number };
  } | undefined;
}

export interface AddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

export interface PlaceDetails {
  place_id: string;
  name?: string | undefined;
  formatted_address?: string | undefined;
  geometry?: PlaceGeometry | undefined;
  address_components?: AddressComponent[] | undefined;
  types?: string[] | undefined;
}

export interface GeocodeResult {
  place_id?: string | undefined;
  formatted_address: string;
  geometry: PlaceGeometry;
  address_components?: AddressComponent[] | undefined;
  types?: string[] | undefined;
}

export interface AutocompleteQuery {
  input: string;
  sessionToken?: string | undefined;
  language?: string | undefined;
  types?: string | undefined;
  components?: string | undefined; // e.g., "country:fr"
  lat?: number | undefined;
  lng?: number | undefined;
  radius?: number | undefined;
}

export interface PlaceDetailsQuery {
  placeId: string;
  sessionToken?: string | undefined;
  language?: string | undefined;
}

export interface GeocodeQuery {
  address?: string | undefined;
  lat?: number | undefined;
  lng?: number | undefined;
  language?: string | undefined;
}

export interface ILocationCache {
  key: string;
  data: any;
  expiresAt: Date;
}
