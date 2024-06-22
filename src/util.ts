import { NS } from "@ns";
import { BaseDevice, Battery, Bus, Component, ContainerDevice, Device, DeviceType, EnergyDevice, ISocket, OSocket, Reducer, TieredDevice, Lock, NCache, DeviceID, Recipe } from "./types";
import { recipes } from "./recipes";

export type Point = {
	x: number;
	y: number;
}

export interface Node {
	device: () => ContainerDevice;
	totalItems: Partial<Record<Component, number>>;
	currentItems: () => Partial<Record<Component, number>>;
}

export interface Executable {
	possible(bus: () => Bus, callStack: Executable[]): boolean;
	execute(ns: NS, bus: () => Bus, callStack: Executable[]): Promise<{ success: boolean, done: boolean }>;
}

// Delivers all "items" from "from" to "to"
export interface TransferAction {
	type: "transfer";
	from: (bus: () => Bus) => ContainerDevice[];
	to: (bus: () => Bus) => ContainerDevice[];
	items: Component[];
}

// Reduces the contents of the reducer to the given item
export interface ReduceAction {
	type: "reduce";
	item: Component;
	device: (bus: () => Bus) => Reducer[];
}

// Installs a new device
export interface InstallAction {
	type: "install";
	devices: () => Device[];
	vulns: () => number;
	deviceType: DeviceType;
	position: Point;
	name: string;
}

// Uninstalls a device
export interface UninstallAction {
	type: "uninstall";
	device: (bus: () => Bus) => Device;
	devices: () => Device[];
}

// Charges the bus doing the action
export interface EnergizeAction {
	type: "energize";
	device: (bus: () => Bus) => Battery[];
}

// Changes the emitting item of the isocket
export interface TweakAction {
	type: "tweak";
	device: (bus: () => Bus) => ISocket;
	item: Component;
}

// Deletes all contents of the device
export interface DeleteContentAction {
	type: "delete";
	device: (bus: () => Bus) => ContainerDevice;
}

export type Action = TransferAction | ReduceAction | InstallAction | UninstallAction | EnergizeAction | TweakAction | DeleteContentAction;
export type ActionAvailable<T extends Action> = (action: T, bus: () => Bus, executor: Executable, callStack: Executable[]) => boolean;
export type ActionExecutable<T extends Action> = (action: T, ns: NS, bus: () => Bus, executor: Executable, callStack: Executable[]) => Promise<{ success: boolean, done: boolean }>;

export const isDeviceContainer = (device: BaseDevice): device is ContainerDevice => "content" in device;
export const isDeviceBus = (d: Device): d is Bus => d.type === DeviceType.Bus;
export const isDeviceISocket = (d: Device): d is ISocket => d.type === DeviceType.ISocket;
export const isDeviceOSocket = (d: Device): d is OSocket => d.type === DeviceType.OSocket;
export const isDeviceReducer = (d: Device): d is Reducer => d.type === DeviceType.Reducer;
export const isDeviceCache = (d: Device): d is NCache => d.type === DeviceType.Cache;
export const isDeviceLock = (d: Device): d is Lock => d.type === DeviceType.Lock;
export const isDeviceBattery = (d: Device): d is Battery => d.type === DeviceType.Battery;

export const isTieredDevice = (d: BaseDevice): d is TieredDevice => "tier" in d;
export const isEmittingDevice = (d: BaseDevice): d is BaseDevice & { emissionLvl: number } => "emissionLvl" in d;
export const isMovingDevice = (d: BaseDevice): d is BaseDevice & { moveLvl: number } => "moveLvl" in d;
export const isTransferingDevice = (d: BaseDevice): d is BaseDevice & { transferLvl: number } => "transferLvl" in d;
export const isReducingDevice = (d: BaseDevice): d is BaseDevice & { reduceLvl: number } => "reduceLvl" in d;
export const isInstallingDevice = (d: BaseDevice): d is BaseDevice & { installLvl: number } => "installLvl" in d;
export const isEnergyDevice = (d: BaseDevice): d is EnergyDevice => "maxEnergy" in d;

export const inventoryIncludes = (inventory: Component[], items: Component[], reserved: number[] = []) => {
	const available: Partial<Record<Component, number>> = {};
	for (let i = 0; i < inventory.length; i++) if (!reserved.includes(i)) available[inventory[i]] = (available[inventory[i]] ?? 0) + 1;

	const wanted: Partial<Record<Component, number>> = {};
	for (const item of items) wanted[item] = (wanted[item] ?? 0) + 1;
	
	return items.every(item => wanted[item]! <= (available[item] ?? 0));
};

