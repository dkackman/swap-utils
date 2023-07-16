#!/usr/bin/env node
import { getLiquidityAdditions } from "./swaps.js";
import TibetSwap from "./tibet.js";
import { options, showHelp } from "./commandLine.js";

const floatFormat = {
    minimumFractionDigits: 0,
    maximumFractionDigits: 12,
};

if (options.help) {
    showHelp();
} else {
    const tibetSwap = new TibetSwap(
        options.tibet_api_uri,
        options.tibet_analytics_api_uri
    );
    await tibetSwap.loadTokenList();

    if (options.command === "swaps") {
        await dumpSwaps(options, tibetSwap);
    } else if (options.command === "imp") {
        await impermanence(options, tibetSwap);
    } else {
        console.error(`Unknown command ${options.command}`);
        showHelp();
    }
}

async function impermanence(options, tibetSwap) {
    const swaps = await getLiquidityAdditions(
        options,
        options.wallet_fingerprints,
        tibetSwap
    );

    if (!swaps) {
        console.error("Could not connect to wallet");
        return;
    }

    // for each summarized swap get the pair
    for await (const swap of swaps) {
        const currentValue = await tibetSwap.getLiquidityValue(
            swap.pair_id,
            swap.requested.token_amount_mojo
        );
        swap.currentValue = currentValue;
    }

    if (options.json) {
        console.log(JSON.stringify(swaps));
    } else {
        let totalNetXchReturns = 0;
        for await (const swap of swaps) {
            // the change in xch amount from the addition to the removal
            // since the liquidity fee is burned on withdrawal factor it out
            const netXchAmount =
                swap.currentValue.xch_amount -
                (swap.offered.xch_amount + swap.liquidity_fee);
            // the change in token amount from the addition to the removal
            const netTokenAmount =
                swap.currentValue.token_amount - swap.offered.token_amount;
            // the current market value of the net amount of token
            const pairValue = await tibetSwap.estimatePairValue(
                swap.pair_id,
                netTokenAmount
            );
            // the total investment returns for this pair
            // net change of xch + the current market value in xch of the net token amount
            const netXchReturns = netXchAmount + pairValue.xch_amount;
            totalNetXchReturns += netXchReturns;

            printSwap(swap);

            console.log(
                `Now worth ${swap.currentValue.xch_amount.toLocaleString(
                    undefined,
                    floatFormat
                )} XCH and ${swap.currentValue.token_amount.toLocaleString(
                    undefined,
                    floatFormat
                )} ${swap.offered.token.short_name}`
            );
            console.log(
                `Net change ${netXchAmount.toLocaleString(
                    undefined,
                    floatFormat
                )} XCH and ${netTokenAmount.toLocaleString(
                    undefined,
                    floatFormat
                )} ${
                    swap.offered.token.short_name
                } (worth ${pairValue.xch_amount.toLocaleString(
                    undefined,
                    floatFormat
                )} XCH)`
            );

            console.log(
                `Returns ${netXchReturns.toLocaleString(
                    undefined,
                    floatFormat
                )} XCH`
            );
            console.log("--------------------------------------------------");
        }
        console.log(
            `Total returns ${totalNetXchReturns.toLocaleString(
                undefined,
                floatFormat
            )} XCH`
        );
    }
}

async function dumpSwaps(options, tibetSwap) {
    const swaps = await getLiquidityAdditions(
        options,
        options.wallet_fingerprints,
        tibetSwap
    );

    if (!swaps) {
        console.error("Could not connect to wallet");
        return;
    }

    if (options.json) {
        console.log(JSON.stringify(swaps));
    } else {
        swaps.forEach((swap) => printSwap(swap));
    }
}

function printSwap(swap) {
    console.log(
        `Swapped ${swap.offered.xch_amount.toLocaleString(
            undefined,
            floatFormat
        )} XCH and ${swap.offered.token_amount.toLocaleString(
            undefined,
            floatFormat
        )} ${
            swap.offered.token.short_name
        } for ${swap.requested.token_amount.toLocaleString(
            undefined,
            floatFormat
        )} ${swap.pair_name}`
    ); // and ${swap.liquidity_xch_amount.toLocaleString(
    //     undefined,
    //     floatFormat
    // )} XCH liquidity`
    //);
}
