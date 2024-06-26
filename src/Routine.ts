/*
Factory.when(conditionFunc)                  | The routine will be availbe, if the conditionFunc returns true
Factory.possible(conditionFunc)              | Adds a condition if the routine is possible
Factory.if(conditionFunc, subRoutine)        | The subRoutine will be executed, if the conditionFunc returns true
Factory.all(subRoutine1, ..., subRoutineN)   | Executes all possible subRoutines in order (needed?)
Factory.each(array, () => subRoutine)        | Creates a subRoutine for each item in the array
Factory.reserve(reservations)                | Reserves the given items for the current routine
Factory.setup(subRoutine)                    | A setup to be done every time the routine is executed (needed?)
Factory.cleanup(subRoutine)                  | A subRoutine to be executed if something goes wrong
Factory.abort()                              | Aborts the current routine, will call the cleanup subRoutine (needed?)
Factory.finish()                             | Finishes building, returns the routine

-----------------------------------------------------------------------------------------------------------------

Factory.deliver(from, to, items)             | Delivers "items" from "from" to "to"
Factory.reduce(reducer)                      | Reduces the items in "reducer"
Factory.install(name, deviceType, position)  | Installs a device of the given type at the given position
Factory.uninstall(device)                    | Uninstalls the given device
Factory.energize(battery)                    | Charges at the given battery
Factory.delete(device)                       | Deletes the content of the given device

-----------------------------------------------------------------------------------------------------------------

Devices are passed as functions that return the device object.
The routine builder has no NS instance.
(Maybe all functions passed should get the previous actions taken?, like (actions: Action[]) => Device)

-----------------------------------------------------------------------------------------------------------------

deliverR0 = Factory.when(...).possible(...).deliver(() => isocket, () => osocket, [r0]).finish();
deliverG0 = Factory.when(...).possible(...).deliver(() => isocket, () => osocket, [g0]).finish();
deliverB0 = Factory.when(...).possible(...).deliver(() => isocket, () => osocket, [b0]).finish();

R0ToReducerT1 = Factory.possible(...).deliver(() => findSomeDeviceWith([r0]), reducerT1, [r0]).finish();
G0ToReducerT1 = Factory.possible(...).deliver(() => findSomeDeviceWith([g0]), reducerT1, [g0]).finish();
B0ToReducerT1 = Factory.possible(...).deliver(() => findSomeDeviceWith([b0]), reducerT1, [b0]).finish();

produceY1 = Factory.possible(...)
	.if(noR0InReducerT1, R0ToReducerT1)
	.if(noG0InReducerT1, G0ToReducerT1)
	.reduce(reducerT1)
	.finish();

produceC1 = Factory.possible(...)
	.if(noG0InReducerT1, G0ToReducerT1)
	.if(noB0InReducerT1, B0ToReducerT1)
	.reduce(reducerT1)
	.finish();

produceM1 = Factory.possible(...)
	.if(noR0InReducerT1, R0ToReducerT1)
	.if(noB0InReducerT1, B0ToReducerT1)
	.reduce(reducerT1)
	.finish();

produceW2 = Factory.possible(...)
	.if(noY1InReducerT2, Y1ToReducerT2)
	.if(noC1InReducerT2, C1ToReducerT2)
	.if(noM1InReducerT2, M1ToReducerT2)
	.reduce(reducerT2)
	.finish();

deliverW2 = Factory.when(...).if(noW2Available, produceW2).deliver(() => device, () => osocket, [w2]).finish();

*/

import { NS } from "@ns";
import { Executable, Task } from "./util";
import { Bus } from "./types";
import { ContentReservation } from "./ContentReservation";

export class Routine implements Executable {
	name: string;
	whenFunc: ((bus: () => Bus) => boolean) | null;
	possibleFunc: ((bus: () => Bus) => boolean) | null;
	startPossibleFunc: ((bus: () => Bus) => boolean) | null;
	cleanupRoutine: Executable | null;

	reservations: (() => ({
		deviceID: string;
		index: number;
	}[] | null)) | null = null;
	currentReservations: {
		deviceID: string;
		index: number;
	}[] | null = null;

	steps: Task[];
	currentStep = 0;
	isRunning = false;
	isExecuting = false;

