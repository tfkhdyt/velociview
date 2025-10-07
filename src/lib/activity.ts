import { parseGpxToOverlayValues } from './gpx';
import type { StatValues } from './overlay';
import { parseTcxToOverlayValues } from './tcx';

export async function parseActivityFile(
	xmlString: string,
	fileExtension: string
): Promise<StatValues> {
	const ext = fileExtension.toLowerCase().replace(/^\./, '');
	return ext === 'gpx' ? parseGpxToOverlayValues(xmlString) : parseTcxToOverlayValues(xmlString);
}
