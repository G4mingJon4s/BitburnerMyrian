import { NS } from "@ns";
import { Bus } from "./types";
import { Executable } from "./util";

export class Custom implements Executable {
	possibleFunc: ((bus: () => Bus) => boolean);
	callbackFunc: ((bus: () => Bus) => Promise<void>);

	constructor(callbackFunc: ((bus: () => Bus) => Promise<void>), possibleFunc: ((bus: () => Bus) => boolean)) {
		this.callbackFunc = callbackFunc;
		this.possibleFunc = possibleFunc;
	}

	possible(bus: () => Bus): boolean {
		return this.possibleFunc(bus);
	}

	async execute(__ns: NS, bus: () => Bus): Promise<{ success: boolean, done: boolean }> {
		try {
			await this.callbackFunc(bus);
			return { success: true, done: true };
		} catch (e) {
			return { success: false, done: false };
		}
	}
}