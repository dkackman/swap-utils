import commandLineUsage from "command-line-usage";
import commandLineArgs from "command-line-args";
import * as readline from "node:readline/promises";

const commandList = [
    {
        name: "command",
        type: String,
        defaultOption: true,
        defaultValue: "imp",
        description:
            "The command to run:\n" +
            "swaps\tShow liquidity swaps.\n" +
            "imp\tShow estimated impermanent loss.\n" +
            "xch\tShow the estimated XCH value of current liquidity.\n" +
            "names\tSet wallet names from the tibet list.\n" +
            "balances\tShow the balance of CAT wallets\n" +
            "move\tSend the balance of tibet verified CAT wallets to a single address\n",
    },
];

const optionsList = [
    {
        name: "token",
        alias: "n",
        type: String,
        defaultValue: undefined,
        typeLabel: "(token symbol)",
        description: "Limit the output to this token.",
    },
    {
        name: "verbose",
        alias: "v",
        type: Boolean,
        defaultValue: false,
        description: "Show verbose details.",
    },
    {
        name: "no-prompt",
        type: Boolean,
        defaultValue: false,
        description: "Suppress prompts.",
    },
    {
        name: "include-pair-tokens",
        type: Boolean,
        defaultValue: false,
        description: "Include tibet pair tokens when showing balances.",
    },
    {
        name: "host",
        alias: "d",
        type: String,
        defaultValue: "localhost",
        description: "The chia daemon host. (localhost)",
    },
    {
        name: "port",
        alias: "p",
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
        description: "Optional list of wallet fingerprints.",
    },
    {
        name: "wallet_address",
        alias: "w",
        type: String,
        description: "A wallet address to send CATs to.",
    },
    {
        name: "tibet_api_uri",
        alias: "a",
        type: String,
        defaultValue: "https://api.v2.tibetswap.io",
        description: "The uri of the tibet api",
    },
    {
        name: "tibet_analytics_api_uri",
        alias: "i",
        type: String,
        defaultValue: "https://api.info.v2.tibetswap.io",
        description: "The uri of the tibet analytics api",
    },
    {
        name: "mintgarden_api_uri",
        alias: "m",
        type: String,
        defaultValue: "https://api.mintgarden.io/",
        description: "The uri of the mint garden api",
    },
    {
        name: "timeout_seconds",
        alias: "t",
        type: Number,
        defaultValue: 30,
        description: "The timeout for the wallet connection.",
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

export const options = commandLineArgs(commandList.concat(optionsList));

export function showHelp() {
    const usage = commandLineUsage([
        {
            header: "chia swap-utils",
            content:
                "Shows summarized swaps and estimated impermanent loss for the given wallet fingerprints. The wallet must be running and unlocked.",
        },
        {
            header: "Commands",
            optionList: commandList,
        },
        {
            header: "Options (defaults to Tibet production and localhost chia)",
            optionList: optionsList,
        },
        {
            content:
                "Project home: {underline https://github.com/dkackman/swap-utils}",
        },
    ]);

    console.log(usage);
}

export async function askUserToProceed(options, question) {
    if (options["no-prompt"]) {
        return true;
    }

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    const answer = await rl.question(question);
    rl.close();
    return answer.toLowerCase() === "yes" || answer.toLowerCase() === "y";
}

