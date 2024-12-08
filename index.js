#!/usr/bin/env node
import { getLiquiditySwaps, getLiquidityBalances } from "./offers.js";
import TibetSwap from "./tibet.js";
import { options, showHelp, askUserToProceed } from "./commandLine.js";
import { getChia } from "./wallets.js";
import _ from "lodash";

const xchFloatFormat = {
    minimumFractionDigits: 0,
    maximumFractionDigits: 12,
};
const catFloatFormat = {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
};

if (options.help) {
    showHelp();
} else {
    const tibetSwap = new TibetSwap(
        options.tibet_api_uri,
        options.tibet_analytics_api_uri,
    );
    await tibetSwap.loadTokenList();

    if (options.command === "swaps") {
        await swaps(options, tibetSwap);
    } else if (options.command === "imp") {
        await impermanence(options, tibetSwap);
    } else if (options.command === "xch") {
        await xch(options, tibetSwap);
    } else if (options.command === "names") {
        await names(options, tibetSwap);
    } else if (options.command === "balances") {
        await balances(options, tibetSwap);
    } else if (options.command === "move") {
        await moveBalances(options, tibetSwap);
    } else {
        console.error(`Unknown command ${options.command}`);
        showHelp();
    }
}

async function moveBalances(options, tibetSwap) {
    console.log("Moving balances...");
    const chia = await getChia(options, tibetSwap);
    try {
        const fee = await chia.getFee();
        const walletAddress = options.wallet_address;

        const proceed = await askUserToProceed(
            options,
            `Do you want to proceed with moving balances to ${walletAddress} with a fee of ${fee} mojos? (yes/no): `,
        );

        if (!proceed) {
            console.log("Operation cancelled by the user.");
            return;
        }

        const fingerprints = await chia.getWalletBalances();

        for (const fingerprint of fingerprints) {
            console.log(`Fingerprint ${fingerprint.fingerprint}`);

            for (const balance of fingerprint.balances.filter(
                (b) => b.wallet.is_asset_wallet && b.wallet.pair.verified,
            )) {
                if (
                    options.verbose ||
                    balance.wallet_balance.spendable_balance > 0
                ) {
                    console.log(
                        `Sending ${balance.wallet_balance.spendable_balance / 1000} ${balance.wallet.pair.short_name} to ${walletAddress}`,
                    );
                    await chia.waitForSync();
                    await chia.sendCat(
                        balance.wallet.id,
                        walletAddress,
                        balance.wallet_balance.spendable_balance,
                        fee,
                    );
                }
            }
        }
    } finally {
        chia.disconnect();
    }
}

async function balances(options, tibetSwap) {
    console.log("Getting wallet balances...");
    const chia = await getChia(options, tibetSwap);
    try {
        const fingerprints = await chia.getWalletBalances();

        const filter = options["include-pair-tokens"]
            ? () => true
            : (b) => b.wallet.is_asset_wallet;

        for (const fingerprint of fingerprints) {
            console.log(`Fingerprint ${fingerprint.fingerprint}`);
            for (const balance of fingerprint.balances.filter(filter)) {
                if (
                    options.verbose ||
                    balance.wallet_balance.spendable_balance > 0
                ) {
                    console.log(
                        `\t${balance.wallet.name}: ${(
                            balance.wallet_balance.spendable_balance / 1000
                        ).toLocaleString(
                            undefined,
                            catFloatFormat,
                        )} ${balance.wallet.pair.short_name}`,
                    );
                }
            }
        }
    } finally {
        chia.disconnect();
    }
}

async function names(options, tibetSwap) {
    console.log("Setting wallet names from the tibet list...");
    const chia = await getChia(options, tibetSwap);
    try {
        await chia.setWalletNames();
    } finally {
        chia.disconnect();
    }
}

async function xch(options, tibetSwap) {
    console.log("Getting XCH balances...");
    const chia = await getChia(options, tibetSwap);
    try {
        const balances = await chia.getConsolidatedWalletBalances();
        let total = 0.0;
        for (const balance of balances) {
            total += balance.total_xch_value;
            printXchBalance(options, balance);
        }
        console.log(
            `Total: ${total.toLocaleString(undefined, xchFloatFormat)} XCH`,
        );
    } finally {
        chia.disconnect();
    }
}

function printXchBalance(options, balance) {
    if (options.verbose) {
        console.log(
            `${
                balance.pair.short_name
            }: ${balance.liquidity_xch_value.toLocaleString(
                undefined,
                xchFloatFormat,
            )} XCH liquidity and ${balance.token_xch_value.toLocaleString(
                undefined,
                xchFloatFormat,
            )} XCH worth of ${
                balance.pair.name
            }, totaling ${balance.total_xch_value.toLocaleString(
                undefined,
                xchFloatFormat,
            )} XCH`,
        );
    } else {
        console.log(
            `${
                balance.pair.short_name
            }: ${balance.total_xch_value.toLocaleString(
                undefined,
                xchFloatFormat,
            )} XCH`,
        );
    }
}

