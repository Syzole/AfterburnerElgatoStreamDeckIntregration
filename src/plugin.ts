import streamDeck from "@elgato/streamdeck";

import { SensorMonitor } from "./actions/sensor-monitor";
import { mahmPoller } from "./services/mahm-poller";
import type { GlobalSettings } from "./settings";

streamDeck.logger.setLevel("info");

streamDeck.actions.registerAction(new SensorMonitor());

streamDeck.settings.onDidReceiveGlobalSettings<GlobalSettings>((ev) => {
	mahmPoller.setPollIntervalMs(ev.settings.pollIntervalMs);
});

void streamDeck.connect().then(async () => {
	const settings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
	mahmPoller.setPollIntervalMs(settings.pollIntervalMs);
});
