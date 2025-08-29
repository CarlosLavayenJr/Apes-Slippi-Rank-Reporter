// src/slippi.ts
import "dotenv/config";

export const SLIPPI_ENDPOINT =
    "https://gql-gateway-dot-slippi.uc.r.appspot.com/graphql";
console.log("[slippi] endpoint =", SLIPPI_ENDPOINT);

// Query shape aligned with the slippi.gg web app
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
  characters { id character gameCount __typename }
  __typename
}
fragment userProfilePage on User {
  fbUid
  displayName
  connectCode { code __typename }
  status
  activeSubscription { level hasGiftSub __typename }
  rankedNetplayProfile { ...profileFields __typename }
  netplayProfiles {
    ...profileFields
    season { id startedAt endedAt name status __typename }
    __typename
  }
  __typename
}
query AccountManagementPageQuery($cc: String!, $uid: String!) {
  getUser(fbUid: $uid) { ...userProfilePage __typename }
  getConnectCode(code: $cc) {
    user { ...userProfilePage __typename }
    __typename
  }
}
`;

export type Snapshot = {
    season: string | null;
    rating: number;
    wins: number;
    losses: number;
    rank: string | null; // derived from rating; Slippi doesn't return a tier string directly
};

type NetplayProfileLite = { season?: { id?: string | null } | null } | null;

type RankedResp = {
    data?: {
        getConnectCode?: {
            user?: {
                displayName?: string;
                rankedNetplayProfile?: {
                    ratingOrdinal?: number | null;
                    wins?: number | null;
                    losses?: number | null;
                } | null;
                netplayProfiles?: NetplayProfileLite[] | null;
            } | null;
        } | null;
    };
    errors?: unknown;
};

function deriveRank(rating: number): string {
    // rough buckets; tweak to match exact Slippi tiers if you want
    if (rating >= 2350) return "Master+";
    if (rating >= 2192) return "Master";
    if (rating >= 2004) return "Diamond";
    if (rating >= 1752) return "Platinum";
    if (rating >= 1436) return "Gold";
    if (rating >= 1055) return "Silver";
    return "Bronze";
}

function latestSeasonId(profiles?: NetplayProfileLite[] | null): string | null {
    if (!profiles || profiles.length === 0) return null;
    // Walk from end without using Array.prototype.findLast (older lib compat)
    for (let i = profiles.length - 1; i >= 0; i--) {
        const id = profiles[i]?.season?.id ?? null;
        if (id) return id;
    }
    return profiles[0]?.season?.id ?? null;
}

export async function fetchRankedByCode(code: string): Promise<Snapshot | null> {
    const cc = code.toUpperCase().trim();
    const payload = {
        operationName: "AccountManagementPageQuery",
        variables: { cc, uid: cc }, // site sends both; harmless if uid isn't used
        query,
    };

    let r: Response;
    try {
        r = await fetch(SLIPPI_ENDPOINT, {
            method: "POST",
            redirect: "manual",
            headers: {
                // core
                "content-type": "application/json",
                "accept": "application/json",

                // pretend to be the site (some frontends gate on these)
                "origin": "https://slippi.gg",
                "referer": "https://slippi.gg/",
                "user-agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",

                // Apollo-ish headers
                "apollographql-client-name": "slippi-web",
                "apollographql-client-version": "1.0.0",
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
        ct,
        "finalURL",
        (r as any).url ?? "(n/a)"
    );

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

    const user = json.data?.getConnectCode?.user;
    const prof = user?.rankedNetplayProfile;
    if (!prof) return null;

    const season = latestSeasonId(user?.netplayProfiles ?? null);
    const rating = Number(prof.ratingOrdinal ?? 0);

    return {
        season,
        rating,
        wins: Number(prof.wins ?? 0),
        losses: Number(prof.losses ?? 0),
        rank: deriveRank(rating),
    };
}
