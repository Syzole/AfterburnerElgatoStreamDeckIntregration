import streamDeck, {
	action,
	DidReceiveSettingsEvent,
	SendToPluginEvent,
	SingletonAction,
	WillAppearEvent,
	WillDisappearEvent,
} from "@elgato/streamdeck";

import type { MahmSnapshot } from "../mahm/types.js";
import { mahmPoller } from "../services/mahm-poller.js";
import { accentForSensor, formatKeyNumber, shortSensorLabel } from "../display/format.js";
import { renderKeyImage, type KeyView } from "../display/key-image.js";

type DataSourcePayload = {
	event: string;
	items: Array<{ value: string; label: string; disabled?: boolean }>;
};

type SensorMonitorSettings = {
	sensorId?: number | string;
	sensorName?: string;
	customLabel?: string;
	showLabel?: boolean;
};

type SensorDatasourceRequest = {
	event?: string;
	isRefresh?: boolean;
};

@action({ UUID: "com.syzole.aftermonitor.sensor" })
export class SensorMonitor extends SingletonAction<SensorMonitorSettings> {
	private readonly visibleActions = new Map<string, WillAppearEvent<SensorMonitorSettings>["action"]>();
	private readonly lastImage = new Map<string, string>();
	private lastSensorSignature = "";
	private piOpen = false;

	private readonly updateListener = (snapshot: MahmSnapshot) => {
		void this.renderAllVisible(snapshot);
		if (this.piOpen) {
			void this.pushSensorDatasource(snapshot, false);
		}
	};

	override onWillAppear(ev: WillAppearEvent<SensorMonitorSettings>): void | Promise<void> {
		this.visibleActions.set(ev.action.id, ev.action);
		mahmPoller.subscribe(this.updateListener);
	}

	override onWillDisappear(ev: WillDisappearEvent<SensorMonitorSettings>): void | Promise<void> {
		this.visibleActions.delete(ev.action.id);
		this.lastImage.delete(ev.action.id);
		mahmPoller.unsubscribe(this.updateListener);
	}

	override onPropertyInspectorDidAppear(): void {
		this.piOpen = true;
		void this.pushSensorDatasource(mahmPoller.readQuiet(), true);
	}

	override onPropertyInspectorDidDisappear(): void {
		this.piOpen = false;
	}

	override onDidReceiveSettings(ev: DidReceiveSettingsEvent<SensorMonitorSettings>): void | Promise<void> {
		return this.renderAction(ev.action, ev.payload.settings, mahmPoller.getSnapshot());
	}

	override async onSendToPlugin(ev: SendToPluginEvent<SensorDatasourceRequest, SensorMonitorSettings>): Promise<void> {
		const payload = ev.payload;
		if (!payload || typeof payload !== "object" || payload.event !== "getSensors") {
			return;
		}

		this.piOpen = true;
		await this.pushSensorDatasource(mahmPoller.readQuiet(), true);
	}

	private sensorSignature(snapshot: MahmSnapshot): string {
		if (!snapshot.connected || snapshot.sensors.length === 0) {
			return "offline";
		}

		return snapshot.sensors.map((sensor) => `${sensor.id}\0${sensor.name}`).join("\n");
	}

	private buildSensorItems(snapshot: MahmSnapshot): DataSourcePayload["items"] {
		if (!snapshot.connected || snapshot.sensors.length === 0) {
			return [{ value: "", label: "Afterburner offline — tap refresh", disabled: true }];
		}

		return snapshot.sensors.map((sensor) => ({
			value: String(sensor.id),
			label: sensor.name,
		}));
	}

	private async pushSensorDatasource(snapshot: MahmSnapshot, force: boolean): Promise<void> {
		const signature = this.sensorSignature(snapshot);
		if (!force && signature === this.lastSensorSignature) {
			return;
		}

		this.lastSensorSignature = signature;
		await streamDeck.ui.sendToPropertyInspector({
			event: "getSensors",
			items: this.buildSensorItems(snapshot),
		} satisfies DataSourcePayload);
	}

	private async renderAllVisible(snapshot: MahmSnapshot): Promise<void> {
		for (const action of this.visibleActions.values()) {
			const settings = await action.getSettings();
			await this.renderAction(action, settings, snapshot);
		}
	}

	private parseSensorId(sensorId: SensorMonitorSettings["sensorId"]): number | undefined {
		if (sensorId === undefined || sensorId === null || sensorId === "") {
			return undefined;
		}

		const parsed = typeof sensorId === "number" ? sensorId : Number(sensorId);
		return Number.isFinite(parsed) ? parsed : undefined;
	}

	private keyViewFor(
		settings: SensorMonitorSettings,
		snapshot: MahmSnapshot,
	): KeyView {
		const showLabel = settings.showLabel !== false;
		const customLabel = settings.customLabel?.trim();
		const sensorId = this.parseSensorId(settings.sensorId);

		if (!snapshot.connected) {
			return {
				label: showLabel ? "OFFLINE" : undefined,
				value: "N/A",
				accent: "#3a4150",
				muted: true,
			};
		}

		if (sensorId === undefined) {
			return {
				label: showLabel ? "SENSOR" : undefined,
				value: "—",
				accent: "#5b6b8c",
				muted: true,
			};
		}

		const sensor = snapshot.sensors.find((entry) => entry.id === sensorId);
		if (!sensor) {
			return {
				label: showLabel ? "MISSING" : undefined,
				value: "N/A",
				accent: "#3a4150",
				muted: true,
			};
		}

		const label = customLabel || shortSensorLabel(sensor.name);
		return {
			label: showLabel ? label : undefined,
			value: formatKeyNumber(sensor.value, sensor.units),
			units: sensor.units || undefined,
			accent: accentForSensor(sensor.units, sensor.value),
		};
	}

	private compactTitle(view: KeyView): string {
		const lines = [view.label, view.value, view.units].filter((line) => line);
		return lines.join("\n");
	}

	private async renderAction(
		action: WillAppearEvent<SensorMonitorSettings>["action"],
		settings: SensorMonitorSettings,
		snapshot: MahmSnapshot,
	): Promise<void> {
		const view = this.keyViewFor(settings, snapshot);

		try {
			const image = renderKeyImage(view);
			if (this.lastImage.get(action.id) !== image) {
				this.lastImage.set(action.id, image);
				await action.setTitle("");
				await action.setImage(image);
			}
		} catch (error) {
			streamDeck.logger.warn(`Falling back to key title: ${error}`);
			await action.setImage(undefined);
			await action.setTitle(this.compactTitle(view));
		}
	}
}
