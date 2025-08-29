const endpoint = "https://gql-gateway-dot-slippi.uc.r.appspot.com/graphql";
const query = "query{__typename}";

(async () => {
    const r = await fetch(endpoint, {
        method: "POST",
        redirect: "manual",
        headers: {
            "content-type": "application/json",
            "accept": "application/json",
            "user-agent": "slippi-test/1.0"
        },
        body: JSON.stringify({ query })
    });
    const ct = r.headers.get("content-type") || "";
    console.log("STATUS", r.status, "CT", ct, "LOC", r.headers.get("location"));
    const text = await r.text();
    console.log("BODY[0..200]:", text.slice(0,200));
})();
