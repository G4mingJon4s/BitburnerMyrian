import { ContentReservation } from "/ContentReservation";
import { ActionAvailable, ActionExecutable, routeNextTo, TweakAction } from "/util";

export const canDoTweak: ActionAvailable<TweakAction> = (action, bus,executor, callStack) => {
	const { device, item } = action;

	if (!ContentReservation.isOnlyReserver(device(bus).name, executor, callStack)) return false;

	return device(bus).emitting !== item;
}

export const executeTweak: ActionExecutable<TweakAction> = async (action, ns, bus, executor, callStack) => {
	const { device, item } = action;
	const isocket = device(bus);

	const items = ContentReservation.reserveAll(isocket.name, isocket.content, isocket.content, executor, callStack);
	if (!items) return { error: false, done: false };

	try {
		const routing = await routeNextTo(ns, bus, () => isocket);
		if (!routing) return { error: false, done: false };

		const tweak = await ns.myrian.tweakISocket(bus().name, isocket.name, item);
		if (tweak) return { error: false, done: true };
		return { error: true, done: false, reason: `TWEAK: FAILED TO TWEAK ${isocket.name}` };
	} finally {
		for (const item of items) ContentReservation.release(isocket.name, item, executor, callStack);
	}
}