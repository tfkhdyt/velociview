import type { RawStatValues } from './gpx';
import { parseGpxToRawStats } from './gpx';

export async function parseActivityFile(xmlString: string): Promise<RawStatValues> {
	return parseGpxToRawStats(xmlString);
}
