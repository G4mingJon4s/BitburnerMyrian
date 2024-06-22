import { ContentReservation } from "/ContentReservation";
import { ActionAvailable, ActionExecutable, isDeviceContainer, routeNextTo, UninstallAction } from "/util";

export const canDoUninstall: ActionAvailable<UninstallAction> = (action, bus, executor, callStack) => {
	const { device, devices } = action;

	if (device(bus).isBusy) return false;
	if (!ContentReservation.isOnlyReserver(device(bus).name, executor, callStack)) return false;

	return devices().some(d => d.x === device(bus).x && d.y === device(bus).y);
}

export const executeUninstall: ActionExecutable<UninstallAction> = async (action, ns, bus, executor, callStack) => {
	const { device } = action;
	const removedDevice = device(bus);

	const content = isDeviceContainer(removedDevice) ? ContentReservation.reserveAll(removedDevice.name, removedDevice.content, removedDevice.content, executor, callStack) : [];
	if (!content) return { success: false, done: false };

	try {
		const routing = await routeNextTo(ns, bus, () => removedDevice);
		if (!routing) return { success: false, done: false };

		const uninstall = await ns.myrian.uninstallDevice(bus().name, [removedDevice.x, device(bus).y]);
		return { success: uninstall, done: uninstall };
	} finally {
		for (const item of content) ContentReservation.release(removedDevice.name, item, executor, callStack);
	}
}