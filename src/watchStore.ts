export const watch = new Map<string, Set<string>>(); // guildId -> set of codes
export function addCode(guildId: string, code: string) {
    const set = watch.get(guildId) ?? new Set<string>();
    set.add(code.toUpperCase());
    watch.set(guildId, set);
}
export function removeCode(guildId: string, code: string) {
    watch.get(guildId)?.delete(code.toUpperCase());
}
export function listCodes(guildId: string) {
    return Array.from(watch.get(guildId) ?? []);
}

