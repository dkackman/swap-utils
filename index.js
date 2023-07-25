#!/usr/bin/env node
import { getLiquiditySwaps, getLiquidityBalances } from "./offers.js";
import TibetSwap from "./tibet.js";
import { options, showHelp } from "./commandLine.js";
import _ from "lodash";

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
        await swaps(options, tibetSwap);
    } else if (options.command === "imp") {
        await impermanence(options, tibetSwap);
    } else if (options.command === "xch") {
        await xch(options, tibetSwap);
    } else {
        console.error(`Unknown command ${options.command}`);
        showHelp();
    }
}

async function impermanence(options, tibetSwap) {
    const balances = await getLiquidityBalances(
        options,
        options.wallet_fingerprints,
        tibetSwap
    );

    // for each summarized swap get the pair
    for await (const balance of balances) {
        balance.currentValue = await tibetSwap.getLiquidityValue(
            balance.pair.pair_id,
            balance.balances.get(balance.pair.pair_id) * 1000
        );
    }

    if (options.json) {
        console.log(JSON.stringify(balances));
    } else {
        let totalXchReturns = 0.0;

        for await (const record of balances) {
            // the change in xch amount
            const netXchAmount =
                record.currentValue.xch_amount + record.balances.get("xch");
            // the change in token amount
            const netTokenAmount =
                record.currentValue.token_amount +
                record.balances.get(record.pair.asset_id);

            // the current market value of the net amount of token
            const pairValue = await tibetSwap.estimatePairValue(
                record.pair.pair_id,
                netTokenAmount
            );

            // the total investment returns for this pair is equal to the
            // net change of xch + the current market value (in xch) of the net token amount.
            // Also, since the liquidity fee is burned on withdrawal, factor it out
            const netXchReturns =
                netXchAmount +
                pairValue.xch_amount -
                record.balances.get("liquidity_fee_xch");
            totalXchReturns += netXchReturns;

            printBalance(record);

            console.log(
                `Now worth ${record.currentValue.xch_amount.toLocaleString(
                    undefined,
                    floatFormat
                )} XCH and ${record.currentValue.token_amount.toLocaleString(
                    undefined,
                    floatFormat
                )} ${record.pair.short_name}`
            );
            console.log(
                `Net change ${netXchAmount.toLocaleString(
                    undefined,
                    floatFormat
                )} XCH and ${netTokenAmount.toLocaleString(
                    undefined,
                    floatFormat
                )} ${
                    record.pair.short_name
                } (worth ${pairValue.xch_amount.toLocaleString(
                    undefined,
                    floatFormat
                )} XCH)`
            );

            console.log(
                `Impermanence ${netXchReturns.toLocaleString(
                    undefined,
                    floatFormat
                )} XCH`
            );
            console.log("--------------------------------------------------");
        }
        console.log(
            `Total impermanence ${totalXchReturns.toLocaleString(
                undefined,
                floatFormat
            )} XCH`
        );
    }
}

async function swaps(options, tibetSwap) {
    const records = await getRecords(options, tibetSwap);

    if (options.json) {
        console.log(JSON.stringify(records));
    } else {
        records.forEach((record) => printSwap(record));
    }
}

async function getRecords(options, tibetSwap) {
    if (options.summarize) {
        return await getLiquidityBalances(
            options,
            options.wallet_fingerprints,
            tibetSwap
        );
    }

    return await getLiquiditySwaps(
        options,
        options.wallet_fingerprints,
        tibetSwap
    );
}

function printSwap(swap) {
    if (swap.type === "addition") {
        const addedXch = Math.abs(swap.offered.xch_amount);
        const addedToken = Math.abs(swap.offered.token_amount);
        const receivedToken = Math.abs(swap.requested.token_amount);

        console.log(
            `Added ${addedXch.toLocaleString(
                undefined,
                floatFormat
            )} XCH and ${addedToken.toLocaleString(undefined, floatFormat)} ${
                swap.pair.short_name
            } liquidity and received ${receivedToken.toLocaleString(
                undefined,
                floatFormat
            )} ${swap.pair.pair_name}`
        );
    } else if (swap.type === "removal") {
        const removedToken = Math.abs(swap.offered.token_amount);
        const receivedXch = Math.abs(swap.requested.xch_amount);
        const receivedToken = Math.abs(swap.requested.token_amount);

        console.log(
            `Removed ${removedToken.toLocaleString(undefined, floatFormat)} ${
                swap.pair.pair_name
            } liquidity and received ${receivedXch.toLocaleString(
                undefined,
                floatFormat
            )} XCH and ${receivedToken.toLocaleString(
                undefined,
                floatFormat
            )} ${swap.pair.short_name}`
        );
    } else if (swap.type === "consolidated") {
        printBalance(swap);
    }
}

function printBalance(balance) {
    const xchBalance = balance.balances.get("xch");
    const tokenBalance = balance.balances.get(balance.pair.asset_id);
    const swapTokenBalance = balance.balances.get(balance.pair.pair_id);

    console.log(
        `Balance of ${swapTokenBalance.toLocaleString(
            undefined,
            floatFormat
        )} ${balance.pair.pair_name}, ${xchBalance.toLocaleString(
            undefined,
            floatFormat
        )} XCH, and ${tokenBalance.toLocaleString(undefined, floatFormat)} ${
            balance.pair.short_name
        }.`
    );
}
