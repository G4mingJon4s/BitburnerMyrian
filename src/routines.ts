import { NS } from "@ns";
import { Component, DeviceType, Glitch, Recipe } from "./types";
import { countUp, getAllDevices, getBattery, getCache, getItemSources, getReducer, isDeviceISocket, isDeviceOSocket, isRequestingItem, Point } from "./util";
import { RoutineBuilder } from "./routineBuilder";
import { Routine } from "./Routine";

export const storages = new Map<string, Point>([
	["storageA", { x: 4, y: 2 }],
	["storageB", { x: 7, y: 2 }],
]);
export const storageNames = Array.from(storages.keys());

export const makeSetup = (ns: NS) => new RoutineBuilder("setup")
	.while(() => ns.myrian.getDevice("reducerT1") === undefined, builder => builder.install(
		ns.myrian.getVulns,
		ns.myrian.getDevices,
		"reducerT1",
		DeviceType.Reducer,
		{ x: 4, y: 5 }
	))
	.custom(() => ns.myrian.getDevice("reducerT1") !== undefined, async () => await ns.myrian.setGlitchLvl(Glitch.Encryption, 1))
	.while(() => ns.myrian.getDevice("batteryA") === undefined, builder => builder.install(
		ns.myrian.getVulns,
		ns.myrian.getDevices,
		"batteryA",
		DeviceType.Battery,
		{ x: 2, y: 5 }
	))
	.custom(() => ns.myrian.getDevice("batteryA") !== undefined, async () => await ns.myrian.setGlitchLvl(Glitch.Magnetism, 1))
	.each(storages.entries(), storage => builder => builder.install(
		ns.myrian.getVulns,
		ns.myrian.getDevices,
		storage[0],
		DeviceType.Cache,
		storage[1]
	))
	.while(() => ns.myrian.getDevice("reducerT2") === undefined, builder => builder.install(
		ns.myrian.getVulns,
		ns.myrian.getDevices,
		"reducerT2",
		DeviceType.Reducer,
		{ x: 7, y: 5 }
	))
	.while(() => getReducer(ns, "reducerT2").tier < 2, builder => builder.custom(
		() => ns.myrian.getDevice("reducerT2") !== undefined && ns.myrian.getUpgradeTierCost("reducerT2") <= ns.myrian.getVulns(),
		async () => void ns.myrian.upgradeTier("reducerT2")
	))
	.while(() => getReducer(ns, "reducerT2").maxContent < 3, builder => builder.custom(
		() => ns.myrian.getDevice("reducerT2") !== undefined && ns.myrian.getUpgradeMaxContentCost("reducerT2") <= ns.myrian.getVulns(),
		async () => void ns.myrian.upgradeMaxContent("reducerT2")
	))
	.custom(() => ns.myrian.getDevice("reducerT2") !== undefined, async () => await ns.myrian.setGlitchLvl(Glitch.Encryption, 2))
	.while(() => ns.myrian.getDevice("reducerT3") === undefined, builder => builder.install(
		ns.myrian.getVulns,
		ns.myrian.getDevices,
		"reducerT3",
		DeviceType.Reducer,
		{ x: 4, y: 8 }
	))
	.while(() => getReducer(ns, "reducerT3").tier < 3, builder => builder.custom(
		() => ns.myrian.getDevice("reducerT3") !== undefined && ns.myrian.getUpgradeTierCost("reducerT3") <= ns.myrian.getVulns(),
		async () => void ns.myrian.upgradeTier("reducerT3")
	))
	.while(() => getReducer(ns, "reducerT3").maxContent < 3, builder => builder.custom(
		() => ns.myrian.getDevice("reducerT3") !== undefined && ns.myrian.getUpgradeMaxContentCost("reducerT3") <= ns.myrian.getVulns(),
		async () => void ns.myrian.upgradeMaxContent("reducerT3")
	))
	.custom(() => ns.myrian.getDevice("reducerT3") !== undefined, async () => await ns.myrian.setGlitchLvl(Glitch.Encryption, 3))
	.custom(() => ns.myrian.getGlitchLvl(Glitch.Virtualization) < 3, async () => await ns.myrian.setGlitchLvl(Glitch.Virtualization, 3))
	.finish();

export const makeStoreT0 = (ns: NS, item: Component) => new RoutineBuilder(`storeT0: ${item}`)
	.when(() => getAllDevices(ns, isDeviceISocket, d => d.content.includes(item)).length > 0)
	.possible(() => storageNames.some(storage => ns.myrian.getDevice(storage) !== undefined))
	.deliver(
		() => getAllDevices(ns, isDeviceISocket, d => d.content.includes(item)),
		() => storageNames.filter(storage => ns.myrian.getDevice(storage) !== undefined).map(storage => getCache(ns, storage)),
		[item]
	)
	.finish();

