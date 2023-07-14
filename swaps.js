import { ChiaDaemon } from "chia-daemon";
import { getToken } from "./tibet.js";
import _ from "lodash";

export async function getSwaps(connection, fingerprints) {
    const chia = new ChiaDaemon(connection, "swap-utils");
    if (!(await chia.connect())) {
        return undefined;
    }

    let swaps = [];
    try {
        for await (const fingerprint of fingerprints || [null]) {
            swaps = swaps.concat(await getSwapsFromWallet(chia, fingerprint));
        }
    } finally {
        chia.disconnect();
    }

    return swaps;
}

async function getSwapsFromWallet(chia, fingerprint) {
    // null signals just do the default wallet
    if (fingerprint !== null) {
        await chia.services.wallet.log_in({
            fingerprint: fingerprint,
        });
    }

    const swaps = [];
    const count = await chia.services.wallet.get_offers_count();
    const pageSize = 10;
    for (let i = 0; i < count.total; i += pageSize) {
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
            // this filters out offers that are just XCH
            // also filters tokens that aren't on tibet-swap
            // can't be a swap without a token
            // (what if i offer a token and xch for an nft?)
            if (offeredPair.token !== undefined) {
                const requestedToken = getRequestedToken(
                    trade.summary.requested,
                    offeredPair.token.pair_name
                );
                swaps.push({
                    offered: offeredPair,
                    requested: requestedToken,
                });
            }
        }
    }

    return swaps;
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
