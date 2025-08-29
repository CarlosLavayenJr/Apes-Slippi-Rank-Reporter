// src/slippi.ts
import "dotenv/config";

// slippi.ts
const endpoint = "https://gql-gateway-dot-slippi.uc.r.appspot.com/graphql";


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
            user?: { rankedNetplayProfile?: any | null } | null;
        } | null;
    };
    errors?: unknown;
};

export async function fetchRankedByCode(code: string): Promise<Snapshot | null> {
    const variables = { code: code.toUpperCase() };

    const r = await fetch(endpoint, {
        method: "POST",
        redirect: "manual", // capture redirects instead of following them
        headers: {
            "content-type": "application/json",
            "accept": "application/json",
            "user-agent": "discord-rank-bot/1.0",
            "apollographql-client-name": "discord-rank-bot",
            "apollographql-client-version": "1.0.0",
        },
        body: JSON.stringify({ query, variables }),
    });

    // DEBUG LOGS
    console.log("STATUS", r.status, "CT", r.headers.get("content-type"));
    console.log("REDIRECT?", r.status >= 300 && r.status < 400, "Location:", r.headers.get("location"));

    const ctype = r.headers.get("content-type") || "";
    if (!r.ok) {
        const text = await r.text();
        throw new Error(`Slippi HTTP ${r.status} ${r.statusText}; ctype=${ctype}; body[0..200]=${text.slice(0,200)}`);
    }
    if (!ctype.includes("application/json")) {
        const text = await r.text();
        throw new Error(`Expected JSON but got ${ctype}; body[0..200]=${text.slice(0,200)}`);
    }

    const json: RankedResp = await r.json();
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

