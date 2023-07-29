import { ChiaDaemon } from "chia-daemon";
import { consolidateSwaps, isAddition, isRemoval } from "./swap.js";
import Swap from "./swap.js";
import _ from "lodash";

export async function getLiquiditySwaps(options, tibetSwap) {
    const chia = new ChiaDaemon(options, "swap-utils");
    if (!(await chia.connect())) {
        throw new Error("Could not connect to chia daemon");
    }

    try {
        let swaps = [];
        const tokenFilter =
            options.token === undefined
                ? () => true
                : (pair) =>
                      pair.short_name.toUpperCase() ===
                      options.token.toUpperCase();

        // get all swap offers from all specified wallets
        for await (const fingerprint of options.wallet_fingerprints || [null]) {
            swaps = swaps.concat(
                await getSwapsFromWallet(
                    chia,
                    fingerprint,
                    tibetSwap,
                    tokenFilter
                )
            );
        }

        return swaps.sort((a, b) =>
            a.pair.pair_name.localeCompare(b.pair.pair_name)
        );
    } finally {
        chia.disconnect();
    }
}

export async function getLiquidityBalances(options, fingerprints, tibetSwap) {
    const swaps = await getLiquiditySwaps(options, fingerprints, tibetSwap);
    if (swaps === undefined) {
        return undefined;
    }
    return consolidateSwaps(swaps);
}

async function getSwapsFromWallet(chia, fingerprint, tibetSwap, tokenFilter) {
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
            (item) =>
                item.status === "CONFIRMED" &&
                item.is_my_offer &&
                // this next part should filter out all the trades that are not swaps
                (isAddition(item) || isRemoval(item))
        )) {
            const pair = tibetSwap.getPairFromTrade(trade);
            if (tokenFilter(pair)) {
                const swap = new Swap(pair, trade);
                swaps.push(swap.asRecord());
            }
        }
    }

    return swaps;
}
