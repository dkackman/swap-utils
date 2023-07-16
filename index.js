#!/usr/bin/env node
import commandLineUsage from "command-line-usage";
import commandLineArgs from "command-line-args";
import { getLiquidityAdditions } from "./swaps.js";
import TibetSwap from "./tibet.js";

const optionsList = [
    {
        name: "command",
        type: String,
        defaultOption: true,
        defaultValue: "imp",
        description:
            "The command to run. 'swaps' to list summarized swaps, 'imp' to show impermanent loss. Defaults to 'imp'.",
    },
    {
        name: "host",
        alias: "w",
        type: String,
        defaultValue: "localhost",
        description: "The chia daemon host. (localhost)",
    },
    {
        name: "port",
        alias: "s",
        type: Number,
        defaultValue: 55400,
        description: "The chia daemon port. (55400)",
    },
    {
        name: "key_path",
        alias: "k",
        type: String,
        defaultValue: "~/.chia/mainnet/config/ssl/daemon/private_daemon.key",
        description: "The path to the daemon private key.",
    },
    {
        name: "cert_path",
        alias: "c",
        type: String,
        defaultValue: "~/.chia/mainnet/config/ssl/daemon/private_daemon.crt",
        description: "The path to the daemon certificate.",
    },
    {
        name: "wallet_fingerprints",
        multiple: true,
        alias: "f",
        type: Number,
        description: "Optional list of wallet fingerprints to use.",
    },
    {
        name: "tibet_api_uri",
        alias: "a",
        type: String,
        defaultValue: "https://api.v2.tibetswap.io",
        description: "The root uri of the tibet api",
    },
    {
        name: "tibet_analytics_api_uri",
        alias: "i",
        type: String,
        defaultValue: "https://api.info.v2.tibetswap.io",
        description: "The root uri of the tibet analytics api",
    },
    {
        name: "timeout_seconds",
        alias: "t",
        type: Number,
        defaultValue: 30,
        description: "The timeout in seconds for the wallet connection.",
    },
    {
        name: "json",
        alias: "j",
        type: Boolean,
        description: "Return results as json.",
    },
    {
        name: "help",
        alias: "h",
        type: Boolean,
        description: "Display this usage guide.",
    },
];

const options = commandLineArgs(optionsList);
const floatFormat = { minimumFractionDigits: 0, maximumFractionDigits: 12 };

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

    // for each summarized swap get a current quote
    for await (const swap of swaps) {
        const quote = await tibetSwap.getLiquidityValue(
            swap.pair_id,
            swap.requested.token_amount_mojo
        );
        swap.quote = quote;
    }

    if (options.json) {
        console.log(JSON.stringify(swaps));
    } else {
        let totalNetXchReturns = 0;
        for await (const swap of swaps) {
            // the change in xch amount from the addition to the removal
            const netXchAmount =
                swap.quote.xch_amount - swap.offered.xch_amount;
            // the change in token amount from the addition to the removal
            const netTokenAmount =
                swap.quote.token_amount - swap.offered.token_amount;
            // the current market value of the net amount of token
            const tokenQuote = await tibetSwap.getTokenQuote(
                swap.pair_id,
                netTokenAmount
            );
            // the total investment returns for this pair
            // net change of xch + the current market value in xch of the net token amount
            const netXchReturns = netXchAmount + tokenQuote.xch_amount;
            totalNetXchReturns += netXchReturns;

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
            );
            console.log(
                `Now worth ${swap.quote.xch_amount.toLocaleString(
                    undefined,
                    floatFormat
                )} XCH and ${swap.quote.token_amount.toLocaleString(
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
                } (worth ${tokenQuote.xch_amount.toLocaleString(
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
        swaps.forEach((swap) => {
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
            );
        });
    }
}

function showHelp() {
    const usage = commandLineUsage([
        {
            header: "chia swap-utils",
            content:
                "Shows summarized swaps for the given wallet fingerprints. The wallet must be running and unlocked.",
        },
        {
            header: "Options",
            optionList: optionsList,
        },
        {
            content:
                "Project home: {underline https://github.com/dkackman/swap-utils}",
        },
    ]);

    console.log(usage);
}
