import { NS } from "@ns";
import { getBus } from "./util";
import { Component } from "./types";
import { makeCharge, makeDeliverT0, makeDeliverT1, makeDeliverT2, makeDeliverT3, makeProduceT1, makeProduceT2, makeProduceT3, makeSetup, makeStoreT0, makeUpgrade } from "./routines";
import { ContentReservation } from "./ContentReservation";
import { recipes } from "./recipes";
import { Routine } from "./Routine";

export async function main(ns: NS) {
	// Static values are not reset, so it is done manually
	ContentReservation.reset();

	ns.myrian.DEUBG_RESET();
	// ns.myrian.DEBUG_GIVE_VULNS(3e16);

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

	const t1ProduceRoutines: Partial<Record<Component, Routine>> = {
		[Component.Y1]: makeProduceT1(ns, recipes[1].find(r => r.output === Component.Y1)!),
		[Component.C1]: makeProduceT1(ns, recipes[1].find(r => r.output === Component.C1)!),
		[Component.M1]: makeProduceT1(ns, recipes[1].find(r => r.output === Component.M1)!),

		[Component.R1]: makeProduceT1(ns, recipes[1].find(r => r.output === Component.R1)!),
		[Component.G1]: makeProduceT1(ns, recipes[1].find(r => r.output === Component.G1)!),
		[Component.B1]: makeProduceT1(ns, recipes[1].find(r => r.output === Component.B1)!),
	}

	const t2ProduceRoutines: Partial<Record<Component, Routine>> = {
		[Component.W2]: makeProduceT2(ns, recipes[2].find(r => r.output === Component.W2)!, t1ProduceRoutines),

		[Component.Y2]: makeProduceT2(ns, recipes[2].find(r => r.output === Component.Y2)!, t1ProduceRoutines),
		[Component.C2]: makeProduceT2(ns, recipes[2].find(r => r.output === Component.C2)!, t1ProduceRoutines),
		[Component.M2]: makeProduceT2(ns, recipes[2].find(r => r.output === Component.M2)!, t1ProduceRoutines),

		[Component.R2]: makeProduceT2(ns, recipes[2].find(r => r.output === Component.R2)!, t1ProduceRoutines),
		[Component.G2]: makeProduceT2(ns, recipes[2].find(r => r.output === Component.G2)!, t1ProduceRoutines),
		[Component.B2]: makeProduceT2(ns, recipes[2].find(r => r.output === Component.B2)!, t1ProduceRoutines),
	}

	const t3ProduceRoutines: Partial<Record<Component, Routine>> = {
		[Component.W3]: makeProduceT3(ns, recipes[3].find(r => r.output === Component.W3)!, t2ProduceRoutines),

		[Component.Y3]: makeProduceT3(ns, recipes[3].find(r => r.output === Component.Y3)!, t2ProduceRoutines),
		[Component.C3]: makeProduceT3(ns, recipes[3].find(r => r.output === Component.C3)!, t2ProduceRoutines),
		[Component.M3]: makeProduceT3(ns, recipes[3].find(r => r.output === Component.M3)!, t2ProduceRoutines),

		[Component.R3]: makeProduceT3(ns, recipes[3].find(r => r.output === Component.R3)!, t2ProduceRoutines),
		[Component.G3]: makeProduceT3(ns, recipes[3].find(r => r.output === Component.G3)!, t2ProduceRoutines),
		[Component.B3]: makeProduceT3(ns, recipes[3].find(r => r.output === Component.B3)!, t2ProduceRoutines),
	}

	const produceRoutines: Partial<Record<Component, Routine>> = {
		...t1ProduceRoutines,
		...t2ProduceRoutines,
		...t3ProduceRoutines
	};

	const routines = [
		makeCharge(ns),
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

		// T1
		makeDeliverT1(ns, Component.Y1, produceRoutines[Component.Y1]!),
		makeDeliverT1(ns, Component.C1, produceRoutines[Component.C1]!),
		makeDeliverT1(ns, Component.M1, produceRoutines[Component.M1]!),

		makeDeliverT1(ns, Component.R1, produceRoutines[Component.R1]!),
		makeDeliverT1(ns, Component.G1, produceRoutines[Component.G1]!),
		makeDeliverT1(ns, Component.B1, produceRoutines[Component.B1]!),

		// T2
		makeDeliverT2(ns, Component.Y2, produceRoutines[Component.Y2]!),
		makeDeliverT2(ns, Component.C2, produceRoutines[Component.C2]!),
		makeDeliverT2(ns, Component.M2, produceRoutines[Component.M2]!),

		makeDeliverT2(ns, Component.R2, produceRoutines[Component.R2]!),
		makeDeliverT2(ns, Component.G2, produceRoutines[Component.G2]!),
		makeDeliverT2(ns, Component.B2, produceRoutines[Component.B2]!),

		makeDeliverT2(ns, Component.W2, produceRoutines[Component.W2]!),

		// T3
		makeDeliverT3(ns, Component.Y3, produceRoutines[Component.Y3]!),
		makeDeliverT3(ns, Component.C3, produceRoutines[Component.C3]!),
		makeDeliverT3(ns, Component.M3, produceRoutines[Component.M3]!),

		makeDeliverT3(ns, Component.R3, produceRoutines[Component.R3]!),
		makeDeliverT3(ns, Component.G3, produceRoutines[Component.G3]!),
		makeDeliverT3(ns, Component.B3, produceRoutines[Component.B3]!),

		makeDeliverT3(ns, Component.W3, produceRoutines[Component.W3]!),
	]

	while (true) {
		await ns.asleep(500);

		console.warn("CYCLE");

		for (const routine of routines) {
			if (!routine.when(() => getBus(ns, "alice"))) continue;
			if (!routine.possible(() => getBus(ns, "alice"))) {
				// console.log(`Routine '${routine.name}' is not possible`);
				continue;
			}

		const result = await routine.execute(ns, () => getBus(ns, "alice"));
		if (!result) console.log(`Routine '${routine.name}' failed`);
		break;
		}
	}
}

// ISSUE: Not enough charge for one trip, cost too high
// LIMITATION: Can only produce T3 or lower
// LIMITATION: Only one bus is used