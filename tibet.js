import _ from "lodash";

const tokens = await loadTokens("https://api.v2.tibetswap.io/tokens");
export async function loadTokens(url) {
    try {
        const response = await fetch(url);
        return await response.json();
    } catch (error) {
        console.error("Error fetching data:", error);
        return null;
    }
}

export function getToken(asset_id) {
    if (asset_id === "xch") {
        return {
            asset_id: "xch",
            name: "xch",
            short_name: "xch",
        };
    }
    const token = _.find(tokens, { asset_id });
    return {
        ...token,
        pair_name: `TIBET-${token.short_name}-XCH`,
    };
}
