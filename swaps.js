import { ChiaDaemon } from "chia-daemon";
import { consolidateSwaps, isAddition, isRemoval } from "./swap.js";
import { getAssetId, getPairAmount } from "./pair_amount.js";
import Swap from "./swap.js";
import _ from "lodash";

export async function getLiquiditySwaps(options, fingerprints, tibetSwap) {
    const chia = new ChiaDaemon(options, "swap-utils");
    if (!(await chia.connect())) {
        return undefined;
    }

    try {
        let swaps = [];
        const tokenFilter =
            options.token === undefined
                ? () => true
                : (token) =>
                      token.short_name.toUpperCase() ===
                      options.token.toUpperCase();

        // get all swap offers from all specified wallets
        for await (const fingerprint of fingerprints || [null]) {
            swaps = swaps.concat(
                await getSwapsFromWallet(
                    chia,
                    fingerprint,
                    tibetSwap,
                    tokenFilter,
                    options.mode
                )
            );
        }

        // consolidate swaps by pair
        return consolidateSwaps(swaps).sort((a, b) =>
            a.pair.pair_name.localeCompare(b.pair.pair_name)
        );
    } finally {
        chia.disconnect();
    }
}

async function getSwapsFromWallet(
    chia,
    fingerprint,
    tibetSwap,
    tokenFilter,
    mode
) {
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
        for (const trade of allOffers.trade_records.filter(
            (item) => item.status === "CONFIRMED" && item.is_my_offer
        )) {
            if (isAddition(trade) && (mode === "additions" || mode === "all")) {
                const assetId = getAssetId(trade.summary.offered);
                const pair = tibetSwap.getPairByAssetId(assetId);

                if (pair !== undefined && tokenFilter(pair)) {
                    // filter tokens that aren't on tibet-swap
                    // can't be a swap without a supported token
                    // (TODO what if i offer a token and xch for an nft?)
                    const swap = new Swap(pair);
                    swaps.push(
                        swap.asAddition(
                            getPairAmount(trade.summary.offered),
                            getPairAmount(trade.summary.requested)
                        )
                    );
                }
            } else if (
                isRemoval(trade) &&
                (mode === "removals" || mode === "all")
            ) {
                const requestedPair = tibetSwap.getPairByAssetId(
                    trade.summary.requested
                );
                const swap = new Swap(requestedPair.token);

                if (
                    requestedPair.token !== undefined &&
                    tokenFilter(requestedPair.token)
                ) {
                    swaps.push(
                        swap.asRemoval(
                            tibetSwap.getTokenAmount(
                                trade.summary.offered,
                                requestedPair.token.pair_name
                            )
                        )
                    );
                }
            }
        }
    }

    return swaps;
}
