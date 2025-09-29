import "dotenv/config";
import { AttachmentBuilder } from "discord.js";
import * as path from "path";
import * as fs from "fs";

export const SLIPPI_ENDPOINT = "https://internal.slippi.gg/graphql";
console.log("[slippi] endpoint =", SLIPPI_ENDPOINT);

//Jape Was Here Niggas

// Updated query to match the working curl
const query = `
fragment profileFields on NetplayProfile {
  id
  ratingOrdinal
  ratingUpdateCount
  wins
  losses
  dailyGlobalPlacement
  dailyRegionalPlacement
  continent
  characters {
    character
    gameCount
    __typename
  }
  __typename
}

fragment userProfilePage on User {
  fbUid
  displayName
  connectCode {
    code
    __typename
  }
  status
  activeSubscription {
    level
    hasGiftSub
    __typename
  }
  rankedNetplayProfile {
    ...profileFields
    __typename
  }
  rankedNetplayProfileHistory {
    ...profileFields
    season {
      id
      startedAt
      endedAt
      name
      status
      __typename
    }
    __typename
  }
  __typename
}

query UserProfilePageQuery($cc: String, $uid: String) {
  getUser(fbUid: $uid, connectCode: $cc) {
    ...userProfilePage
    __typename
  }
}
`;

export type Snapshot = {
    season: string | null;
    rating: number;
    wins: number;
    losses: number;
    rank: string | null;
    globalPlacement?: number;
    regionalPlacement?: number;

};

export type Character = {
    character: number;
    gameCount: number;
};

export type ProfileData = {
    displayName?: string;
    currentProfile: Snapshot;
    topCharacters: Character[];
    totalGames: number;
    pastSeasons: Array<{
        seasonName: string;
        rating: number;
        rank: string;
        wins: number;
        losses: number;
    }>;
};

type RankedResp = {
    data?: {
        getUser?: {
            displayName?: string;
            rankedNetplayProfile?: {
                id?: string;
                ratingOrdinal?: number;
                wins?: number;
                losses?: number;
                dailyGlobalPlacement?: number;
                dailyRegionalPlacement?: number;
                characters?: Array<{
                    character: number;
                    gameCount: number;
                }>;
            };
            rankedNetplayProfileHistory?: Array<{
                id?: string;
                ratingOrdinal?: number;
                wins?: number;
                losses?: number;
                dailyGlobalPlacement?: number;
                dailyRegionalPlacement?: number;
                characters?: Array<{
                    character: number;
                    gameCount: number;
                }>;
                season?: {
                    id?: string;
                    name?: string;
                    status?: string;
                };
            }>;
        };
    };
    errors?: unknown;
};

function deriveRank(rating: number): string {
    if (rating >= 2450) return "Grandmaster";
    if (rating >= 2350) return "Master III";
    if (rating >= 2275) return "Master II";
    if (rating >= 2192) return "Master I";
    if (rating >= 2137) return "Diamond III";
    if (rating >= 2074) return "Diamond II";
    if (rating >= 2004) return "Diamond I";
    if (rating >= 1928) return "Platinum III";
    if (rating >= 1843) return "Platinum II";
    if (rating >= 1752) return "Platinum I";
    if (rating >= 1654) return "Gold III";
    if (rating >= 1549) return "Gold II";
    if (rating >= 1436) return "Gold I";
    if (rating >= 1316) return "Silver III";
    if (rating >= 1189) return "Silver II";
    if (rating >= 1055) return "Silver I";
    if (rating >= 914) return "Bronze III";
    if (rating >= 766) return "Bronze II";
    return "Bronze I";
}

function getCharacterName(charId: number): string {
    const chars: { [key: number]: string } = {
        0: "Captain Falcon",
        1: "Donkey Kong",
        2: "Fox",
        3: "Mr. Game & Watch",
        4: "Kirby",
        5: "Bowser",
        6: "Link",
        7: "Luigi",
        8: "Mario",
        9: "Marth",
        10: "Mewtwo",
        11: "Ness",
        12: "Peach",
        13: "Pikachu",
        14: "Ice Climbers",
        15: "Jigglypuff",
        16: "Samus",
        17: "Yoshi",
        18: "Zelda",
        19: "Sheik",
        20: "Falco",
        21: "Young Link",
        22: "Dr. Mario",
        23: "Roy",
        24: "Pichu",
        25: "Ganondorf"
    };
    return chars[charId] || `Character ${charId}`;
}

