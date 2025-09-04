// watchlist.ts
import * as fs from 'fs';
import * as path from 'path';

// Define the structure of our watch list data
interface WatchList {
    players: string[];  // Array of player codes like "ABCD#123"
}

// Path to the data directory and file
const DATA_DIR = "/data"; // Use the disk mount path from Render
const WATCHLIST_PATH = path.join(DATA_DIR, "watchlist.json");

// Initialize the data directory and file if they don't exist
function initializeStorage(): void {
    // Create data directory if it doesn't exist
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        console.log(`[Watchlist] Created data directory at ${DATA_DIR}`);
    }

    // Create watchlist file with empty array if it doesn't exist
    if (!fs.existsSync(WATCHLIST_PATH)) {
        const initialData: WatchList = { players: [] };
        fs.writeFileSync(WATCHLIST_PATH, JSON.stringify(initialData, null, 2));
        console.log(`[Watchlist] Created empty watchlist file at ${WATCHLIST_PATH}`);
    }
}

// Load the watch list from file
function getWatchList(): WatchList {
    try {
        initializeStorage();
        const data = fs.readFileSync(WATCHLIST_PATH, 'utf-8');
        return JSON.parse(data) as WatchList;
    } catch (error) {
        console.error('[Watchlist] Error reading watch list:', error);
        return { players: [] };
    }
}

// Save the watch list to file
function saveWatchList(watchList: WatchList): void {
    try {
        fs.writeFileSync(WATCHLIST_PATH, JSON.stringify(watchList, null, 2));
        console.log(`[Watchlist] Successfully saved watchlist with ${watchList.players.length} player(s)`);
    } catch (error) {
        console.error('[Watchlist] Error saving watch list:', error);
    }
}

// Add a player code to the watch list
export function addToWatchList(code: string): boolean {
    console.log(`[Watchlist] Attempting to add player code: ${code}`);
    const watchList = getWatchList();
    // Check if code already exists
    if (watchList.players.includes(code)) {
        console.log(`[Watchlist] Player code ${code} already exists in watchlist`);
        return false;
    }

    // Add code and save
    watchList.players.push(code);
    saveWatchList(watchList);
    console.log(`[Watchlist] Successfully added player code: ${code}`);
    return true;
}

// Remove a player code from the watch list
export function removeFromWatchList(code: string): boolean {
    console.log(`[Watchlist] Attempting to remove player code: ${code}`);
    const watchList = getWatchList();
    const initialLength = watchList.players.length;

    // Filter out the code
    watchList.players = watchList.players.filter(player => player !== code);

    // Check if anything was removed
    if (watchList.players.length === initialLength) {
        console.log(`[Watchlist] Player code ${code} not found in watchlist`);
        return false;
    }

    saveWatchList(watchList);
    console.log(`[Watchlist] Successfully removed player code: ${code}`);
    return true;
}

// List all player codes in the watch list
export function listWatchList(): string[] {
    const players = getWatchList().players;
    console.log(`[Watchlist] Retrieved watchlist with ${players.length} player(s)`);
    return players;
}

// Initialize storage on module import
initializeStorage();