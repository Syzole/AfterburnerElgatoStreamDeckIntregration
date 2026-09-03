export const MAHM_SIGNATURE = 0x4d41484d;
export const MAHM_MAX_STALENESS_SECONDS = 15;
export const MAHM_RETRY_INTERVAL_MS = 20_000;
export const MAHM_ENTRY_SIZE = 1324;
export const MAHM_STRING_LENGTH = 260;

export const MAHM_MAPPING_NAMES = ["MAHMSharedMemory", "Global\\MAHMSharedMemory"] as const;

export const MAHM_HEADER_OFFSETS = {
	signature: 0,
	headerSize: 8,
	numEntries: 12,
	entrySize: 16,
	time: 20,
} as const;

export const MAHM_ENTRY_OFFSETS = {
	name: 0,
	units: 260,
	data: 1300,
	gpuIndex: 1316,
} as const;

export type MahmSensor = {
	id: number;
	name: string;
	units: string;
	value: number | null;
	gpuIndex: number;
};

export type MahmSnapshot = {
	connected: boolean;
	sensors: MahmSensor[];
	timestamp: number;
};
