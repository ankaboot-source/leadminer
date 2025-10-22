export function removeQueryParam(param: string) {
	const $route = useRoute();
	const newQuery = { ...$route.query };
	// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
	delete newQuery[param];
	navigateTo({ path: $route.path, query: newQuery }, { replace: true });
}

export function getParam(param: string) {
	const $route = useRoute();
	const value = $route.query[param];
	if (value === null) return true; // undefined means param not present
	return value;
}
