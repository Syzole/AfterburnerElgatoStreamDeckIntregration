const WORD_REPLACEMENTS: Array<[RegExp, string]> = [
	[/\bframe\s*rate\b/gi, "FPS"],
	[/\bframerate\b/gi, "FPS"],
	[/\bfan\s*tachometer\b/gi, "FAN"],
	[/\bfan\s*speed\b/gi, "FAN"],
	[/\bcore\s*clock\b/gi, "CLK"],
	[/\bmemory\s*clock\b/gi, "MCLK"],
	[/\bshader\s*clock\b/gi, "SCLK"],
	[/\btemperature\b/gi, ""],
	[/\btemp\b/gi, ""],
	[/\busage\b/gi, ""],
	[/\bclock\b/gi, "CLK"],
	[/\bpower\b/gi, "PWR"],
	[/\bvoltage\b/gi, "V"],
	[/\btachometer\b/gi, "FAN"],
	[/\bmemory\b/gi, "RAM"],
	[/\bframebuffer\b/gi, "VRAM"],
	[/\bfb\b/gi, "VRAM"],
];

export function shortSensorLabel(name: string): string {
	let label = name.trim();
	for (const [pattern, replacement] of WORD_REPLACEMENTS) {
		label = label.replace(pattern, replacement);
	}

	label = label.replace(/\s+/g, " ").trim();
	if (!label) {
		label = name.trim();
	}

	if (label.length > 8) {
		const parts = label.split(" ").filter(Boolean);
		if (parts.length > 1) {
			const last = parts[parts.length - 1];
			label = parts[0] === last ? parts[0] : `${parts[0]} ${last}`;
		}
	}

	if (label.length > 8) {
		label = label.slice(0, 8).trim();
	}

	return label.toUpperCase();
}

export function formatKeyNumber(value: number | null, units: string): string {
	if (value === null || !Number.isFinite(value) || value >= 1e30) {
		return "N/A";
	}

	const unit = units.toLowerCase();
	if (unit.includes("v") && !unit.includes("mv")) {
		return value.toFixed(2);
	}

	if (
		unit.includes("°") ||
		unit === "c" ||
		unit === "%" ||
		unit.includes("mhz") ||
		unit.includes("rpm") ||
		unit.includes("fps") ||
		Math.abs(value) >= 100
	) {
		return `${Math.round(value)}`;
	}

	if (Number.isInteger(value)) {
		return `${value}`;
	}

	return value.toFixed(1);
}


export function accentForSensor(units: string, value: number | null): string {
	const fallback = "#5b6b8c";
	if (value === null || !Number.isFinite(value)) {
		return fallback;
	}

	const unit = units.toLowerCase();
	if (unit.includes("°") || unit === "c" || unit === "f") {
		if (value < 60) {
			return "#3d9a6a";
		}
		if (value < 80) {
			return "#c9a227";
		}
		return "#c44b3c";
	}

	if (unit === "%") {
		if (value < 50) {
			return "#3d9a6a";
		}
		if (value < 85) {
			return "#c9a227";
		}
		return "#c44b3c";
	}

	return fallback;
}
