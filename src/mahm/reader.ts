import koffi from "koffi";

import {
	MAHM_ENTRY_OFFSETS,
	MAHM_HEADER_OFFSETS,
	MAHM_MAPPING_NAMES,
	MAHM_MAX_STALENESS_SECONDS,
	MAHM_RETRY_INTERVAL_MS,
	MAHM_SIGNATURE,
	type MahmSensor,
	type MahmSnapshot,
} from "./types.js";

const FILE_MAP_READ = 0x0004;
const MAX_ENTRIES = 4096;
const MAX_VIEW_SIZE = 8 * 1024 * 1024;

type Kernel32 = {
	OpenFileMappingW: (desiredAccess: number, inheritHandle: boolean, name: string) => unknown;
	MapViewOfFile: (fileMapping: unknown, desiredAccess: number, fileOffsetHigh: number, fileOffsetLow: number, numberOfBytesToMap: number) => unknown;
	UnmapViewOfFile: (baseAddress: unknown) => boolean;
	CloseHandle: (handle: unknown) => boolean;
};

let kernel32: Kernel32 | null = null;

function getKernel32(): Kernel32 | null {
	if (process.platform !== "win32") {
		return null;
	}

	if (!kernel32) {
		const lib = koffi.load("kernel32.dll");
		kernel32 = {
			OpenFileMappingW: lib.func("OpenFileMappingW", "void *", ["uint32", "bool", "str16"]),
			MapViewOfFile: lib.func("MapViewOfFile", "void *", ["void *", "uint32", "uint32", "uint32", "size_t"]),
			UnmapViewOfFile: lib.func("UnmapViewOfFile", "bool", ["void *"]),
			CloseHandle: lib.func("CloseHandle", "bool", ["void *"]),
		};
	}

	return kernel32;
}

function readCString(view: DataView, offset: number, length: number): string {
	const bytes = new Uint8Array(view.buffer, view.byteOffset + offset, length);
	let end = bytes.indexOf(0);
	if (end < 0) {
		end = length;
	}

	return new TextDecoder("ascii", { fatal: false }).decode(bytes.subarray(0, end));
}

function isValidValue(value: number): boolean {
	return Number.isFinite(value) && value < 1e30;
}

function formatValue(value: number | null): string {
	if (value === null || !isValidValue(value)) {
		return "N/A";
	}

	if (Number.isInteger(value)) {
		return `${value}`;
	}

	return value.toFixed(1);
}

export function formatSensorValue(value: number | null, units: string): string {
	const formatted = formatValue(value);
	if (formatted === "N/A") {
		return formatted;
	}

	return units ? `${formatted} ${units}` : formatted;
}

export class MahmReader {
	private mapHandle: unknown | null = null;
	private viewPtr: unknown | null = null;
	private nextRetryAt = 0;

	disconnect(): void {
		const api = getKernel32();
		if (this.viewPtr && api) {
			api.UnmapViewOfFile(this.viewPtr);
		}

		if (this.mapHandle && api) {
			api.CloseHandle(this.mapHandle);
		}

		this.mapHandle = null;
		this.viewPtr = null;
		this.nextRetryAt = 0;
	}

	read(): MahmSnapshot {
		if (process.platform !== "win32") {
			return { connected: false, sensors: [], timestamp: Date.now() };
		}

		if (!this.ensureConnected()) {
			return { connected: false, sensors: [], timestamp: Date.now() };
		}

		const view = this.getLiveView();
		if (!view) {
			return { connected: false, sensors: [], timestamp: Date.now() };
		}

		try {
			const signature = view.getUint32(MAHM_HEADER_OFFSETS.signature, true);
			if (signature !== MAHM_SIGNATURE) {
				this.disconnect();
				return { connected: false, sensors: [], timestamp: Date.now() };
			}

			const headerSize = view.getUint32(MAHM_HEADER_OFFSETS.headerSize, true);
			const numEntries = view.getUint32(MAHM_HEADER_OFFSETS.numEntries, true);
			const entrySize = view.getUint32(MAHM_HEADER_OFFSETS.entrySize, true);
			const updatedAt = view.getInt32(MAHM_HEADER_OFFSETS.time, true);

			if (headerSize < 24 || entrySize < MAHM_ENTRY_OFFSETS.data + 4 || numEntries === 0 || numEntries > MAX_ENTRIES) {
				this.disconnect();
				return { connected: false, sensors: [], timestamp: Date.now() };
			}

			const tableEnd = headerSize + numEntries * entrySize;
			if (tableEnd > view.byteLength) {
				this.disconnect();
				return { connected: false, sensors: [], timestamp: Date.now() };
			}

			const ageSeconds = Math.abs(Date.now() / 1000 - updatedAt);
			if (ageSeconds > MAHM_MAX_STALENESS_SECONDS) {
				this.disconnect();
				return { connected: false, sensors: [], timestamp: Date.now() };
			}

			const sensors: MahmSensor[] = [];
			for (let index = 0; index < numEntries; index++) {
				const entryOffset = headerSize + index * entrySize;
				const rawValue = view.getFloat32(entryOffset + MAHM_ENTRY_OFFSETS.data, true);
				const value = isValidValue(rawValue) ? rawValue : null;

				sensors.push({
					id: index,
					name: readCString(view, entryOffset + MAHM_ENTRY_OFFSETS.name, 260),
					units: readCString(view, entryOffset + MAHM_ENTRY_OFFSETS.units, 260),
					value,
					gpuIndex: view.getUint32(entryOffset + MAHM_ENTRY_OFFSETS.gpuIndex, true),
				});
			}

			return {
				connected: true,
				sensors,
				timestamp: Date.now(),
			};
		} catch {
			this.disconnect();
			return { connected: false, sensors: [], timestamp: Date.now() };
		}
	}

	private getLiveView(): DataView | null {
		if (!this.viewPtr) {
			return null;
		}

		const buffer = koffi.view(this.viewPtr, MAX_VIEW_SIZE);
		return new DataView(buffer);
	}

	private ensureConnected(): boolean {
		if (this.viewPtr) {
			return true;
		}

		const now = Date.now();
		if (now < this.nextRetryAt) {
			return false;
		}

		this.nextRetryAt = now + MAHM_RETRY_INTERVAL_MS;
		return this.connect();
	}

	private connect(): boolean {
		const api = getKernel32();
		if (!api) {
			return false;
		}

		this.disconnect();

		for (const mappingName of MAHM_MAPPING_NAMES) {
			const mapHandle = api.OpenFileMappingW(FILE_MAP_READ, false, mappingName);
			if (!mapHandle) {
				continue;
			}

			const viewPtr = api.MapViewOfFile(mapHandle, FILE_MAP_READ, 0, 0, 0);
			if (!viewPtr) {
				api.CloseHandle(mapHandle);
				continue;
			}

			const buffer = koffi.view(viewPtr, MAX_VIEW_SIZE);
			this.mapHandle = mapHandle;
			this.viewPtr = viewPtr;
			return true;
		}

		return false;
	}
}
