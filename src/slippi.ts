// src/slippi.ts
import "dotenv/config";

// Hardcode the real GraphQL gateway.
export const SLIPPI_ENDPOINT =
    "https://gql-gateway-dot-slippi.uc.r.appspot.com/graphql";
console.log("[slippi] endpoint =", SLIPPI_ENDPOINT);

const query = `
query RankedData($code: String!) {
  getConnectCode(code: $code) {
    user {
      rankedNetplayProfile {
        ratingOrdinal
        wins
        losses
        rank
        season { id }
      }
    }
  }
}`;

export type Snapshot = {
    season: string | null;
    rating: number;
    wins: number;
    losses: number;
    rank: string | null;
};

type RankedResp = {
    data?: {
        getConnectCode?: {
            user?: {
                rankedNetplayProfile?: {
                    ratingOrdinal?: number | null;
                    wins?: number | null;
                    losses?: number | null;
                    rank?: string | null;
                    season?: { id?: string | null } | null;
                } | null;
            } | null;
        } | null;
    };
    errors?: unknown;
};

export async function fetchRankedByCode(code: string): Promise<Snapshot | null> {
    const variables = { code: code.toUpperCase() };

    let r: Response;
    try {
        r = await fetch(SLIPPI_ENDPOINT, {
            method: "POST",
            redirect: "manual",
            headers: {
                // core
                "content-type": "application/json",
                "accept": "application/json",

                // look like the web app
                "origin": "https://slippi.gg",
                "referer": "https://slippi.gg/",
                "user-agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",

                // optional: mimic Apollo web client
                "apollographql-client-name": "slippi-web",
                "apollographql-client-version": "1.0.0",
            },
            // including operationName can help some gateways; harmless if ignored
            body: JSON.stringify({ query, variables, operationName: "RankedData" }),
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

    const p = json.data?.getConnectCode?.user?.rankedNetplayProfile;
    if (!p) return null;

    return {
        season: p.season?.id ?? null,
        rating: Number(p.ratingOrdinal ?? 0),
        wins: Number(p.wins ?? 0),
        losses: Number(p.losses ?? 0),
        rank: p.rank ?? null,
    };
}
