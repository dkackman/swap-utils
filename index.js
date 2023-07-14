#!/usr/bin/env node
import commandLineUsage from "command-line-usage";
import commandLineArgs from "command-line-args";
import { dumpOffers } from "./dump.js";
import { loadTokens } from "./tibet.js";

const optionsList = [
    {
        name: "command",
        type: String,
        defaultOption: true,
        defaultValue: "dump",
        description: "The command to run.",
    },
    {
        name: "wallet_host",
        alias: "w",
        type: String,
        defaultValue: "localhost",
        description: "The host of the wallet",
    },
    {
        name: "wallet_port",
        alias: "s",
        type: Number,
        defaultValue: 55400,
        description: "The port of the wallet",
    },
    {
        name: "key_path",
        alias: "k",
        type: String,
        defaultValue: "~/.chia/mainnet/config/ssl/daemon/private_daemon.key",
        description: "The path to the wallet private key",
    },
    {
        name: "cert_path",
        alias: "c",
        type: String,
        defaultValue: "~/.chia/mainnet/config/ssl/daemon/private_daemon.crt",
        description: "The path to the wallet certificate",
    },
    {
        name: "wallet_fingerprints",
        multiple: true,
        alias: "f",
        type: Number,
        description:
            "The list of wallet fingerprints to connect to. If left out will use the default.",
    },
    {
        name: "tibet_api_uri",
        alias: "a",
        type: String,
        defaultValue: "https://api.v2.tibetswap.io/",
        description: "The root uri of the tibet api",
    },
    {
        name: "timeout",
        alias: "t",
        type: Number,
        defaultValue: 30,
        description: "The timeout in seconds for the wallet connection",
    },
    {
        name: "help",
        alias: "h",
        type: Boolean,
        description: "Display this usage guide.",
    },
];

const options = commandLineArgs(optionsList);

if (options.help) {
    showHelp();
} else {
    await loadTokens(`${options.tibet_api_uri}tokens`);

    const connected = await dumpOffers(
        {
            host: options.wallet_host,
            port: options.wallet_port,
            key_path: options.key_path,
            cert_path: options.cert_path,
            timeout_seconds: options.timeout,
        },
        options.wallet_fingerprints
    );

    if (!connected) {
        console.error("Could not connect to wallet");
    }
}

function showHelp() {
    const usage = commandLineUsage([
        {
            header: "chia swap-utils",
            content:
                "Shows all completed swaps for a given wallet fingerprint.  The wallet must be running and unlocked.",
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
