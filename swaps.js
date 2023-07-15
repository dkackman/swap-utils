import { ChiaDaemon } from "chia-daemon";
import _ from "lodash";

export async function getSwaps(
    connection,
    fingerprints,
    tibetSwap,
    floatFormat
) {
    const chia = new ChiaDaemon(connection, "swap-utils");
    if (!(await chia.connect())) {
        return undefined;
    }

    try {
        let swaps = [];
        // get all swap offers from all wallets
        for await (const fingerprint of fingerprints || [null]) {
            swaps = swaps.concat(
                await getSwapsFromWallet(chia, fingerprint, tibetSwap)
            );
        }

        // consolidate swaps by pair
        swaps = consolidateSwaps(swaps, floatFormat);
        swaps.forEach((swap) => {
            swap.requested.token_amount_string =
                swap.requested.token_amount.toLocaleString(
                    undefined,
                    floatFormat
                );
            swap.offered.xch_amount_string =
                swap.offered.xch_amount.toLocaleString(undefined, floatFormat);
            swap.offered.token_amount_string =
                swap.offered.token_amount.toLocaleString(
                    undefined,
                    floatFormat
                );
        });

        return swaps;
    } finally {
        chia.disconnect();
    }
}

function consolidateSwaps(swaps, floatFormat) {
    let grouped = _.reduce(
        swaps,
        (result, value) => {
            // this ensures we have only one object per pair
            // and creates the starter object
            if (!result[value.pair_id]) {
                result[value.pair_id] = {
                    pair_name: value.pair_name,
                    pair_id: value.pair_id,
                    offered: {
                        token: value.offered.token,
                        token_amount: 0,
                        token_amount_mojo: 0,
                        xch_amount: 0,
                        xch_amount_mojo: 0,
                    },
                    requested: {
                        token_amount: 0,
                        token_amount_mojo: 0,
                    },
                };
            }

            // now sum up the values
            result[value.pair_id].offered.token_amount +=
                value.offered.token_amount;
            result[value.pair_id].offered.token_amount_mojo +=
                value.offered.token_amount_mojo;
            result[value.pair_id].offered.xch_amount +=
                value.offered.xch_amount;
            result[value.pair_id].offered.xch_amount_mojo +=
                value.offered.xch_amount_mojo;

            result[value.pair_id].requested.token_amount +=
                value.requested.token_amount;
            result[value.pair_id].requested.token_amount_mojo +=
                value.requested.token_amount_mojo;

            return result;
        },
        {}
    );

    // If you want the result as an array, not an object:
    return _.values(grouped);
}

async function getSwapsFromWallet(chia, fingerprint, tibetSwap, floatFormat) {
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
            const offeredPair = getOfferedPair(
                tibetSwap,
                trade.summary.offered,
                floatFormat
            );
            // this filters out offers that are just XCH
            // also filters tokens that aren't on tibet-swap
            // can't be a swap without a token
            // (what if i offer a token and xch for an nft?)
            if (offeredPair.token !== undefined) {
                const requestedToken = getRequestedToken(
                    trade.summary.requested,
                    offeredPair.token.pair_name,
                    floatFormat
                );
                swaps.push({
                    pair_name: offeredPair.token.pair_name,
                    pair_id: offeredPair.token.pair_id,
                    offered: offeredPair,
                    requested: requestedToken,
                });
            }
        }
    }

    return swaps;
}

function getRequestedToken(requested, pairName, floatFormat) {
    const token = {};
    for (const field in requested) {
        token.token_amount = requested[field] / 1000.0;
        token.token_amount_mojo = requested[field];
        token.token_amount_string = token.token_amount.toLocaleString(
            undefined,
            floatFormat
        );
    }

    return token;
}

function getOfferedPair(tibetSwap, offered) {
    const pair = {};
    for (const field in offered) {
        if (field === "xch") {
            pair.xch_amount = offered.xch / 10.0 ** 12;
            pair.xch_amount_mojo = offered.xch;
        } else {
            pair.token_amount = offered[field] / 1000.0;
            pair.token_amount_mojo = offered[field];
            pair.token = tibetSwap.getToken(field);
        }
    }

    return pair;
}
