import { ContentReservation } from "../ContentReservation";
import { ActionAvailable, ActionExecutable, inventoryFreeSpace, inventoryIncludes, nearest, routeNextTo, TransferAction } from "../util";

export const canDoTransfer: ActionAvailable<TransferAction> = (action, bus, executor, callStack) => {
	const { from, to, items } = action;
	const fromDevices = from(bus);
	const toDevices = to(bus);

	const busEnoughSpace = bus().maxContent - bus().content.length >= items.length;
	if (!busEnoughSpace) return false;

	return fromDevices.some(fromDevice => toDevices.some(toDevice => {
		const toEnoughSpace = toDevice.maxContent - toDevice.content.length >= items.length;
		if (!toEnoughSpace) return false;

		return inventoryIncludes(fromDevice.content, items, ContentReservation.getUnobtainable(fromDevice.name, executor, callStack));
	}));
}

export const executeTransfer: ActionExecutable<TransferAction> = async (action, ns, bus, executor, callStack) => {
	const { from, to, items } = action;
	const fromDevices = from(bus);
	const toDevices = to(bus);

	const fromAvailable = fromDevices.filter(container => inventoryIncludes(container.content, items, ContentReservation.getUnobtainable(container.name, executor, callStack)));
	if (fromAvailable.length === 0) return { success: false, done: false };
	const fromDevice = nearest(fromAvailable, bus());

	const toAvailable = toDevices.filter(container => inventoryFreeSpace(container.content, container.maxContent, ContentReservation.getUnobtainable(container.name, executor, callStack)) >= items.length);
	if (toAvailable.length === 0) return { success: false, done: false };
	const toDevice = nearest(toAvailable, bus());

	const fromReserved = ContentReservation.reserveAll(fromDevice.name, fromDevice.content, items, executor, callStack);
	if (!fromReserved) return { success: false, done: false };

	const toReserved = items.map(() => ContentReservation.reserveFreeSpace(toDevice.name, toDevice.content, toDevice.maxContent, executor, callStack));
	if (toReserved.some(r => r === false)) {
		for (const item of fromReserved) ContentReservation.release(fromDevice.name, item, executor, callStack);
		for (const index of toReserved) if (index !== false) ContentReservation.release(toDevice.name, index, executor, callStack);
		return { success: false, done: false };
	}

	let success = false;

	try {
		const routingToSource = await routeNextTo(ns, bus, () => fromDevice);
		if (!routingToSource) return { success: false, done: false };

		const pickup = await ns.myrian.transfer(fromDevice.name, bus().name, items);
		if (!pickup) return { success: false, done: false };

		for (const item of fromReserved) ContentReservation.release(fromDevice.name, item, executor, callStack);

		const routingToDestination = await routeNextTo(ns, bus, () => toDevice);
		if (!routingToDestination) return { success: false, done: false };

		success = true;

		const dropoff = await ns.myrian.transfer(bus().name, toDevice.name, items);
		return { success: dropoff, done: dropoff };
	} finally {
		if (!success) ns.print(`ERROR: Transfer failed: ${fromDevice.name} => ${toDevice.name}`);

		for (const item of fromReserved) ContentReservation.release(fromDevice.name, item, executor, callStack);
		// toReserved is a list of indices, if any were false, we would have returned early
		for (const item of toReserved as number[]) ContentReservation.release(toDevice.name, item, executor, callStack);
	}
}