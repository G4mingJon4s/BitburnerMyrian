import { NS } from "@ns";
import { getAllDevices, getBus, isDeviceBus, tierOfComponent } from "./util";
import { Component, Glitch } from "./types";
import { makeAll, makeCharge, makeDeliverT0, makeProduce, makeDeliver, makeSetup, makeStoreT0, makeUpgrade, makeRemoveLocks } from "./routines";
import { ContentReservation } from "./ContentReservation";
import { Routine } from "./Routine";
import { componentRecipes, recipes } from "./recipes";

export async function main(ns: NS) {
	// Static values are not reset, so it is done manually
	ContentReservation.reset();

	ns.myrian.DEUBG_RESET();
	ns.myrian.DEBUG_GIVE_VULNS(500);

	ns.disableLog("asleep");
	ns.clearLog();
	ns.tail();

	// QoL
	// for (let i = 0; i < 16; i++) ns.myrian.upgradeInstallLvl("alice");
	// for (let i = 0; i < 16; i++) ns.myrian.upgradeMoveLvl("alice");
	// for (let i = 0; i < 16; i++) ns.myrian.upgradeReduceLvl("alice");
	// for (let i = 0; i < 16; i++) ns.myrian.upgradeTransferLvl("alice");
	// for (const isocket of getAllDevices(ns, isDeviceISocket, () => true)) {
	// 	for (let i = 0; i < 50; i++) if(!ns.myrian.upgradeEmissionLvl(isocket.name)) break;
	// }

	await ns.myrian.setGlitchLvl(Glitch.Segmentation, 2);

	// await (async() => {
	// 	try {
	// 		console.log("Setting encryption to 3")
	// 		await ns.myrian.setGlitchLvl(Glitch.Encryption, 3);
	// 		console.log("Setting jamming to 3")
	// 		await ns.myrian.setGlitchLvl(Glitch.Jamming, 3);
	// 		console.log("Setting isolation to 3")
	// 		await ns.myrian.setGlitchLvl(Glitch.Isolation, 3);
	// 		console.log("Setting friction to 3")
	// 		await ns.myrian.setGlitchLvl(Glitch.Friction, 3);
	// 	} catch (e) {
	// 		console.error("Could not set glith levels", e);
	// 	}
	// })()

	const t1ProduceRoutines: Partial<Record<Component, Routine>> = makeAll(
		([Component.R1, Component.G1, Component.B1, Component.Y1, Component.C1, Component.M1] as const).values(),
		item => makeProduce(ns, componentRecipes[item], {}),
	);

	const t2ProduceRoutines: Partial<Record<Component, Routine>> = makeAll(
		([Component.R2, Component.G2, Component.B2, Component.Y2, Component.C2, Component.M2, Component.W2] as const).values(),
		item => makeProduce(ns, componentRecipes[item], t1ProduceRoutines),
	);

	const t3ProduceRoutines: Partial<Record<Component, Routine>> = makeAll(
		([Component.R3, Component.G3, Component.B3, Component.Y3, Component.C3, Component.M3, Component.W3] as const).values(),
		item => makeProduce(ns, componentRecipes[item], t2ProduceRoutines),
	);

	const produceRoutines: Partial<Record<Component, Routine>> = {
		...t1ProduceRoutines,
		...t2ProduceRoutines,
		...t3ProduceRoutines,
	};

	const routines = [
		makeCharge(ns),
		makeRemoveLocks(ns),
		makeSetup(ns),
		makeUpgrade(ns),

		// Fill storages
		makeStoreT0(ns, Component.R0),
		makeStoreT0(ns, Component.G0),
		makeStoreT0(ns, Component.B0),

		// T0
		makeDeliverT0(ns, Component.R0),
		makeDeliverT0(ns, Component.G0),
		makeDeliverT0(ns, Component.B0),

		// Higher tiers
		...[
			// Ordered after T0 components needed, lowest first
			Component.Y1,
			Component.C1,
			Component.M1,
			Component.R1,
			Component.G1,
			Component.B1,

			Component.Y2,
			Component.C2,
			Component.M2,
			Component.R2,
			Component.G2,
			Component.B2,
			Component.W2,

			Component.Y3,
			Component.C3,
			Component.M3,
			Component.R3,
			Component.G3,
			Component.B3,
			Component.W3,
		].map(item => makeDeliver(ns, recipes[tierOfComponent(item)].find(recipe => recipe.output === item)!, produceRoutines)),
	]

	const assigned = new Map<string, { routine: Routine, isDone: () => boolean, workflow: Promise<{ success: boolean, done: boolean }> }>();

	while (true) {
		await ns.asleep(500);

		// Remove finished tasks
		for (const [bus, task] of assigned.entries()) {
			if (!task.isDone()) continue;
			assigned.delete(bus);
		}

		// Assign new tasks
		for (const bus of getAllDevices(ns, isDeviceBus, () => true)) {
			if (assigned.has(bus.name)) continue;
			const busDevice = () => getBus(ns, bus.name);
			const routine = routines.find(routine => routine.when(busDevice) && routine.possible(busDevice));
			if (routine === undefined) continue;
			
			let isDone = false;
			assigned.set(bus.name, {
				routine,
				isDone: () => isDone,
				workflow: routine.execute(ns, busDevice, [], () => isDone = true),
			});
		}
	}
}

// LIMITATION: Can only produce T3 or lower