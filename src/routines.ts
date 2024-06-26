import { NS } from "@ns";
import { Component, DeviceType, Glitch, Recipe } from "./types";
import { countUp, getAllDevices, getBattery, getCache, getItemSources, getReducer, isDeviceISocket, isDeviceLock, isDeviceOSocket, isRequestingItem, tierOfComponent } from "./util";
import { RoutineBuilder } from "./RoutineBuilder";
import { Routine } from "./Routine";

export const storages = {
	"storageA": { x: 4, y: 2 },
	"storageB": { x: 7, y: 2 },
} as const;
export const storageNames = Array.from(Object.keys(storages));
export const totalStorageSize = (ns: NS) => storageNames.filter(storage => ns.myrian.getDevice(storage) !== undefined).reduce((sum, name) => sum + getCache(ns, name).maxContent, 0);
export const numStored = (ns: NS, item: Component) => storageNames.filter(storage => ns.myrian.getDevice(storage) !== undefined).reduce((sum, name) => sum + getCache(ns, name).content.filter(c => c === item).length, 0);

export const reducers = {
	"reducerT1": { x: 4, y: 5, tier: 1 },
	"reducerT2": { x: 7, y: 5, tier: 2 },
	"reducerT3": { x: 4, y: 8, tier: 3 },
} as const;
export const reducerNames = Array.from(Object.keys(reducers));
export const reducerOfItem = (item: Component) => Object.entries(reducers).find(reducer => reducer[1].tier === tierOfComponent(item))?.[0];

export const makeAll = <T extends string>(items: IterableIterator<T>, routine: (item: T) => Routine): Partial<Record<T, Routine>> => {
	const result: Partial<Record<T, Routine>> = {};
	for (const item of items) result[item] = routine(item);
	return result;
}

export const makeSetup = (ns: NS) => new RoutineBuilder("setup")
	.while(() => ns.myrian.getDevice("reducerT1") === undefined, builder => builder.install(
		ns.myrian.getVulns,
		ns.myrian.getDevices,
		"reducerT1",
		DeviceType.Reducer,
		reducers["reducerT1"]
	))
	.custom(() => ns.myrian.getDevice("reducerT1") !== undefined, async () => await ns.myrian.setGlitchLvl(Glitch.Encryption, 1))
	.while(() => ns.myrian.getDevice("bob") === undefined, builder => builder.install(
		ns.myrian.getVulns,
		ns.myrian.getDevices,
		"bob",
		DeviceType.Bus,
		{ x: 6, y: 9 }
	))
	.while(() => ns.myrian.getDevice("batteryA") === undefined, builder => builder.install(
		ns.myrian.getVulns,
		ns.myrian.getDevices,
		"batteryA",
		DeviceType.Battery,
		{ x: 6, y: 6 }
	))
	.custom(() => ns.myrian.getDevice("batteryA") !== undefined, async () => await ns.myrian.setGlitchLvl(Glitch.Magnetism, 1))
	.each(Object.entries(storages).values(), storage => builder => builder.install(
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
		reducers["reducerT2"]
	))
	.while(() => getReducer(ns, "reducerT2").tier < reducers["reducerT2"].tier, builder => builder.custom(
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
		reducers["reducerT3"]
	))
	.while(() => getReducer(ns, "reducerT3").tier < reducers["reducerT3"].tier, builder => builder.custom(
		() => ns.myrian.getDevice("reducerT3") !== undefined && ns.myrian.getUpgradeTierCost("reducerT3") <= ns.myrian.getVulns(),
		async () => void ns.myrian.upgradeTier("reducerT3")
	))
	.while(() => getReducer(ns, "reducerT3").maxContent < 3, builder => builder.custom(
		() => ns.myrian.getDevice("reducerT3") !== undefined && ns.myrian.getUpgradeMaxContentCost("reducerT3") <= ns.myrian.getVulns(),
		async () => void ns.myrian.upgradeMaxContent("reducerT3")
	))
	.custom(() => ns.myrian.getDevice("reducerT3") !== undefined, async () => await ns.myrian.setGlitchLvl(Glitch.Encryption, 3))
	// .custom(() => ns.myrian.getGlitchLvl(Glitch.Virtualization) < 3, async () => await ns.myrian.setGlitchLvl(Glitch.Virtualization, 3))
	.finish();

export const makeStoreT0 = (ns: NS, item: Component) => new RoutineBuilder(`storeT0: ${item}`)
	.when(
		() => getAllDevices(ns, isDeviceISocket, d => d.content.includes(item)).length > 0 && 
		numStored(ns, item) < totalStorageSize(ns) / 3
	)
	.possible(() => storageNames.some(storage => ns.myrian.getDevice(storage) !== undefined))
	.deliver(
		() => getAllDevices(ns, isDeviceISocket, d => d.content.includes(item)),
		() => storageNames.filter(storage => ns.myrian.getDevice(storage) !== undefined).map(storage => getCache(ns, storage)),
		[item]
	)
	.cleanup(builder => builder.deleteContent(bus => bus()))
	.finish();

