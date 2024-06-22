import { ContentReservation } from "/ContentReservation";
import { ActionAvailable, ActionExecutable, DeleteContentAction, routeNextTo } from "/util";

export const canDoDeleteContent: ActionAvailable<DeleteContentAction> = (action, bus, executor, callStack) => {
	const { device } = action;
	return ContentReservation.isOnlyReserver(device(bus).name, executor, callStack);
}

export const executeDeleteContent: ActionExecutable<DeleteContentAction> = async (action, ns, bus, executor, callStack) => {
	const { device } = action;
	const deletedContentDevice = device(bus);

	const items = ContentReservation.reserveAll(deletedContentDevice.name, deletedContentDevice.content, deletedContentDevice.content, executor, callStack);
	if (!items) return { success: false, done: false };

	try {
		const routing = await routeNextTo(ns, bus, () => deletedContentDevice);
		if (!routing) return { success: false, done: false };

		const result = ns.myrian.trashInventory(deletedContentDevice.name);
		return { success: result, done: result };
	} finally {
		for (const item of items) ContentReservation.release(device(bus).name, item, executor, callStack);
	}
}