export const makeCharge = (ns: NS) => new RoutineBuilder("charge")
	.when(bus => bus().energy < bus().maxEnergy * (2 / 3))
	.possible(() => ns.myrian.getDevice("batteryA") !== undefined)
	.energize(() => [getBattery(ns, "batteryA")])
	.finish();

export const makeUpgrade = (ns: NS) => new RoutineBuilder("upgrade")
	// .while(bus => bus().maxEnergy < 26, builder => builder.custom(
	// 	bus => ns.myrian.getUpgradeMaxEnergyCost(bus().name) <= ns.myrian.getVulns(),
	// 	async bus => void ns.myrian.getUpgradeMaxEnergyCost(bus().name)
	// ))
	.custom(() => ns.myrian.getDevice("batteryA") !== undefined && ns.myrian.getUpgradeTierCost("batteryA") < ns.myrian.getVulns(), async () => void ns.myrian.upgradeTier("batteryA"))
	.while(bus => bus().reduceLvl < 5, builder => builder.custom(
		bus => ns.myrian.getUpgradeReduceLvlCost(bus().name) <= ns.myrian.getVulns(),
		async bus => void ns.myrian.upgradeReduceLvl(bus().name)
	))
	.each(storages.keys(), storage => builder => builder.possible(() => ns.myrian.getDevice(storage) !== undefined).while(
		() => getCache(ns, storage).maxContent < 3,
		b => b.custom(
			() => ns.myrian.getUpgradeMaxContentCost(storage) <= ns.myrian.getVulns(),
			async () => void ns.myrian.upgradeMaxContent(storage)
		)
	))
	.while(bus => bus().moveLvl < 5, builder => builder.custom(
		bus => ns.myrian.getUpgradeMoveLvlCost(bus().name) <= ns.myrian.getVulns(),
		async bus => void ns.myrian.upgradeMoveLvl(bus().name)
	))
	.each(
		getAllDevices(ns, isDeviceISocket, () => true).values(),
		isocket => builder => builder.while(
			() => isocket.emissionLvl < 5,
			b => b.custom(
				() => ns.myrian.getUpgradeEmissionLvlCost(isocket.name) <= ns.myrian.getVulns(),
				async () => void ns.myrian.upgradeEmissionLvl(isocket.name)
			)
		)
	)
	.finish();

export const makeDeliverT0 = (ns: NS, item: Component) => new RoutineBuilder(`deliverT0: ${item}`)
	.when(() => getAllDevices(ns, isDeviceOSocket, d => isRequestingItem(d, item)).length > 0)
	.deliver(
		() => getItemSources(ns, item, storageNames),
		() => getAllDevices(ns, isDeviceOSocket, d => isRequestingItem(d, item)),
		[item]
	)
	.cleanup(builder => builder.deleteContent(bus => bus()))
	.finish();

export const makeProduceT1 = (ns: NS, recipe: Recipe) => new RoutineBuilder(`produceT1: ${recipe.output}`)
	.possible(() => ns.myrian.getDevice("reducerT1") !== undefined)
	.startPossible(() => getReducer(ns, "reducerT1").content.length === 0)
	.reserve(() => [{ deviceID: "reducerT1", index: 0 }, { deviceID: "reducerT1", index: 1 }])
	.each(countUp(recipe.input).keys(), input => builder => builder.while(
		() => {
			const numInReducer = getReducer(ns, "reducerT1").content.filter(i => i === input).length;
			return numInReducer < countUp(recipe.input).get(input)!;
		},
		b => b.deliver(
			() => getItemSources(ns, input, storageNames),
			() => [getReducer(ns, "reducerT1")],
			[input]
		)
	))
	.reduce(() => [getReducer(ns, "reducerT1")], recipe.output)
	.cleanup(builder => builder.deleteContent(() => getReducer(ns, "reducerT1")))
	.finish();

export const makeDeliverT1 = (ns: NS, item: Component, produceRoutine: Routine) => new RoutineBuilder(`deliverT1: ${item}`)
	.when(() => getAllDevices(ns, isDeviceOSocket, d => isRequestingItem(d, item)).length > 0)
	.possible(() => ns.myrian.getDevice("reducerT1") !== undefined)
	.while(() => !getReducer(ns, "reducerT1").content.includes(item), produceRoutine)
	.deliver(
		() => [getReducer(ns, "reducerT1")],
		() => getAllDevices(ns, isDeviceOSocket, d => isRequestingItem(d, item)),
		[item]
	)
	.cleanup(builder => builder.deleteContent(bus => bus()))
	.finish();

