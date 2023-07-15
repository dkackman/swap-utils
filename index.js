#!/usr/bin/env node
import commandLineUsage from "command-line-usage";
import commandLineArgs from "command-line-args";
import { getSwaps } from "./swaps.js";
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
        description: "The path to the wallet private key.",
    },
    {
        name: "cert_path",
        alias: "c",
        type: String,
        defaultValue: "~/.chia/mainnet/config/ssl/daemon/private_daemon.crt",
        description: "The path to the wallet certificate.",
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
        options.tibet_analytics_api_uri,
        floatFormat
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
    const swaps = await getSwaps(
        options,
        options.wallet_fingerprints,
        tibetSwap,
        floatFormat
    );

    if (!swaps) {
        console.error("Could not connect to wallet");
        return;
    }

    // for each summarized swap get a current quote
    for await (const swap of swaps) {
        const quote = await tibetSwap.getQuote(
            swap.pair_id,
            swap.requested.token_amount_mojo
        );
        swap.quote = quote;
    }

    if (options.json) {
        console.log(JSON.stringify(swaps));
    } else {
        let totalNetXchAmount = 0;
        for await (const swap of swaps) {
            console.log(
                `Swapped ${swap.offered.xch_amount_string} XCH and ${swap.offered.token_amount_string} ${swap.offered.token.short_name} for ${swap.requested.token_amount_string} ${swap.pair_name}`
            );
            console.log(
                `Now worth ${swap.quote.xch_out_string} XCH and ${swap.quote.token_out_string} ${swap.offered.token.short_name}`
            );
            const netXchAmount = swap.quote.xch_out - swap.offered.xch_amount;
            totalNetXchAmount += netXchAmount;
            const netXch = netXchAmount.toLocaleString(undefined, floatFormat);

            const netToken = (
                swap.quote.token_out - swap.offered.token_amount
            ).toLocaleString(undefined, floatFormat);
            console.log(
                `Net ${netXch} XCH and ${netToken} ${swap.offered.token.short_name}`
            );
            console.log("--------------------------------------------------");
        }
        console.log(
            `Total net ${totalNetXchAmount.toLocaleString(
                undefined,
                floatFormat
            )} XCH`
        );
    }
}

async function dumpSwaps(options, tibetSwap) {
    const swaps = await getSwaps(
        options,
        options.wallet_fingerprints,
        tibetSwap,
        floatFormat
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
                `Swapped ${swap.offered.xch_amount_string} XCH and ${swap.offered.token_amount_string} ${swap.offered.token.short_name} for ${swap.requested.token_amount_string} ${swap.pair_name}`
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
