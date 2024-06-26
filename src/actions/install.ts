import { installDeviceCost } from "/costs";
import { ActionAvailable, ActionExecutable, InstallAction, routeNextTo } from "/util";

export const canDoInstall: ActionAvailable<InstallAction> = action => {
	const { devices, vulns, deviceType, position, name } = action;
	if (devices().some(d => d.name === name)) return false;
	if (devices().some(device => device.x === position.x && device.y === position.y)) return false;

	const numInstalled = devices().filter(device => device.type === deviceType).length;
	const cost = installDeviceCost(deviceType, numInstalled);
	return cost <= vulns();
}

export const executeInstall: ActionExecutable<InstallAction> = async (action, ns, bus) => {
	const { deviceType, position, name } = action;

	const routing = await routeNextTo(ns, bus, () => position);
	if (!routing) return { error: false, done: false };

	const install = await ns.myrian.installDevice(bus().name, name, [position.x, position.y], deviceType);
	if (install) return { error: false, done: true };
	return { error: true, done: false, reason: `INSTALL: FAILED TO INSTALL ${name}` };
}