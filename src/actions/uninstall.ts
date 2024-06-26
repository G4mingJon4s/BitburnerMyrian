import { ContentReservation } from "/ContentReservation";
import { ActionAvailable, ActionExecutable, isDeviceContainer, nearest, routeNextTo, UninstallAction } from "/util";

export const canDoUninstall: ActionAvailable<UninstallAction> = (action, bus, executor, callStack) => {
	const { device, devices } = action;

	return device(bus).some(d => {
		if (d.isBusy) return false;
		if (!ContentReservation.isOnlyReserver(d.name, executor, callStack)) return false;

		return devices().some(d => d.x === d.x && d.y === d.y);
	});
}

export const executeUninstall: ActionExecutable<UninstallAction> = async (action, ns, bus, executor, callStack) => {
	const { device } = action;
	const removedDevice = nearest(device(bus), bus());

	const content = isDeviceContainer(removedDevice) ? ContentReservation.reserveAll(removedDevice.name, removedDevice.content, removedDevice.content, executor, callStack) : [];
	if (!content) return { error: false, done: false };

	try {
		const routing = await routeNextTo(ns, bus, () => removedDevice);
		if (!routing) return { error: true, done: false, reason: `UNINSTALL: FAILED TO ROUTE TO ${removedDevice.name}` };

		const uninstall = await ns.myrian.uninstallDevice(bus().name, [removedDevice.x, removedDevice.y]);
		if (uninstall) return { error: false, done: true };
		return { error: true, done: false, reason: `UNINSTALL: FAILED TO UNINSTALL ${removedDevice.name}` };
	} finally {
		for (const item of content) ContentReservation.release(removedDevice.name, item, executor, callStack);
	}
}