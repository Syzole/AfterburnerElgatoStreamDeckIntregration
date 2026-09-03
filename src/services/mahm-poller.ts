import { MahmReader } from "../mahm/reader.js";
import type { MahmSensor, MahmSnapshot } from "../mahm/types.js";

const DEFAULT_POLL_INTERVAL_MS = 1000;

export type MahmUpdateListener = (snapshot: MahmSnapshot) => void;

export class MahmPollerService {
	private static instance: MahmPollerService | null = null;

	private readonly reader = new MahmReader();
	private readonly listeners = new Set<MahmUpdateListener>();
	private pollTimer: NodeJS.Timeout | null = null;
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

	refresh(): MahmSnapshot {
		this.latestSnapshot = this.reader.read();
		for (const listener of this.listeners) {
			listener(this.latestSnapshot);
		}

		return this.latestSnapshot;
	}

	subscribe(listener: MahmUpdateListener): void {
		this.listeners.add(listener);
		this.startPolling();
		listener(this.latestSnapshot);
	}

	unsubscribe(listener: MahmUpdateListener): void {
		this.listeners.delete(listener);
		if (this.listeners.size === 0) {
			this.stopPolling();
			this.reader.disconnect();
		}
	}

	private startPolling(): void {
		if (this.pollTimer) {
			return;
		}

		this.poll();
		this.pollTimer = setInterval(() => this.poll(), DEFAULT_POLL_INTERVAL_MS);
	}

	private stopPolling(): void {
		if (this.pollTimer) {
			clearInterval(this.pollTimer);
			this.pollTimer = null;
		}
	}

	private poll(): void {
		this.latestSnapshot = this.reader.read();
		for (const listener of this.listeners) {
			listener(this.latestSnapshot);
		}
	}
}

export const mahmPoller = MahmPollerService.getInstance();
