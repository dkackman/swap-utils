import { ChiaDaemon } from "chia-daemon";
import _ from "lodash";

export async function getLiquidityAdditions(
    connection,
    fingerprints,
    tibetSwap
) {
    const chia = new ChiaDaemon(connection, "swap-utils");
    if (!(await chia.connect())) {
        return undefined;
    }

    try {
        let swaps = [];
        // get all swap offers from all specified wallets
        for await (const fingerprint of fingerprints || [null]) {
            swaps = swaps.concat(
                await getSwapsFromWallet(chia, fingerprint, tibetSwap)
            );
        }

        // consolidate swaps by pair
        return consolidateSwaps(swaps);
    } finally {
        chia.disconnect();
    }
}

async function getSwapsFromWallet(chia, fingerprint, tibetSwap) {
    // null signals just do the default wallet
    // otherwise we need to login to the wallet
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

        // SWAPS will be confirmed, offers that user has made
        // ADDITIONS will offer two and only two items, one of which will be xch
        for await (const trade of allOffers.trade_records.filter(
            (item) =>
                item.status === "CONFIRMED" &&
                item.is_my_offer &&
                item.summary.offered.xch !== undefined &&
                Object.keys(item.summary.offered).length === 2
        )) {
            const offeredPair = getOfferedPair(
                tibetSwap,
                trade.summary.offered
            );
            // filter tokens that aren't on tibet-swap
            // can't be a swap without a supported token
            // (TODO what if i offer a token and xch for an nft?)
            //
            // ONLY DEALS WITH FOR ADDITIONS RIGHT NOW
            if (offeredPair.token !== undefined) {
                const requestedToken = getRequestedToken(
                    trade.summary.requested,
                    offeredPair.token.pair_name
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

function getRequestedToken(requested) {
    const token = {};
    for (const field in requested) {
        // the token asset_id is the field name
        token.token_amount = requested[field] / 1000.0;
        token.token_amount_mojo = requested[field];
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
            // the token asset_id is the field name
            pair.token_amount = offered[field] / 1000.0;
            pair.token_amount_mojo = offered[field];
            pair.token = tibetSwap.getToken(field);
        }
    }

    return pair;
}

function consolidateSwaps(swaps) {
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

    // return the resulting value array
    return _.values(grouped);
}
