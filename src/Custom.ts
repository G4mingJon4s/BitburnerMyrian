import { NS } from "@ns";
import { Bus } from "./types";
import { Executable, ExecutableResult } from "./util";

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

	async execute(ns: NS, bus: () => Bus): Promise<ExecutableResult> {
		try {
			await this.callbackFunc(bus);
			return { error: false, done: true };
		} catch (e) {
			return { error: false, done: false };
		}
	}
}