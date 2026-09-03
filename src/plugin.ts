import streamDeck, { LogLevel } from "@elgato/streamdeck";

import { SensorMonitor } from "./actions/sensor-monitor";

streamDeck.logger.setLevel(LogLevel.INFO);

streamDeck.actions.registerAction(new SensorMonitor());

streamDeck.connect();
