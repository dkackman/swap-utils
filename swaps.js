import { ChiaDaemon } from "chia-daemon";
import { getPair, getTokenAmount } from "./token.js";
import { consolidateSwaps, isAddition, isRemoval } from "./swap.js";
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
            a.pair_name.localeCompare(b.pair_name)
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
                const offeredPair = getPair(tibetSwap, trade.summary.offered);
                const swap = new Swap(offeredPair);
                if (
                    offeredPair.token !== undefined &&
                    tokenFilter(offeredPair.token)
                ) {
                    // filter tokens that aren't on tibet-swap
                    // can't be a swap without a supported token
                    // (TODO what if i offer a token and xch for an nft?)
                    swaps.push(
                        swap.asAddition(
                            getTokenAmount(
                                trade.summary.requested,
                                offeredPair.token.pair_name
                            )
                        )
                    );
                }
            } else if (
                isRemoval(trade) &&
                (mode === "removals" || mode === "all")
            ) {
                const requestedPair = getPair(
                    tibetSwap,
                    trade.summary.requested
                );
                const swap = new Swap(requestedPair);

                if (
                    requestedPair.token !== undefined &&
                    tokenFilter(requestedPair.token)
                ) {
                    swaps.push(
                        swap.asRemoval(
                            getTokenAmount(
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
