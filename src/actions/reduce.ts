import { ContentReservation } from "/ContentReservation";
import { recipes } from "/recipes";
import { ActionAvailable, ActionExecutable, inventoryIncludes, nearest, ReduceAction, routeNextTo, tierOfRecipe } from "/util";

export const canDoReduce: ActionAvailable<ReduceAction> = (action, bus, executor, callStack) => {
	const { device, item } = action;
	return device(bus).some(reducer => {
		const recipeWanted = recipes[reducer.tier].find(recipe => recipe.output === item);
		if (recipeWanted === undefined) return false;
		if (reducer.isBusy) return false;

		return inventoryIncludes(reducer.content, recipeWanted.input, ContentReservation.getUnobtainable(reducer.name, executor, callStack));
	});
}

export const executeReduce: ActionExecutable<ReduceAction> = async (action, ns, bus, executor, callStack) => {
	const { device, item } = action;
	
	const recipeWanted = recipes.flat().find(recipe => recipe.output === item);
	if (recipeWanted === undefined) return { success: false, done: false };
	const recipeTier = tierOfRecipe(recipeWanted);

	const reducers = device(bus);
	const available = reducers.filter(reducer => reducer.tier === recipeTier && inventoryIncludes(reducer.content, recipeWanted.input, ContentReservation.getUnobtainable(reducer.name, executor, callStack)));
	if (available.length === 0) return { success: false, done: false };
	const reducer = nearest(available, bus());

	const recipeReserved = ContentReservation.reserveAll(reducer.name, reducer.content, recipeWanted.input, executor, callStack);
	if (!recipeReserved) return { success: false, done: false };

	try {
		const routing = await routeNextTo(ns, bus, () => reducer);
		if (!routing) return { success: false, done: false };

		const reduce = await ns.myrian.reduce(bus().name, reducer.name);
		return { success: reduce, done: reduce };
	} finally {
		for (const item of recipeReserved) ContentReservation.release(reducer.name, item, executor, callStack);
	}
}