export function getRankImagePath(rank: string): string {
    // For Bronze and Silver ranks, use the unknown rank image
    if (rank.startsWith("Bronze") || rank.startsWith("Silver")) {
        return path.resolve(process.cwd(), "slippi-ranks", "rank_Unknown.png");
    }

    // Map rank names to file names
    const rankToFile: { [key: string]: string } = {
        "Gold I": "rank_Gold_I.png",
        "Gold II": "rank_Gold_II.png",
        "Gold III": "rank_Gold_III.png",
        "Platinum I": "rank_Platinum_I.png",
        "Platinum II": "rank_Platinum_II.png",
        "Platinum III": "rank_Platinum_III.png",
        "Diamond I": "rank_Diamond_I.png",
        "Diamond II": "rank_Diamond_II.png",
        "Diamond III": "rank_Diamond_III.png",
        "Master I": "rank_Master_I.png",
        "Master II": "rank_Master_II.png",
        "Master III": "rank_Master_III.png",
        "Grandmaster": "rank_Grandmaster.png"
    };

    const fileName = rankToFile[rank] || "rank_Unknown.svg";
    const imagePath = path.resolve(process.cwd(), "slippi-ranks", fileName);
    console.debug(`[getRankImagePath] Rank: ${rank}, Resolved Path: ${imagePath}`);
    return imagePath;
}

export function createRankAttachment(rank: string): AttachmentBuilder | null {
    const imagePath = getRankImagePath(rank);

    // Check if file exists before creating attachment
    if (!fs.existsSync(imagePath)) {
        console.error(`[slippi] Rank image not found: ${imagePath}`);
        return null;
    }

    console.log(`[slippi] Creating attachment for rank: ${rank}, path: ${imagePath}`);
    return new AttachmentBuilder(imagePath, { name: "rank.png" });
}

function getCurrentSeasonName(
    currentProfile?: { id?: string },
    profileHistory?: Array<{ season?: { id?: string; name?: string; status?: string } }>
): string | null {
    if (!currentProfile?.id) return null;

    // Extract season from current profile ID (e.g., "RANKED_SINGLES-...-season-3")
    const match = currentProfile.id.match(/-([^-]+)$/);
    const currentSeasonId = match ? match[1] : null;

    if (!currentSeasonId) return null;

    // Try to find the season name in history
    const seasonInfo = profileHistory?.find(p => p.season?.id === currentSeasonId);
    if (seasonInfo?.season?.name) {
        return seasonInfo.season.name;
    }

    // Fallback: format the season ID nicely
    if (currentSeasonId.startsWith('season-')) {
        const num = currentSeasonId.replace('season-', '');
        return `Season ${num}`;
    }

    return currentSeasonId;
}

export async function fetchRankedByCode(code: string): Promise<Snapshot | null> {
    const cc = code.toUpperCase().trim();
    const payload = {
        operationName: "UserProfilePageQuery",
        variables: { cc, uid: cc },
        query,
    };

    let r: Response;
    try {
        r = await fetch(SLIPPI_ENDPOINT, {
            method: "POST",
            redirect: "manual",
            headers: {
                "content-type": "application/json",
                "accept": "application/json",
            },
            body: JSON.stringify(payload),
        });
    } catch (e) {
        console.error("[slippi] network error:", e);
        return null;
    }

    const ct = r.headers.get("content-type") || "";
    console.log(
        "[slippi] fetch -> status",
        r.status,
        "ct",
        ct
    );

    if (!ct.includes("application/json")) {
        const text = await r.text();
        console.error("[slippi] NON-JSON (first 200):", text.slice(0, 200));
        return null;
    }

    let json: RankedResp;
    try {
        json = (await r.json()) as RankedResp;
        console.log("[slippi] success for", cc);
    } catch (e) {
        console.error("[slippi] JSON parse error:", e);
        return null;
    }

    const user = json.data?.getUser;
    const prof = user?.rankedNetplayProfile;
    if (!prof) {
        console.log("[slippi] no ranked profile found for", cc);
        return null;
    }

    const season = getCurrentSeasonName(prof, user?.rankedNetplayProfileHistory);
    const rating = Number(prof.ratingOrdinal ?? 0);

    return {
        season,
        rating,
        wins: Number(prof.wins ?? 0),
        losses: Number(prof.losses ?? 0),
        rank: deriveRank(rating),
        globalPlacement: prof.dailyGlobalPlacement ? Number(prof.dailyGlobalPlacement) : undefined,
        regionalPlacement: prof.dailyRegionalPlacement ? Number(prof.dailyRegionalPlacement) : undefined,
    };
}