export const inventoryFreeSpace = (inventory: Component[], maxContent: number, reserved: number[] = []) => {
	const reservedFreeSpace = reserved.filter(i => inventory[i] === undefined).length;
	return maxContent - (reservedFreeSpace + inventory.length);
};

export const countUp = <T>(array: T[]): Map<T, number> => {
	const map = new Map<T, number>();
	for (const item of array) map.set(item, (map.get(item) ?? 0) + 1);
	return map;
}

export const nearest = <T extends Point>(positions: T[], from: Point): T => positions.reduce((best, current) => distance(from, best) > distance(from, current) ? current : best);

/** Depends on all recipes being taken from the global recipes array, no newly created recipes will work */
export const tierOfRecipe = (recipe: Recipe): number => recipes.findIndex(tier => tier.includes(recipe));

export const getAllDevices = <T extends Device>(
	ns: NS,
	typeCheck: (d: Device) => d is T,
	condition: (d: T) => boolean
): T[] => {
	return (ns.myrian.getDevices().filter(d => typeCheck(d)) as T[]).filter(d => condition(d));
}

export const getNearestDevice = <T extends Device>(
	ns: NS,
	position: Point,
	typeCheck: (d: Device) => d is T,
	condition: (d: T) => boolean,
): T | null => {
	const devices = getAllDevices(ns, typeCheck, condition);
	if (devices.length === 0) return null;
	return nearest(devices, position);
}

export const assert = <T>(value: T | null, desc?: string): T => {
	if (value === null) throw new Error(desc ?? "Unknown assertion failed");
	return value;
}

export const getContainer = (ns: NS, id: DeviceID): ContainerDevice => {
	const container = ns.myrian.getDevice(id);
	if (container === undefined || !isDeviceContainer(container)) throw new Error(`No such container: ${id}`);
	return container;
};

export const getBus = (ns: NS, id: DeviceID): Bus => {
	const bus = ns.myrian.getDevice(id);
	if (bus === undefined || !isDeviceBus(bus)) throw new Error(`No such bus: ${id}`);
	return bus;
};

export const getISocket = (ns: NS, id: DeviceID): ISocket => {
	const isocket = ns.myrian.getDevice(id);
	if (isocket === undefined || !isDeviceISocket(isocket)) throw new Error(`No such isocket: ${id}`);
	return isocket;
};

export const getOSocket = (ns: NS, id: DeviceID): OSocket => {
	const osocket = ns.myrian.getDevice(id);
	if (osocket === undefined || !isDeviceOSocket(osocket)) throw new Error(`No such osocket: ${id}`);
	return osocket;
};

export const getReducer = (ns: NS, id: DeviceID): Reducer => {
	const reducer = ns.myrian.getDevice(id);
	if (reducer === undefined || !isDeviceReducer(reducer)) throw new Error(`No such reducer: ${id}`);
	return reducer;
};

export const getCache = (ns: NS, id: DeviceID): NCache => {
	const cache = ns.myrian.getDevice(id);
	if (cache === undefined || !isDeviceCache(cache)) throw new Error(`No such cache: ${id}`);
	return cache;
};

export const getLock = (ns: NS, id: DeviceID): Lock => {
	const lock = ns.myrian.getDevice(id);
	if (lock === undefined || !isDeviceLock(lock)) throw new Error(`No such lock: ${id}`);
	return lock;
};

export const getBattery = (ns: NS, id: DeviceID): Battery => {
	const battery = ns.myrian.getDevice(id);
	if (battery === undefined || !isDeviceBattery(battery)) throw new Error(`No such battery: ${id}`);
	return battery;
};

export function pathfind(from: Point, to: Point, obstacles: Point[], size = 12): Point[] | null {
	const hash = (point: Point) => `${point.x},${point.y}`;
	const seen = new Set<string>();

	type PointNode = { point: Point, parent: PointNode | null };
	const queue: PointNode[] = [{ point: from, parent: null }];

	const path = (node: PointNode): Point[] => node.parent === null ? [] : [...path(node.parent), node.point];

	while (queue.length > 0) {
		const node = queue.shift()!;
		if (seen.has(hash(node.point))) continue;
		if (node.point.x === to.x && node.point.y === to.y) return path(node);
		seen.add(hash(node.point));

		const neighbors: Point[] = [
			{ x: node.point.x - 1, y: node.point.y },
			{ x: node.point.x + 1, y: node.point.y },
			{ x: node.point.x, y: node.point.y - 1 },
			{ x: node.point.x, y: node.point.y + 1 },
		].filter(point =>
			point.x >= 0 &&
			point.x < size &&
			point.y >= 0 &&
			point.y < size &&
			!seen.has(hash(point)) &&
			!obstacles.some(obstacle => obstacle.x === point.x && obstacle.y === point.y)
		);
		for (const neighbor of neighbors) queue.push({ point: neighbor, parent: node });
	}

	return null;
}