export const makeProduceT2 = (ns: NS, recipe: Recipe, produceRoutines: Partial<Record<Component, Routine>>) => new RoutineBuilder(`produceT2: ${recipe.output}`)
	.possible(() => ns.myrian.getDevice("reducerT2") !== undefined)
	.startPossible(() => getReducer(ns, "reducerT2").content.length === 0)
	.reserve(() => [{ deviceID: "reducerT2", index: 0 }, { deviceID: "reducerT2", index: 1 }, { deviceID: "reducerT2", index: 2 }])
	.each(
		countUp(recipe.input).keys(),
		input => builder => builder.while(
			() => countUp(recipe.input).get(input)! > (countUp(getReducer(ns, "reducerT2").content).get(input) ?? 0),
			b => b.while(
				() => !getReducer(ns, "reducerT1").content.includes(input),
				produceRoutines[input] !== undefined
					? produceRoutines[input]
					: b => b.deliver(
						() => getItemSources(ns, input, storageNames),
						() => [getReducer(ns, "reducerT1")],
						[input]
					)
			)
			.deliver(
				() => [getReducer(ns, "reducerT1")],
				() => [getReducer(ns, "reducerT2")],
				[input]
			)
		)
	)
	.reduce(() => [getReducer(ns, "reducerT2")], recipe.output)
	.cleanup(builder => builder.deleteContent(() => getReducer(ns, "reducerT2")))
	.finish();

export const makeDeliverT2 = (ns: NS, item: Component, produceRoutine: Routine) => new RoutineBuilder(`deliverT2: ${item}`)
	.when(() => getAllDevices(ns, isDeviceOSocket, d => isRequestingItem(d, item)).length > 0)
	.possible(() => ns.myrian.getDevice("reducerT2") !== undefined)
	.while(() => !getReducer(ns, "reducerT2").content.includes(item), produceRoutine)
	.deliver(
		() => [getReducer(ns, "reducerT2")],
		() => getAllDevices(ns, isDeviceOSocket, d => isRequestingItem(d, item)),
		[item]
	)
	.cleanup(builder => builder.deleteContent(bus => bus()))
	.finish();

export const makeProduceT3 = (ns: NS, recipe: Recipe, produceRoutines: Partial<Record<Component, Routine>>) => new RoutineBuilder(`produceT3: ${recipe.output}`)
	.possible(() => ns.myrian.getDevice("reducerT3") !== undefined)
	.startPossible(() => getReducer(ns, "reducerT3").content.length === 0)
	.reserve(() => [{ deviceID: "reducerT3", index: 0 }, { deviceID: "reducerT3", index: 1 }, { deviceID: "reducerT3", index: 2 }])
	.each(
		countUp(recipe.input).keys(),
		input => builder => builder.while(
			() => countUp(recipe.input).get(input)! > (countUp(getReducer(ns, "reducerT3").content).get(input) ?? 0),
			b => b.while(
				() => !getReducer(ns, "reducerT2").content.includes(input),
				produceRoutines[input] !== undefined
					? produceRoutines[input]
					: b => b.deliver(
						() => getItemSources(ns, input, storageNames),
						() => [getReducer(ns, "reducerT2")],
						[input]
					)
			)
			.deliver(
				() => [getReducer(ns, "reducerT2")],
				() => [getReducer(ns, "reducerT3")],
				[input]
			)
		)
	)
	.reduce(() => [getReducer(ns, "reducerT3")], recipe.output)
	.cleanup(builder => builder.deleteContent(() => getReducer(ns, "reducerT3")))
	.finish();

export const makeDeliverT3 = (ns: NS, item: Component, produceRoutine: Routine) => new RoutineBuilder(`deliverT3: ${item}`)
	.when(() => getAllDevices(ns, isDeviceOSocket, d => isRequestingItem(d, item)).length > 0)
	.possible(() => ns.myrian.getDevice("reducerT3") !== undefined)
	.while(() => !getReducer(ns, "reducerT3").content.includes(item), produceRoutine)
	.deliver(
		() => [getReducer(ns, "reducerT3")],
		() => getAllDevices(ns, isDeviceOSocket, d => isRequestingItem(d, item)),
		[item]
	)
	.cleanup(builder => builder.deleteContent(bus => bus()))
	.finish();