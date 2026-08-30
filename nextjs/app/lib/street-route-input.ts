import { invalidInputResponse } from "@/app/lib/api-responses";

const MAX_STREET_NAME_LENGTH = 200;
// Bound the area of spatial queries while remaining well above the UI's
// current 500-foot maximum.
const MAX_BUFFER_IN_FEET = 5280;

type ValidationResult<T> =
  | { value: T; error?: never }
  | { value?: never; error: Response };

export type CrossStreetPair = readonly [string, string];
export type BoundingBox = readonly [number, number, number, number];
export type RadiusSearch = {
  latitude: number;
  longitude: number;
  radiusInFeet: number;
};

const invalidStreetNameResponse = (parameterName: string) =>
  invalidInputResponse(
    `${parameterName} must be a non-empty street name no longer than ${MAX_STREET_NAME_LENGTH} characters`,
  );

const containsControlCharacter = (value: string) =>
  Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint < 32 || codePoint === 127;
  });

export function validateStreetName(
  rawValue: string | null,
  parameterName: string,
  required: true,
): ValidationResult<string>;
export function validateStreetName(
  rawValue: string | null,
  parameterName: string,
  required?: false,
): ValidationResult<string | null>;
export function validateStreetName(
  rawValue: string | null,
  parameterName: string,
  required = false,
): ValidationResult<string | null> {
  if (rawValue === null) {
    return required
      ? { error: invalidInputResponse(`${parameterName} is required`) }
      : { value: null };
  }

  const value = rawValue.trim();
  if (
    value.length === 0 ||
    value.length > MAX_STREET_NAME_LENGTH ||
    containsControlCharacter(value)
  ) {
    return { error: invalidStreetNameResponse(parameterName) };
  }

  return { value };
}

export const validateCrossStreetPair = (
  rawCrossStreet1: string | null,
  rawCrossStreet2: string | null,
): ValidationResult<CrossStreetPair | null> => {
  if ((rawCrossStreet1 === null) !== (rawCrossStreet2 === null)) {
    return {
      error: invalidInputResponse(
        "crossStreet1 and crossStreet2 must be provided together",
      ),
    };
  }

  if (rawCrossStreet1 === null || rawCrossStreet2 === null) {
    return { value: null };
  }

  const crossStreet1 = validateStreetName(
    rawCrossStreet1,
    "crossStreet1",
    true,
  );
  if (crossStreet1.error) {
    return crossStreet1;
  }

  const crossStreet2 = validateStreetName(
    rawCrossStreet2,
    "crossStreet2",
    true,
  );
  if (crossStreet2.error) {
    return crossStreet2;
  }

  return { value: [crossStreet1.value, crossStreet2.value] };
};

export const validateBufferInFeet = (
  rawValue: unknown,
): ValidationResult<number> => {
  if (rawValue === null || rawValue === undefined) {
    return { error: invalidInputResponse("bufferInFeet is required") };
  }

  const normalizedValue =
    typeof rawValue === "string" ? rawValue.trim() : rawValue;
  const value =
    typeof normalizedValue === "number"
      ? normalizedValue
      : typeof normalizedValue === "string" && normalizedValue.length > 0
        ? Number(normalizedValue)
        : Number.NaN;
  if (!Number.isFinite(value) || value < 0 || value > MAX_BUFFER_IN_FEET) {
    return {
      error: invalidInputResponse(
        `bufferInFeet must be a number between 0 and ${MAX_BUFFER_IN_FEET}`,
      ),
    };
  }

  return { value };
};

const validateDate = (
  rawValue: unknown,
  parameterName: string,
): ValidationResult<string | null> => {
  if (rawValue === null || rawValue === undefined) {
    return { value: null };
  }

  if (typeof rawValue !== "string") {
    return {
      error: invalidInputResponse(
        `${parameterName} must be a valid date in YYYY-MM-DD format`,
      ),
    };
  }

  const value = rawValue.trim();
  const parsedDate = new Date(`${value}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(parsedDate.valueOf()) ||
    parsedDate.toISOString().slice(0, 10) !== value
  ) {
    return {
      error: invalidInputResponse(
        `${parameterName} must be a valid date in YYYY-MM-DD format`,
      ),
    };
  }

  return { value };
};

export const validateDateRange = (
  rawStartDate: unknown,
  rawEndDate: unknown,
): ValidationResult<{ startDate: string | null; endDate: string | null }> => {
  const startDate = validateDate(rawStartDate, "startDate");
  if (startDate.error) {
    return startDate;
  }

  const endDate = validateDate(rawEndDate, "endDate");
  if (endDate.error) {
    return endDate;
  }

  if (
    startDate.value !== null &&
    endDate.value !== null &&
    startDate.value > endDate.value
  ) {
    return {
      error: invalidInputResponse("startDate must be on or before endDate"),
    };
  }

  return { value: { startDate: startDate.value, endDate: endDate.value } };
};

export const validateBoundingBox = (
  rawValue: string | null,
): ValidationResult<BoundingBox | null> => {
  if (rawValue === null) {
    return { value: null };
  }

  const parts = rawValue.split(",");
  if (parts.length !== 4 || parts.some((part) => part.trim().length === 0)) {
    return {
      error: invalidInputResponse(
        "bbox must contain minLongitude,minLatitude,maxLongitude,maxLatitude",
      ),
    };
  }

  const [minLongitude, minLatitude, maxLongitude, maxLatitude] = parts.map(
    (part) => Number(part.trim()),
  );

  if (
    ![minLongitude, minLatitude, maxLongitude, maxLatitude].every(
      Number.isFinite,
    ) ||
    minLongitude < -180 ||
    maxLongitude > 180 ||
    minLatitude < -90 ||
    maxLatitude > 90 ||
    minLongitude >= maxLongitude ||
    minLatitude >= maxLatitude
  ) {
    return {
      error: invalidInputResponse(
        "bbox must contain valid longitude/latitude bounds in ascending order",
      ),
    };
  }

  return { value: [minLongitude, minLatitude, maxLongitude, maxLatitude] };
};

export const validateRadiusSearch = (
  rawLatitude: string | null,
  rawLongitude: string | null,
  rawRadiusInFeet: string | null,
): ValidationResult<RadiusSearch | null> => {
  const suppliedValues = [rawLatitude, rawLongitude, rawRadiusInFeet].filter(
    (value) => value !== null,
  );
  if (suppliedValues.length === 0) {
    return { value: null };
  }

  if (suppliedValues.length !== 3) {
    return {
      error: invalidInputResponse(
        "lat, lng, and radiusInFeet must be provided together",
      ),
    };
  }

  const latitude = Number(rawLatitude?.trim());
  const longitude = Number(rawLongitude?.trim());
  const radiusInFeet = Number(rawRadiusInFeet?.trim());

  if (
    rawLatitude?.trim().length === 0 ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90
  ) {
    return {
      error: invalidInputResponse("lat must be a number between -90 and 90"),
    };
  }

  if (
    rawLongitude?.trim().length === 0 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    return {
      error: invalidInputResponse("lng must be a number between -180 and 180"),
    };
  }

  if (
    rawRadiusInFeet?.trim().length === 0 ||
    !Number.isFinite(radiusInFeet) ||
    radiusInFeet < 0 ||
    radiusInFeet > MAX_BUFFER_IN_FEET
  ) {
    return {
      error: invalidInputResponse(
        `radiusInFeet must be a number between 0 and ${MAX_BUFFER_IN_FEET}`,
      ),
    };
  }

  return { value: { latitude, longitude, radiusInFeet } };
};
