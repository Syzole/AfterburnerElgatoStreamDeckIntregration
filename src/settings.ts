export type GlobalSettings = {
	pollIntervalMs?: number | string;
};

export const DEFAULT_POLL_INTERVAL_MS = 1000;

export const POLL_INTERVAL_OPTIONS_MS = [250, 500, 1000, 2000, 5000] as const;

export function normalizePollIntervalMs(value: unknown): number {
	const parsed = typeof value === "number" ? value : Number(value);
	if ((POLL_INTERVAL_OPTIONS_MS as readonly number[]).includes(parsed)) {
		return parsed;
	}

	return DEFAULT_POLL_INTERVAL_MS;
}