	constructor(
		name: string,
		when: ((bus: () => Bus) => boolean) | null,
		possible: ((bus: () => Bus) => boolean) | null,
		startPossible: ((bus: () => Bus) => boolean) | null,
		cleanup: Executable | null,
		steps: Task[],
		reservations: (() => ({ deviceID: string; index: number }[] | null)) | null = null
	) {
		this.name = name;
		this.whenFunc = when;
		this.possibleFunc = possible;
		this.startPossibleFunc = startPossible;
		this.cleanupRoutine = cleanup;
		this.reservations = reservations;
		this.steps = steps;

		if (this.steps.length === 0) throw new Error(`Internal error: Routine ${this.name} has no steps.`);
	}

	private nextStep(callStack: Executable[]) {
		const increment = this.currentStep + 1;
		const isDone = increment >= this.steps.length;
		this.currentStep = increment % this.steps.length;

		if (isDone) {
			this.release(callStack);
			this.isRunning = false;
		}

		return isDone;
	}

	when(bus: () => Bus) {
		if (this.whenFunc === null) return true;
		return this.whenFunc(bus);
	}

	// Checks if some step is possible
	possible(bus: () => Bus, callStack: Executable[] = []): boolean {
		if (this.isExecuting) return false;
		if (this.possibleFunc !== null && !this.possibleFunc(bus)) return false;

		if (this.reservations !== null) for (const reservation of this.reservations() ?? []) {
			if (!ContentReservation.isReserved(reservation.deviceID, reservation.index)) continue;
			if (ContentReservation.canAccess(reservation.deviceID, reservation.index, this)) continue;
			return false;
		}

		if (!this.isRunning && this.startPossibleFunc !== null && !this.startPossibleFunc(bus)) return false;

		const step = this.steps[this.currentStep];
		if (step === undefined) throw new Error(`Internal error: Step ${this.currentStep} not found.`);
		
		if (step.while !== null && !step.while(bus)) return true;
		return step.task.possible(bus, [...callStack, this]);
	}

	async cleanup(ns: NS, bus: () => Bus, callStack: Executable[]): Promise<{ success: boolean, done: boolean }> {
		const cleanupResult = await this.cleanupRoutine?.execute(ns, bus, [...callStack, this]);
		if (cleanupResult !== undefined && !cleanupResult.success) throw new Error(`Cleanup routine for '${this.name}' failed.`);
		
		// Reset the state of the routine, the user is expected to make sure this won't result in errors
		this.isRunning = false;
		this.currentStep = 0;

		return { success: false, done: false };
	}

	private reserve(callStack: Executable[]): boolean {
		if (this.reservations === null) return true;
		this.currentReservations = this.reservations();
		if (this.currentReservations === null) return true;

		const successful = this.currentReservations.every(reservation => ContentReservation.reserve(reservation.deviceID, reservation.index, this, callStack));
	
		if (successful) return true;
		this.release(callStack);
		return false;
	}

	private release(callStack: Executable[]) {
		if (this.reservations === null) return;
		if (this.currentReservations === null) return;
		for (const reservation of this.currentReservations) {
			ContentReservation.release(reservation.deviceID, reservation.index, this, callStack);
		}
	}

	// Executes the highest possible step
	async execute(ns: NS, bus: () => Bus, callStack: Executable[] = []): Promise<{ success: boolean, done: boolean }> {
		try {
			if (!this.possible(bus, callStack)) return { success: false, done: false };
			if (!this.reserve(callStack)) return { success: false, done: false };
			
			console.log(`${"-".repeat(callStack.length)}EXECUTING ${this.name}`);
			const step = this.steps[this.currentStep]!;
			this.isRunning = true;
			this.isExecuting = true;

			// Only skip the task if it is not running and shouldn't be run due to the while clause
			if ((!(step.task instanceof Routine) || !step.task.isRunning) && step.while !== null && !step.while(bus)) {
				const isDone = this.nextStep(callStack);
				console.log(`${"-".repeat(callStack.length)}SKIPPED ${this.name}`);
				return { success: true, done: isDone };
			}

			if (step.task.possible(bus, [...callStack, this])) {
				const result = await step.task.execute(ns, bus, [...callStack, this]);
				if (result.success) {
					let isDone = false;
					if (result.done && (step.while === null || !step.while(bus))) isDone = this.nextStep(callStack);

					if (isDone) console.log(`${"-".repeat(callStack.length)}DONE ${this.name}`);

					return { success: true, done: isDone };
				}
			}

			console.error("INTERNAL ERROR: Step failed.", step);
			console.warn("STARTING CLEANUP", this.cleanupRoutine);
			return await this.cleanup(ns, bus, callStack);
		} finally {
			this.isExecuting = false;
		}
	}
}