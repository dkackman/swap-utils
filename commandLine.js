import commandLineUsage from "command-line-usage";
import commandLineArgs from "command-line-args";

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

export const options = commandLineArgs(optionsList);

export function showHelp() {
    const usage = commandLineUsage([
        {
            header: "chia swap-utils",
            content:
                "Shows summarized swaps and impermanent loss for the given wallet fingerprints. The wallet must be running and unlocked.",
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