export async function fetchProfileByCode(code: string): Promise<ProfileData | null> {
    const cc = code.toUpperCase().trim();
    const payload = {
        operationName: "UserProfilePageQuery",
        variables: { cc, uid: cc },
        query,
    };

    let r: Response;
    try {
        r = await fetch(SLIPPI_ENDPOINT, {
            method: "POST",
            redirect: "manual",
            headers: {
                "content-type": "application/json",
                "accept": "application/json",
            },
            body: JSON.stringify(payload),
        });
    } catch (e) {
        console.error("[slippi] network error:", e);
        return null;
    }

    const ct = r.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
        const text = await r.text();
        console.error("[slippi] NON-JSON (first 200):", text.slice(0, 200));
        return null;
    }

    let json: RankedResp;
    try {
        json = (await r.json()) as RankedResp;
    } catch (e) {
        console.error("[slippi] JSON parse error:", e);
        return null;
    }

    const user = json.data?.getUser;
    const currentProf = user?.rankedNetplayProfile;
    if (!currentProf) {
        console.log("[slippi] no ranked profile found for", cc);
        return null;
    }

    const currentSeason = getCurrentSeasonName(currentProf, user?.rankedNetplayProfileHistory);
    const currentRating = Number(currentProf.ratingOrdinal ?? 0);

    // Get top 3 characters by game count
    const characters = currentProf.characters || [];
    const topCharacters = characters
        .sort((a, b) => b.gameCount - a.gameCount)
        .slice(0, 3);

    // Calculate total games
    const totalGames = characters.reduce((sum, char) => sum + char.gameCount, 0);

    // Get past season data
    const pastSeasons = (user?.rankedNetplayProfileHistory || [])
        .filter(p => p.season?.status !== "ACTIVE") // Exclude current season
        .map(p => ({
            seasonName: p.season?.name || `Season ${p.season?.id}`,
            rating: Number(p.ratingOrdinal ?? 0),
            rank: deriveRank(Number(p.ratingOrdinal ?? 0)),
            wins: Number(p.wins ?? 0),
            losses: Number(p.losses ?? 0)
        }))
        .sort((a, b) => b.rating - a.rating); // Sort by rating, highest first

    return {
        displayName: user?.displayName,
        currentProfile: {
            season: currentSeason,
            rating: currentRating,
            wins: Number(currentProf.wins ?? 0),
            losses: Number(currentProf.losses ?? 0),
            rank: deriveRank(currentRating),
        },
        topCharacters,
        totalGames,
        pastSeasons: pastSeasons.slice(0, 5) // Limit to last 5 seasons
    };
}

export function getCharacterIconPath(charId: number): string {
    const charName = getCharacterName(charId);
    
    // Map character names to their directory names (handling special cases)
    const nameToDir: { [key: string]: string } = {
        "Mr. Game & Watch": "Game & Watch",
        "Dr. Mario": "Dr. Mario", 
        "Young Link": "Young Link",
        "Ice Climbers": "Ice Climbers"
    };
    
    const dirName = nameToDir[charName] || charName;
    
    // The files are all lowercase versions of the character name
    // Remove spaces, special characters, and convert to lowercase
    let fileName = charName.toLowerCase()
        .replace(/[^a-z0-9]/g, '') // Remove all non-alphanumeric characters
        .replace('mrgamewatch', 'gamewatch'); // Special case for Game & Watch
    
    // Try the most likely filename pattern first (all lowercase, no spaces)
    const possibleNames = [
        `${fileName}.png`,
        `${charName.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')}.png`,
        `${charName.toLowerCase().replace(/\s+/g, '_')}.png`,
        `${charName.toLowerCase().replace(/\s+/g, '-')}.png`
    ];
    
    const basePath = path.resolve(process.cwd(), "stock-icons", "Modernized Stock Icons HD", dirName);
    
    // Try to find the actual file
    for (const testFileName of possibleNames) {
        const fullPath = path.join(basePath, testFileName);
        if (fs.existsSync(fullPath)) {
            console.debug(`[getCharacterIconPath] Found icon for ${charName}: ${fullPath}`);
            return fullPath;
        }
    }
    
    // Fallback: try to find any .png file in the character directory
    try {
        const files = fs.readdirSync(basePath);
        const pngFile = files.find(f => f.toLowerCase().endsWith('.png'));
        if (pngFile) {
            const fullPath = path.join(basePath, pngFile);
            console.debug(`[getCharacterIconPath] Found fallback icon for ${charName}: ${fullPath}`);
            return fullPath;
        }
    } catch (e) {
        console.error(`[getCharacterIconPath] Directory not found: ${basePath}`);
    }
    
    console.warn(`[getCharacterIconPath] No icon found for ${charName} (ID: ${charId})`);
    return "";
}

export function createCharacterAttachments(topCharacters: Character[]): AttachmentBuilder[] {
    const attachments: AttachmentBuilder[] = [];
    
    topCharacters.forEach((char, index) => {
        const iconPath = getCharacterIconPath(char.character);
        if (iconPath && fs.existsSync(iconPath)) {
            const attachment = new AttachmentBuilder(iconPath, { 
                name: `character_${index}.png` 
            });
            attachments.push(attachment);
            console.log(`[slippi] Created character attachment for ${getCharacterName(char.character)}`);
        }
    });
    
    return attachments;
}

export { getCharacterName };