async function impermanence(options, tibetSwap) {
    const balances = await getLiquidityBalances(options, tibetSwap);

    let totalXchReturns = 0.0;

    for await (const record of balances) {
        // the current value of the liquidity held in this pair
        record.currentValue = await tibetSwap.getLiquidityValue(
            record.pair.pair_id,
            record.balances.get(record.pair.pair_id) * 1000,
        );
        // the change in xch amount
        record.netXchAmount =
            record.currentValue.xch_amount + record.balances.get("xch");

        // the change in token amount
        record.netTokenAmount =
            record.currentValue.token_amount +
            record.balances.get(record.pair.asset_id);

        // the current market value of the net amount of token
        record.pairValue = await tibetSwap.estimatePairValue(
            record.pair.pair_id,
            record.netTokenAmount,
        );

        // the total investment returns for this pair is equal to the
        // net change of xch + the current market value (in xch) of the net token amount.
        // Also, since the liquidity fee is burned on withdrawal, factor it out
        record.netXchReturns =
            record.netXchAmount +
            record.pairValue.xch_amount -
            record.balances.get("liquidity_fee_xch");
        totalXchReturns += record.netXchReturns;
    }

    if (options.json) {
        console.log(JSON.stringify(balances));
    } else {
        for (const record of balances) {
            if (options.verbose) {
                printBalance(record);
                console.log(
                    `Now worth ${record.currentValue.xch_amount.toLocaleString(
                        undefined,
                        xchFloatFormat,
                    )} XCH and ${record.currentValue.token_amount.toLocaleString(
                        undefined,
                        catFloatFormat,
                    )} ${record.pair.short_name}`,
                );
                console.log(
                    `Net change ${record.netXchAmount.toLocaleString(
                        undefined,
                        xchFloatFormat,
                    )} XCH and ${record.netTokenAmount.toLocaleString(
                        undefined,
                        catFloatFormat,
                    )} ${
                        record.pair.short_name
                    } (worth ${record.pairValue.xch_amount.toLocaleString(
                        undefined,
                        xchFloatFormat,
                    )} XCH)`,
                );
                console.log(
                    `Impermanence ${record.netXchReturns.toLocaleString(
                        undefined,
                        xchFloatFormat,
                    )} XCH`,
                );
                console.log(
                    "--------------------------------------------------",
                );
            } else {
                console.log(
                    `${
                        record.pair.short_name
                    }: ${record.netXchReturns.toLocaleString(
                        undefined,
                        xchFloatFormat,
                    )} XCH impermanence`,
                );
            }
        }
        console.log(
            `Total impermanence ${totalXchReturns.toLocaleString(
                undefined,
                xchFloatFormat,
            )} XCH`,
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
    if (options.verbose) {
        return await getLiquiditySwaps(options, tibetSwap);
    }

    return await getLiquidityBalances(options, tibetSwap);
}

function printSwap(swap) {
    if (swap.type === "addition") {
        const addedXch = Math.abs(swap.offered.xch_amount);
        const addedToken = Math.abs(swap.offered.token_amount);
        const receivedToken = Math.abs(swap.requested.token_amount);

        console.log(
            `Added ${addedXch.toLocaleString(
                undefined,
                xchFloatFormat,
            )} XCH and ${addedToken.toLocaleString(
                undefined,
                catFloatFormat,
            )} ${
                swap.pair.short_name
            } liquidity and received ${receivedToken.toLocaleString(
                undefined,
                catFloatFormat,
            )} ${swap.pair.pair_name}`,
        );
    } else if (swap.type === "removal") {
        const removedToken = Math.abs(swap.offered.token_amount);
        const receivedXch = Math.abs(swap.requested.xch_amount);
        const receivedToken = Math.abs(swap.requested.token_amount);

        console.log(
            `Removed ${removedToken.toLocaleString(
                undefined,
                catFloatFormat,
            )} ${
                swap.pair.short_name
            } liquidity and received ${receivedXch.toLocaleString(
                undefined,
                xchFloatFormat,
            )} XCH and ${receivedToken.toLocaleString(
                undefined,
                catFloatFormat,
            )} ${swap.pair.short_name}`,
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
        `Balance of ${xchBalance.toLocaleString(
            undefined,
            xchFloatFormat,
        )} XCH, ${tokenBalance.toLocaleString(undefined, catFloatFormat)} ${
            balance.pair.short_name
        }, and ${swapTokenBalance.toLocaleString(undefined, catFloatFormat)} ${
            balance.pair.pair_name
        }`,
    );
}
