import "dotenv/config";
import {AttachmentBuilder} from "discord.js";
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
    globalPlacement?: number; // Add global placement to the snapshot
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
                dailyGlobalPlacement?: number; // Add this field
            };
            rankedNetplayProfileHistory?: Array<{
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

function deriveRank(rating: number, globalPlacement?: number): string {
    // Special condition: top 300 globally get Grandmaster rank
    if (globalPlacement !== undefined && globalPlacement <= 300) {
        return "Grandmaster";
    }
    
    // Original rank derivation based on rating
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
    return new AttachmentBuilder(imagePath, {name: "rank.png"});
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
    const globalPlacement = prof.dailyGlobalPlacement;

    return {
        season,
        rating,
        wins: Number(prof.wins ?? 0),
        losses: Number(prof.losses ?? 0),
        rank: deriveRank(rating, globalPlacement),
        globalPlacement,
    };
}