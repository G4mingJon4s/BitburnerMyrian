import { ContentReservation } from "/ContentReservation";
import { ActionAvailable, ActionExecutable, DeleteContentAction } from "/util";

export const canDoDeleteContent: ActionAvailable<DeleteContentAction> = (action, bus, executor, callStack) => {
	const { device } = action;
	return ContentReservation.isOnlyReserver(device(bus).name, executor, callStack);
}

export const executeDeleteContent: ActionExecutable<DeleteContentAction> = async (action, ns, bus, executor, callStack) => {
	const { device } = action;
	const deletedContentDevice = device(bus);

	const items = ContentReservation.reserveAll(deletedContentDevice.name, deletedContentDevice.content, deletedContentDevice.content, executor, callStack);
	if (!items) return { error: false, done: false };

	try {
		const result = ns.myrian.formatContent(deletedContentDevice.name);
		if (result) return { error: false, done: true };
		return { error: true, done: false, reason: `DELETE: FAILED TO DELETE CONTENT OF ${deletedContentDevice.name}` };
	} finally {
		for (const item of items) ContentReservation.release(device(bus).name, item, executor, callStack);
	}
}