export const makeCharge = (ns: NS) => new RoutineBuilder("charge")
	.when(bus => bus().energy < bus().maxEnergy * (2 / 3))
	.possible(() => ns.myrian.getDevice("batteryA") !== undefined)
	.energize(() => [getBattery(ns, "batteryA")])
	.finish();

export function makeRemoveLocks(ns: NS) {
	const segmentationLocks = () => getAllDevices(ns, isDeviceLock, d => {
		const match = d.name.match(/^lock-(\d+)-(\d+)$/);
		if (match === null) return false;
		return (Number.parseInt(match[1]) === d.x && Number.parseInt(match[2]) === d.y);
	});
	return new RoutineBuilder("removeLocks")
		.when(() => segmentationLocks().length > 0)
		.while(
			() => segmentationLocks().length > 0,
			builder => builder.uninstall(
				() => segmentationLocks(),
				ns.myrian.getDevices
			)
		)
		.finish();
}

export const makeUpgrade = (ns: NS) => new RoutineBuilder("upgrade")
	.startPossible(() => ns.myrian.getGlitchLvl(Glitch.Magnetism) > 0) // Start upgrading once batteries and magnetism is set up
	.while(bus => bus().maxEnergy < 24, builder => builder.possible(() => ns.myrian.getGlitchLvl(Glitch.Magnetism) > 0).custom(
		bus => ns.myrian.getUpgradeMaxEnergyCost(bus().name) <= ns.myrian.getVulns(),
		async bus => void ns.myrian.upgradeMaxEnergy(bus().name)
	))
	.custom(() => ns.myrian.getDevice("batteryA") !== undefined && getBattery(ns, "batteryA").tier < 2 && ns.myrian.getUpgradeTierCost("batteryA") < ns.myrian.getVulns(), async () => void ns.myrian.upgradeTier("batteryA"))
	.while(bus => bus().reduceLvl < 5, builder => builder.custom(
		bus => ns.myrian.getUpgradeReduceLvlCost(bus().name) <= ns.myrian.getVulns(),
		async bus => void ns.myrian.upgradeReduceLvl(bus().name)
	))
	.each(storageNames.values(), storage => builder => builder.possible(() => ns.myrian.getDevice(storage) !== undefined).while(
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

export function makeProduce(ns: NS, recipe: Recipe, produceRoutines: Partial<Record<Component, Routine>>) {
	const reducer = reducerOfItem(recipe.output);
	if (reducer === undefined) throw new Error(`No reducer for ${recipe.output}`);

	return new RoutineBuilder(`produce: ${recipe.output}`)
		.possible(() => ns.myrian.getDevice(reducer) !== undefined)
		.startPossible(() => getReducer(ns, reducer).content.length === 0)
		.reserve(() => [{ deviceID: reducer, index: 0 }, { deviceID: reducer, index: 1 }, { deviceID: reducer, index: 2 }])
		.each(
			countUp(recipe.input).entries(),
			([item, count]) => builder => {
				const subReducer = reducerOfItem(item);
				return builder.while(
					() => count > (countUp(getReducer(ns, reducer).content).get(item) ?? 0),
					b => {
						if ([Component.R0, Component.G0, Component.B0].includes(item)) return b.deliver(
							() => getItemSources(ns, item, storageNames),
							() => [getReducer(ns, reducer)],
							[item]
						);
						return b.while(
							() => !getReducer(ns, subReducer!).content.includes(item),
							produceRoutines[item]!
						).deliver(
							() => [getReducer(ns, subReducer!)],
							() => [getReducer(ns, reducer)],
							[item]
						)
					}
				).cleanup(b => b.deleteContent(bus => bus()));
			}
		)
		.reduce(() => [getReducer(ns, reducer)], recipe.output)
		.cleanup(builder => builder.deleteContent(() => getReducer(ns, reducer)))
		.finish();
}

export function makeDeliver(ns: NS, recipe: Recipe, produceRoutines: Partial<Record<Component, Routine>>) {
	const reducer = reducerOfItem(recipe.output);
	if (reducer === undefined) throw new Error(`No reducer for ${recipe.output}`);
	const routine = produceRoutines[recipe.output];
	if (routine === undefined) throw new Error(`No routine for ${recipe.output}`);

	return new RoutineBuilder(`deliver: ${recipe.output}`)
		.when(() => getAllDevices(ns, isDeviceOSocket, d => isRequestingItem(d, recipe.output)).length > 0)
		.possible(() => ns.myrian.getDevice(reducer) !== undefined)
		.startPossible(() => getReducer(ns, reducer).content.length === 0)
		.while(() => !getReducer(ns, reducer).content.includes(recipe.output), routine)
		.deliver(
			() => [getReducer(ns, reducer)],
			() => getAllDevices(ns, isDeviceOSocket, d => isRequestingItem(d, recipe.output)),
			[recipe.output]
		)
		.cleanup(builder => builder.deleteContent(() => getReducer(ns, reducer)))
		.finish();
}