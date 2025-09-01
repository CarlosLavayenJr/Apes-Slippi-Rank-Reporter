import "dotenv/config";

export const SLIPPI_ENDPOINT = "https://internal.slippi.gg/graphql";
console.log("[slippi] endpoint =", SLIPPI_ENDPOINT);

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

function deriveRank(rating: number): string {
    if (rating >= 2350) return "Master+";
    if (rating >= 2192) return "Master";
    if (rating >= 2004) return "Diamond";
    if (rating >= 1752) return "Platinum";
    if (rating >= 1436) return "Gold";
    if (rating >= 1055) return "Silver";
    return "Bronze";
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
    };
}