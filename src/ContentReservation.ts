import { Component } from "./types";
import { Executable, inventoryFreeSpace, inventoryIncludes } from "./util";

export class ContentReservation {
	private static items = new Map<string, Executable>();
	private static reserved = new Map<string, number[]>();

	private static key = (deviceID: string, index: number) => `${deviceID}:${index}`;

	private static addReserved(deviceID: string, index: number) {
		const alreadyReserved = ContentReservation.reserved.get(deviceID) ?? [];
		if (alreadyReserved.includes(index)) throw new Error(`ItemReservation: Item ${deviceID}:${index} is already reserved`);
		ContentReservation.reserved.set(deviceID, [...alreadyReserved, index]);
	}

	private static removeReserved(deviceID: string, index: number) {
		const reserved = ContentReservation.reserved.get(deviceID) ?? [];
		if (!reserved.includes(index)) throw new Error(`ItemReservation: Item ${deviceID}:${index} is not reserved`);
		ContentReservation.reserved.set(deviceID, reserved.filter(i => i !== index));
	}

	static reset() {
		ContentReservation.items.clear();
		ContentReservation.reserved.clear();
	}

	static reserve(deviceID: string, index: number, executable: Executable, parents?: Executable[]): boolean {
		const key = ContentReservation.key(deviceID, index);
		const alreadyReserved = ContentReservation.isReserved(deviceID, index);
		const canAccess = [executable, ...(parents ?? [])].includes(ContentReservation.items.get(key)!);
		if (alreadyReserved) return canAccess;

		ContentReservation.items.set(key, executable);
		ContentReservation.addReserved(deviceID, index);
		return true;
	}

	static release(deviceID: string, index: number, executable: Executable, parents?: Executable[]) {
		const key = ContentReservation.key(deviceID, index);
		if (!ContentReservation.isReserved(deviceID, index)) return;
		const canAccess = [executable, ...(parents ?? [])].includes(ContentReservation.items.get(key)!);
		if (!canAccess) throw new Error(`Cannot release item ${deviceID}:${index} because it is not accessible`);

		ContentReservation.items.delete(key);
		ContentReservation.removeReserved(deviceID, index);
	}

	static canAccess(deviceID: string, index: number, executable: Executable, parents?: Executable[]) {
		const key = ContentReservation.key(deviceID, index);
		if (!ContentReservation.items.has(key)) return true;
		if ([executable, ...(parents ?? [])].includes(ContentReservation.items.get(key)!)) return true;
		return false;
	}

	static isReserved(deviceID: string, index: number) {
		const key = ContentReservation.key(deviceID, index);
		return ContentReservation.items.has(key);
	}

	static getUnobtainable(deviceID: string, executable: Executable, parents?: Executable[]) {
		if (!ContentReservation.reserved.has(deviceID)) return [];
		const reserved = ContentReservation.reserved.get(deviceID)!;
		return reserved.filter(i => !ContentReservation.canAccess(deviceID, i, executable, parents));
	}

	static hasReservations(deviceID: string) {
		return ContentReservation.reserved.has(deviceID);
	}

	/** @returns All NEWLY reserved items */
	static reserveAll(deviceID: string, currentContent: Component[], items: Component[], executable: Executable, parents?: Executable[]): number[] | false {
		if (!inventoryIncludes(currentContent, items)) return false;
		const toReserve: number[] = [];

		const numNeeded: Partial<Record<string, number>> = {};
		for (const item of items) numNeeded[item] = (numNeeded[item] ?? 0) + 1;

		for (let i = 0; i < currentContent.length; i++) {
			const item = currentContent[i];
			if (numNeeded[item] === undefined) continue;
			if (numNeeded[item] > 0) {
				numNeeded[item]--;
				toReserve.push(i);
			}
		}

		const successful = toReserve.filter(item => !ContentReservation.isReserved(deviceID, item)).every(item => ContentReservation.reserve(deviceID, item, executable, parents));
		if (successful) return toReserve;

		for (const item of toReserve) {
			if (!ContentReservation.isReserved(deviceID, item)) continue;
			const hasAccess = ContentReservation.canAccess(deviceID, item, executable, parents);
			if (!hasAccess) continue;
			ContentReservation.release(deviceID, item, executable, parents);
		}

		return false;
	}

	static reserveFreeSpace(deviceID: string, currentContent: Component[], maxContent: number, executable: Executable, parents?: Executable[]): number | false {
		const available = inventoryFreeSpace(currentContent, maxContent, ContentReservation.getUnobtainable(deviceID, executable, parents));
		if (available === 0) return false;

		const success = ContentReservation.reserve(deviceID, currentContent.length, executable, parents);
		if (!success) return false;
		return currentContent.length;
	}

	static allReservers(deviceID: string): Executable[] {
		return (ContentReservation.reserved.get(deviceID) ?? []).map(i => ContentReservation.items.get(ContentReservation.key(deviceID, i))!);
	}

	static isOnlyReserver(deviceID: string, executable: Executable, parents?: Executable[]) {
		const allReservers = ContentReservation.allReservers(deviceID);
		if (allReservers.length > 1) return false;
		if (allReservers.length !== 0 && ![...(parents ?? []), executable].includes(allReservers[0])) return false;
		return true;
	}
}