import { createCanvas } from "@napi-rs/canvas";

export type KeyView = {
	label?: string;
	value: string;
	units?: string;
	accent: string;
	muted?: boolean;
};

const SIZE = 144;

function fitText(ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>, text: string, maxWidth: number, fontSize: number, weight: number): number {
	let size = fontSize;
	while (size >= 14) {
		ctx.font = `${weight} ${size}px "Segoe UI", Arial, sans-serif`;
		if (ctx.measureText(text).width <= maxWidth) {
			return size;
		}
		size -= 2;
	}

	ctx.font = `${weight} ${size}px "Segoe UI", Arial, sans-serif`;
	return size;
}

export function renderKeyImage(view: KeyView): string {
	const canvas = createCanvas(SIZE, SIZE);
	const ctx = canvas.getContext("2d");
	const muted = view.muted === true;

	ctx.fillStyle = "#12141a";
	ctx.fillRect(0, 0, SIZE, SIZE);

	ctx.fillStyle = muted ? "#3a4150" : view.accent;
	ctx.fillRect(0, 0, SIZE, 6);

	ctx.textAlign = "center";
	ctx.textBaseline = "middle";

	if (view.label) {
		ctx.fillStyle = muted ? "#6b7385" : "#9aa3b5";
		fitText(ctx, view.label, 124, 20, 600);
		ctx.fillText(view.label, SIZE / 2, 32, 124);
	}

	const valueSize = view.value.length >= 5 ? 40 : view.value.length >= 4 ? 48 : view.value.length >= 3 ? 56 : 64;
	ctx.fillStyle = muted ? "#8b93a4" : "#f4f6fb";
	fitText(ctx, view.value, 132, valueSize, 700);
	ctx.fillText(view.value, SIZE / 2, view.label ? 78 : 68, 132);

	if (view.units) {
		ctx.fillStyle = muted ? "#6b7385" : "#9aa3b5";
		fitText(ctx, view.units, 124, 22, 600);
		ctx.fillText(view.units, SIZE / 2, 118, 124);
	}

	return canvas.toDataURL("image/png");
}
