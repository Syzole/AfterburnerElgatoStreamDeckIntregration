import { MahmReader } from "../mahm/reader.js";
import type { MahmSensor, MahmSnapshot } from "../mahm/types.js";
import { DEFAULT_POLL_INTERVAL_MS, normalizePollIntervalMs } from "../settings.js";

export type MahmUpdateListener = (snapshot: MahmSnapshot) => void;

export class MahmPollerService {
	private static instance: MahmPollerService | null = null;

	private readonly reader = new MahmReader();
	private readonly listeners = new Set<MahmUpdateListener>();
	private pollTimer: NodeJS.Timeout | null = null;
	private refCount = 0;
	private pollIntervalMs = DEFAULT_POLL_INTERVAL_MS;
	private latestSnapshot: MahmSnapshot = { connected: false, sensors: [], timestamp: Date.now() };

	static getInstance(): MahmPollerService {
		if (!MahmPollerService.instance) {
			MahmPollerService.instance = new MahmPollerService();
		}

		return MahmPollerService.instance;
	}

	getSnapshot(): MahmSnapshot {
		return this.latestSnapshot;
	}

	getSensors(): MahmSensor[] {
		return this.latestSnapshot.sensors;
	}

	getPollIntervalMs(): number {
		return this.pollIntervalMs;
	}

	setPollIntervalMs(value: unknown): void {
		const next = normalizePollIntervalMs(value);
		if (next === this.pollIntervalMs) {
			return;
		}

		this.pollIntervalMs = next;
		if (this.pollTimer) {
			this.stopPolling();
			this.startPolling();
		}
	}

	/** Read shared memory and update the cached snapshot without notifying listeners. */
	readQuiet(): MahmSnapshot {
		this.latestSnapshot = this.reader.read();
		return this.latestSnapshot;
	}

	refresh(): MahmSnapshot {
		this.latestSnapshot = this.reader.read();
		this.notifyListeners();
		return this.latestSnapshot;
	}

	subscribe(listener: MahmUpdateListener): void {
		this.refCount++;
		this.listeners.add(listener);
		if (this.refCount === 1) {
			this.startPolling();
		}

		listener(this.latestSnapshot);
	}

	unsubscribe(listener: MahmUpdateListener): void {
		this.refCount = Math.max(0, this.refCount - 1);
		if (this.refCount > 0) {
			return;
		}

		this.listeners.delete(listener);
		this.stopPolling();
		this.reader.disconnect();
	}

	private startPolling(): void {
		if (this.pollTimer) {
			return;
		}

		this.poll();
		this.pollTimer = setInterval(() => this.poll(), this.pollIntervalMs);
	}

	private stopPolling(): void {
		if (this.pollTimer) {
			clearInterval(this.pollTimer);
			this.pollTimer = null;
		}
	}

	private poll(): void {
		this.latestSnapshot = this.reader.read();
		this.notifyListeners();
	}

	private notifyListeners(): void {
		for (const listener of this.listeners) {
			listener(this.latestSnapshot);
		}
	}
}

export const mahmPoller = MahmPollerService.getInstance();