export async function routeTo(ns: NS, bus: () => Bus, destination: Point, maxTries = 25): Promise<boolean> {
	const getHash = () => hashOS(ns.myrian.getDevices().filter(device => device.name !== bus().name));
	const getPath = () => pathfind(bus(), destination, ns.myrian.getDevices().filter(device => device.name !== bus().name));

	let strikes = 0;
	while (strikes < maxTries) {
		let hash = getHash();
		let path = getPath();

		while (path !== null && path.length > 0) {
			if (getHash() !== hash) {
				hash = getHash();
				path = getPath();
				continue;
			}

			const move = path.shift()!;
			const result = await ns.myrian.moveBus(bus().name, [move.x, move.y]);
			if (!result) break;
		}
		if (bus().x === destination.x && bus().y === destination.y) return true;
		strikes++;
	}

	ns.print(`ERROR: Could not route bus to (${destination.x.toString().padStart(2, "0")} | ${destination.y.toString().padStart(2, "0")}) within ${maxTries} tries`);
	return false;
}

export async function routeNextTo(ns: NS, bus: () => Bus, device: () => Point, maxTries = 25): Promise<boolean> {
	const getHash = () => hashOS(ns.myrian.getDevices().filter(device => device.name !== bus().name));
	const getNeighbor = () => nearestNeighbor(bus(), device(), ns.myrian.getDevices().filter(d => d.name !== bus().name));
	const getPath = () => {
		const neighbor = getNeighbor();
		if (neighbor === null) return null;
		return pathfind(bus(), neighbor, ns.myrian.getDevices().filter(device => device.name !== bus().name), maxTries);
	}

	let strikes = 0;
	while (strikes < maxTries) {
		let hash = getHash();
		let path = getPath();

		while (path !== null && path.length > 0) {
			if (getHash() !== hash) {
				hash = getHash();
				path = getPath();
				continue;
			}

			const move = path.shift()!;
			const result = await ns.myrian.moveBus(bus().name, [move.x, move.y]);
			if (!result) break;
		}
		if (isNeighbor(bus(), device())) return true;
		strikes++;
	}

	ns.print(`ERROR: Could not route bus next to (${device().x.toString().padStart(2, "0")} | ${device().y.toString().padStart(2, "0")}) within ${maxTries} tries`);
	return false;
}

export const distance = (from: Point, to: Point): number => Math.abs(from.x - to.x) + Math.abs(from.y - to.y);

export const nearestNeighbor = (position: Point, point: Point, obstacles: Point[], size = 12): Point | null => [
	{ x: point.x - 1, y: point.y },
	{ x: point.x + 1, y: point.y },
	{ x: point.x, y: point.y - 1 },
	{ x: point.x, y: point.y + 1 },
].filter(point =>
	point.x >= 0 &&
	point.x < size &&
	point.y >= 0 &&
	point.y < size &&
	!obstacles.some(obstacle => obstacle.x === point.x && obstacle.y === point.y)
).reduce<Point | null>((best, current) =>
	best === null
	? current
	: distance(position, best) > distance(position, current)
		? current
		: best
, null);

export const isNeighbor = (position: Point, point: Point): boolean => distance(position, point) <= 1;

export const isRequestingItem = (device: OSocket, item: Component): boolean => {
	const amountStored = countUp(device.content).get(item) ?? 0;
	const amountRequested = countUp(device.currentRequest).get(item) ?? 0;

	return amountStored < amountRequested;
};

export const hashOS = (os: Point[]): number => os.reduce((hash, point) => {
	for (let bit = 0; bit < 8; bit++) {
		const inputBit = (((point.x & 0xF) << 4) | (point.y & 0xF)) >> bit & 1;
		hash = ((hash << 1) | inputBit) ^ (0x80020003 * (inputBit ^ (hash >>> 31))) >>> 0;
	}
	return hash;
},0xAAAAAAAA);