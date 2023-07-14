import { ChiaDaemon } from "chia-daemon";
import _ from "lodash";

export async function dumpOffers(connection, fingerprint) {
    const chia = new ChiaDaemon(connection, "offer-dump");
    const connected = await chia.connect();
    if (connected) {
        await chia.services.wallet.log_in({
            fingerprint: fingerprint,
        });

        const count = await chia.services.wallet.get_offers_count();
        const pageSize = 10;
        for (let i = 0; i < count.my_offers_count; i += pageSize) {
            const allOffers = await chia.services.wallet.get_all_offers({
                start: i,
                end: i + pageSize,
                exclude_my_offers: false,
                exclude_taken_offers: false,
                include_completed: true,
                reverse: false,
                file_contents: false,
            });

            for await (const trade of allOffers.trade_records.filter(
                (item) =>
                    item.status === "CONFIRMED" &&
                    item.is_my_offer &&
                    item.summary.offered.xch !== undefined
            )) {
                const offeredPair = getOfferedPair(trade.summary.offered);
                const requestedToken = getRequestedToken(
                    trade.summary.requested,
                    offeredPair.token.pair_name
                );
                console.log(
                    `Swapped ${offeredPair.xch} MOJO and ${offeredPair.token_amount} ${offeredPair.token.short_name} for ${requestedToken.token_amount} ${requestedToken.pair_name}`
                );
            }
        }

        chia.disconnect();
    }
}

function getRequestedToken(requested, pairName) {
    const token = {};
    for (const field in requested) {
        token.token_amount = requested[field];
        token.pair_name = pairName;
    }

    return token;
}

function getOfferedPair(offered) {
    const pair = {};
    for (const field in offered) {
        if (field === "xch") {
            pair.xch = offered.xch;
        } else {
            pair.token_amount = offered[field];
            pair.token = getToken(field);
        }
    }

    return pair;
}

const tokens = await loadTokens("https://api.v2.tibetswap.io/tokens");
async function loadTokens(url) {
    try {
        const response = await fetch(url);
        return await response.json();
    } catch (error) {
        console.error("Error fetching data:", error);
        return null;
    }
}

function getToken(asset_id) {
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
