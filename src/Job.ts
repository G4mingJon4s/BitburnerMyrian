import { NS } from "@ns";
import { Bus } from "./types";
import { Action, Executable, ExecutableResult } from "./util";
import { canDoTransfer, executeTransfer } from "./actions/transfer";
import { canDoReduce, executeReduce } from "./actions/reduce";
import { canDoInstall, executeInstall } from "./actions/install";
import { canDoUninstall, executeUninstall } from "./actions/uninstall";
import { canDoEnergize, executeEnergize } from "./actions/energize";
import { canDoTweak, executeTweak } from "./actions/tweak";
import { canDoDeleteContent, executeDeleteContent } from "./actions/deleteContent";

export class Job implements Executable {
	action: Action;

	constructor(action: Action) {
		this.action = action;
	}

	possible(bus:() => Bus, callStack: Executable[]): boolean {
		if (this.action.type === "transfer") return canDoTransfer(this.action, bus, this, callStack);
		if (this.action.type === "reduce") return canDoReduce(this.action, bus, this, callStack);
		if (this.action.type === "install") return canDoInstall(this.action, bus, this, callStack);
		if (this.action.type === "uninstall") return canDoUninstall(this.action, bus, this, callStack);
		if (this.action.type === "energize") return canDoEnergize(this.action, bus, this, callStack);
		if (this.action.type === "tweak") return canDoTweak(this.action, bus, this, callStack);
		if (this.action.type === "delete") return canDoDeleteContent(this.action, bus, this, callStack);

		// @ts-expect-error Property 'type' does not exist on type 'never'.
		throw new Error(`Unhandled action type: ${this.action.type}`);
	}

	async execute(ns: NS, bus: () => Bus, callStack: Executable[]): Promise<ExecutableResult> {
		if (!this.possible(bus, callStack)) return { error: false, done: false };

		if (this.action.type === "transfer") return await executeTransfer(this.action, ns, bus, this, callStack);
		if (this.action.type === "reduce") return await executeReduce(this.action, ns, bus, this, callStack);
		if (this.action.type === "install") return await executeInstall(this.action, ns, bus, this, callStack);
		if (this.action.type === "uninstall") return await executeUninstall(this.action, ns, bus, this, callStack);
		if (this.action.type === "energize") return await executeEnergize(this.action, ns, bus, this, callStack);
		if (this.action.type === "tweak") return await executeTweak(this.action, ns, bus, this, callStack);
		if (this.action.type === "delete") return await executeDeleteContent(this.action, ns, bus, this, callStack);

		// @ts-expect-error Property 'type' does not exist on type 'never'.
		throw new Error(`Unhandled action type: ${this.action.type}`);
	}
}