import { Custom } from "./Custom";
import { Job } from "./Job";
import { Routine } from "./Routine";
import { Battery, Bus, Component, ContainerDevice, Device, DeviceType, Reducer } from "./types";
import { Action, Executable, Point } from "./util";

export type SubRoutineInputs = Action | Executable | ((builder: RoutineBuilder) => RoutineBuilder);
export class RoutineBuilder {
	name: string;
	whenFunc: ((bus: () => Bus) => boolean) | null = null;
	possibleFunc: ((bus: () => Bus) => boolean) | null = null;
	startPossibleFunc: ((bus: () => Bus) => boolean) | null = null;
	cleanupStep: Executable | null = null;
	steps: { task: Executable; while: ((bus: () => Bus) => boolean) | null }[] = [];

	reservations: (() => ({ deviceID: string; index: number }[] | null)) | null = null;
	
	constructor(name: string) {
		this.name = name;
	}

	private static evaluateRoutineInput(name: string, routine: SubRoutineInputs): Executable {
		if ("type" in routine) return new Job(routine);

		if (routine instanceof Routine) return routine;
		if (routine instanceof Job) return routine;
		if (routine instanceof Custom) return routine;

		if (typeof routine !== "function") throw new Error(`Unhandled routine input: ${routine} (${name})`);
		const result = routine(new RoutineBuilder(name));
		// no need to create a "basic" routine if there is only one step
		if (result.steps.length === 1 && result.steps[0].while === null) return result.steps[0].task;
		return result.finish();
	}

	when(func: (bus: () => Bus) => boolean) {
		this.whenFunc = func;
		return this;
	}

	possible(func: (bus: () => Bus) => boolean) {
		this.possibleFunc = func;
		return this;
	}

	startPossible(func: (bus: () => Bus) => boolean) {
		this.startPossibleFunc = func;
		return this;
	}

	cleanup(routine: SubRoutineInputs) {
		this.cleanupStep = RoutineBuilder.evaluateRoutineInput(`${this.name}:cleanup`, routine);
		return this;
	}

	custom(possible: (bus: () => Bus) => boolean, callback: (bus: () => Bus) => Promise<void>) {
		this.steps.push({ task: new Custom(callback, possible), while: null });
		return this;
	}

	while(func: (bus: () => Bus) => boolean, routine: SubRoutineInputs) {
		this.steps.push({ task: RoutineBuilder.evaluateRoutineInput(`${this.name}:while#${this.steps.length}`, routine), while: func });
		return this;
	}

	each<T>(values: IterableIterator<T>, routine: (context: T) => (builder: this) => RoutineBuilder) {
		for (const item of values) routine(item)(this);
		return this;
	}

	reserve(reserations: (() => ({ deviceID: string; index: number }[] | null)) | null) {
		this.reservations = reserations;
		return this;
	}

	deliver(from: (bus: () => Bus) => ContainerDevice[], to: (bus: () => Bus) => ContainerDevice[], items: Component[]) {
		this.steps.push({ task: new Job({ type: "transfer", from, to, items }), while: null });
		return this;
	}

	reduce(reducer: (bus: () => Bus) => Reducer[], item: Component) {
		this.steps.push({ task: new Job({ type: "reduce", device: reducer, item }), while: null });
		return this;
	}

	install(vulns: () => number, devices: () => Device[], name: string, deviceType: DeviceType, position: Point) {
		this.steps.push({
			task: new Job({
				type: "install",
				devices,
				vulns,
				deviceType,
				position,
				name,
			}),
			while: null,
		})
		return this;
	}

	uninstall(device: (bus: () => Bus) => Device, devices: () => Device[]) {
		this.steps.push({ task: new Job({ type: "uninstall", device, devices }), while: null });
		return this;
	}
	
	energize(device: (bus: () => Bus) => Battery[]) {
		this.steps.push({ task: new Job({ type: "energize", device }), while: null });
		return this;
	}

	deleteContent(device: (bus: () => Bus) => ContainerDevice) {
		this.steps.push({ task: new Job({ type: "delete", device }), while: null });
		return this;
	}

	finish() {
		if (this.steps.length === 0) throw new Error(`Cannot create routine "${this.name}" with no steps`);

		return new Routine(
			this.name,
			this.whenFunc,
			this.possibleFunc,
			this.startPossibleFunc,
			this.cleanupStep,
			this.steps,
			this.reservations
		);
	}
}