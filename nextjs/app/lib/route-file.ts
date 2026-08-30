import { gpx, kml } from "@tmcw/togeojson";
import { FeatureCollection, GeoJsonProperties, Geometry } from "geojson";

type RouteFile = Pick<File, "name" | "text">;
type RouteFileFormat = "gpx" | "kml";

const getRouteFileFormat = (fileName: string): RouteFileFormat => {
  const normalizedFileName = fileName.trim().toLowerCase();

  if (normalizedFileName.endsWith(".gpx")) {
    return "gpx";
  }

  if (normalizedFileName.endsWith(".kml")) {
    return "kml";
  }

  throw new Error("Unsupported route file: expected a .gpx or .kml file");
};

export const parseRouteText = (
  fileName: string,
  text: string,
): FeatureCollection<Geometry | null, GeoJsonProperties> => {
  const format = getRouteFileFormat(fileName);
  const document = new DOMParser().parseFromString(text, "text/xml");

  return format === "kml" ? kml(document) : gpx(document);
};

export const parseRouteFile = async (
  file: RouteFile,
): Promise<FeatureCollection<Geometry | null, GeoJsonProperties>> => {
  getRouteFileFormat(file.name);
  return parseRouteText(file.name, await file.text());
};
