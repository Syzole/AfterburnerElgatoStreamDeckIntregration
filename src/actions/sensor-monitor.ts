import streamDeck, {
	action,
	DidReceiveSettingsEvent,
	SendToPluginEvent,
	SingletonAction,
	WillAppearEvent,
	WillDisappearEvent,
} from "@elgato/streamdeck";

import { formatSensorValue } from "../mahm/reader.js";
import type { MahmSnapshot } from "../mahm/types.js";
import { mahmPoller } from "../services/mahm-poller.js";

type DataSourcePayload = {
	event: string;
	items: Array<{ value: number; label: string }>;
};

type SensorMonitorSettings = {
	sensorId?: number;
	sensorName?: string;
	showLabel?: boolean;
};

type SensorDatasourceRequest = {
	event?: string;
};

@action({ UUID: "com.syzole.aftermonitor.sensor" })
export class SensorMonitor extends SingletonAction<SensorMonitorSettings> {
	private readonly updateListener = (snapshot: MahmSnapshot) => {
		void this.renderVisibleActions(snapshot);
	};

	override onWillAppear(ev: WillAppearEvent<SensorMonitorSettings>): void | Promise<void> {
		mahmPoller.subscribe(this.updateListener);
		return this.renderAction(ev.action, ev.payload.settings, mahmPoller.getSnapshot());
	}

	override onWillDisappear(_ev: WillDisappearEvent<SensorMonitorSettings>): void | Promise<void> {
		mahmPoller.unsubscribe(this.updateListener);
	}

	override onDidReceiveSettings(ev: DidReceiveSettingsEvent<SensorMonitorSettings>): void | Promise<void> {
		return this.renderAction(ev.action, ev.payload.settings, mahmPoller.getSnapshot());
	}

	override async onSendToPlugin(ev: SendToPluginEvent<SensorDatasourceRequest, SensorMonitorSettings>): Promise<void> {
		const payload = ev.payload;
		if (!payload || typeof payload !== "object" || payload.event !== "getSensors") {
			return;
		}

		mahmPoller.refresh();

		const items = mahmPoller.getSensors().map((sensor) => ({
			value: sensor.id,
			label: `${sensor.name} (${formatSensorValue(sensor.value, sensor.units)})`,
		}));

		await streamDeck.ui.current?.sendToPropertyInspector({
			event: "getSensors",
			items,
		} satisfies DataSourcePayload);
	}

	private async renderVisibleActions(snapshot: MahmSnapshot): Promise<void> {
		for (const action of this.actions) {
			const settings = await action.getSettings();
			await this.renderAction(action, settings, snapshot);
		}
	}

	private async renderAction(
		action: WillAppearEvent<SensorMonitorSettings>["action"],
		settings: SensorMonitorSettings,
		snapshot: MahmSnapshot,
	): Promise<void> {
		settings.showLabel ??= true;

		if (!snapshot.connected) {
			await action.setTitle("N/A");
			return;
		}

		if (settings.sensorId === undefined) {
			await action.setTitle(settings.showLabel ? "Select\nsensor" : "N/A");
			return;
		}

		const sensor = snapshot.sensors.find((entry) => entry.id === settings.sensorId);
		if (!sensor) {
			await action.setTitle("N/A");
			return;
		}

		settings.sensorName = sensor.name;
		const valueText = formatSensorValue(sensor.value, sensor.units);
		const title = settings.showLabel ? `${sensor.name}\n${valueText}` : valueText;
		await action.setTitle(title);
	}
}
