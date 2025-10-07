import { parseGpxToOverlayValues } from './gpx';
import type { StatValues } from './overlay';

export async function parseActivityFile(xmlString: string): Promise<StatValues> {
	return parseGpxToOverlayValues(xmlString);
}
