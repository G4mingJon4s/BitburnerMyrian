import { ContentReservation } from "../ContentReservation";
import { ActionAvailable, ActionExecutable, inventoryFreeSpace, inventoryIncludes, nearest, routeNextTo, TransferAction } from "../util";

export const canDoTransfer: ActionAvailable<TransferAction> = (action, bus, executor, callStack) => {
	const { from, to, items } = action;
	const fromDevices = from(bus);
	const toDevices = to(bus);

	const busEnoughSpace = bus().maxContent - bus().content.length >= items.length;
	if (!busEnoughSpace) return false;

	return fromDevices.some(fromDevice => toDevices.some(toDevice => {
		const itemsAvailable = inventoryIncludes(fromDevice.content, items, ContentReservation.getUnobtainable(fromDevice.name, executor, callStack));
		if (!itemsAvailable) return false;

		const spaceAvailable = inventoryFreeSpace(toDevice.content, toDevice.maxContent, ContentReservation.getUnobtainable(toDevice.name, executor, callStack)) >= items.length;
		return spaceAvailable;
	}));
}

export const executeTransfer: ActionExecutable<TransferAction> = async (action, ns, bus, executor, callStack) => {
	const { from, to, items } = action;
	const fromDevices = from(bus);
	const toDevices = to(bus);

	const fromAvailable = fromDevices.filter(container => inventoryIncludes(container.content, items, ContentReservation.getUnobtainable(container.name, executor, callStack)));
	if (fromAvailable.length === 0) return { error: false, done: false };
	const fromDevice = nearest(fromAvailable, bus());

	const toAvailable = toDevices.filter(container => inventoryFreeSpace(container.content, container.maxContent, ContentReservation.getUnobtainable(container.name, executor, callStack)) >= items.length);
	if (toAvailable.length === 0) return { error: false, done: false };
	const toDevice = nearest(toAvailable, bus());

	const fromReserved = ContentReservation.reserveAll(fromDevice.name, fromDevice.content, items, executor, callStack);
	if (!fromReserved) return { error: false, done: false };

	const toReserved = items.map(() => ContentReservation.reserveFreeSpace(toDevice.name, toDevice.content, toDevice.maxContent, executor, callStack));
	if (toReserved.some(r => r === false)) {
		for (const item of fromReserved) ContentReservation.release(fromDevice.name, item, executor, callStack);
		for (const index of toReserved) if (index !== false) ContentReservation.release(toDevice.name, index, executor, callStack);
		return { error: false, done: false };
	}

	let success = false;
	const alreadyReleased = new Set<number>();

	try {
		const from = () => ns.myrian.getDevice(fromDevice.name)!;
		const to = () => ns.myrian.getDevice(toDevice.name)!;

		let strikes = 0;
		for (; strikes < 5; strikes++) {
			const routingToSource = await routeNextTo(ns, bus, from);
			if (!routingToSource) continue;

			const pickup = await ns.myrian.transfer(fromDevice.name, bus().name, items);
			if (pickup) break;
		}
		if (strikes >= 5) return { error: true, done: false, reason: `TRANSFER: PICKUP FAILED ${fromDevice.name} => ${bus().name}` };

		for (const item of fromReserved) {
			ContentReservation.release(fromDevice.name, item, executor, callStack);
			alreadyReleased.add(item);
		}

		strikes = 0;
		for (; strikes < 5; strikes++) {
			const routingToDestination = await routeNextTo(ns, bus, to);
			if (!routingToDestination) continue;

			const dropoff = await ns.myrian.transfer(bus().name, toDevice.name, items);
			if (dropoff) break;
		}

		success = strikes < 5;
		if (success) return { error: false, done: true };
		return { error: true, done: false, reason: `TRANSFER: DROPOFF FAILED ${bus().name} => ${toDevice.name}` };
	} finally {
		if (!success) ns.print(`ERROR: Transfer failed: ${fromDevice.name} => ${toDevice.name}`);

		for (const item of fromReserved) if (!alreadyReleased.has(item)) ContentReservation.release(fromDevice.name, item, executor, callStack);
		// toReserved is a list of indices, if any were false, we would have returned early
		for (const item of toReserved as number[]) ContentReservation.release(toDevice.name, item, executor, callStack);
	}
}