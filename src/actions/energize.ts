import { ActionAvailable, ActionExecutable, EnergizeAction, nearest, routeNextTo } from "/util";

export const canDoEnergize: ActionAvailable<EnergizeAction> = (action, bus) => {
	const { device } = action;

	const busCanCharge = bus().energy < bus().maxEnergy;
	if (!busCanCharge) return false;

	return device(bus).some(battery => battery.energy > 0 && !battery.isBusy);
}

export const executeEnergize: ActionExecutable<EnergizeAction> = async (action, ns, bus) => {
	const { device } = action;
	const batteries = device(bus);
	const available = batteries.filter(battery => battery.energy > 0);
	if (available.length === 0) return { error: false, done: false };
	const battery = nearest(available, bus());

	const routing = await routeNextTo(ns, bus, () => battery);
	if (!routing) return { error: true, done: false, reason: `ENERGIZE: FAILED TO ROUTE TO ${battery.name}` };

	const energize = await ns.myrian.energize(bus().name, battery.name);
	if (energize !== -1) return { error: false, done: true };
	return { error: true, done: false, reason: `ENERGIZE: FAILED TO ENERGIZE ${bus().name}` };
}