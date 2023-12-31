import { ChiaDaemon } from "chia-daemon";
import _debug from "debug";
const debug = _debug("wallet");
import _ from "lodash";

export async function setWalletNames(options, tibetSwap) {
    const chia = new ChiaDaemon(options, "swap-utils");
    if (!(await chia.connect())) {
        throw new Error("Could not connect to chia daemon");
    }

    try {
        const tokenFilter = getFilter(options);
        for await (const fingerprint of options.wallet_fingerprints || [null]) {
            // get all swap offers from all specified wallets
            for await (const wallet of await getCATWallets(
                chia,
                fingerprint,
                tibetSwap,
                tokenFilter,
            )) {
                const shouldBeName = wallet.is_asset_wallet
                    ? wallet.pair.name // the asset name
                    : wallet.pair.pair_name; // the swap token name

                if (wallet.name !== shouldBeName) {
                    console.log(
                        `Changing wallet name for ${wallet.name} to ${shouldBeName}`,
                    );
                    await chia.services.wallet.cat_set_name({
                        wallet_id: wallet.id,
                        name: shouldBeName,
                    });
                }
            }
        }
    } finally {
        chia.disconnect();
    }
}

export async function getWalletBalances(options, tibetSwap) {
    const chia = new ChiaDaemon(options, "swap-utils");
    if (!(await chia.connect())) {
        throw new Error("Could not connect to chia daemon");
    }

    try {
        let balances = [];
        const tokenFilter = getFilter(options);

        for await (const fingerprint of options.wallet_fingerprints || [null]) {
            // get all swap offers from all specified wallets
            for await (const wallet of await getCATWallets(
                chia,
                fingerprint,
                tibetSwap,
                tokenFilter,
            )) {
                const balance = await getBalance(chia, wallet, tibetSwap);
                balances.push(balance);
            }
        }
        balances = consolidateBalances(balances);
        return balances.sort((a, b) =>
            a.pair.pair_name.localeCompare(b.pair.pair_name),
        );
    } finally {
        chia.disconnect();
    }
}

async function getCATWallets(chia, fingerprint, tibetSwap, tokenFilter) {
    // null signals just do the default wallet
    // otherwise we need to login to the wallet
    if (fingerprint !== null) {
        await chia.services.wallet.log_in({
            fingerprint: fingerprint,
        });
    }
    const wallets = await chia.services.wallet.get_wallets({
        type: 6,
        include_data: true,
    });
    const returns = [];
    for (const wallet of wallets.wallets) {
        wallet.asset_id = wallet.data.slice(0, -2); // trailing unicode null char
        const pair =
            tibetSwap.getPairByLiquidityTokenId(wallet.asset_id) ??
            tibetSwap.getPairByAssetId(wallet.asset_id);

        if (pair !== undefined && tokenFilter(pair)) {
            debug(`Found wallet for ${pair.pair_name}`);
            wallet.pair = pair;
            wallet.fingerprint = fingerprint;
            wallet.is_asset_wallet = wallet.asset_id === pair.asset_id;
            returns.push(wallet);
        }
    }
    return returns;
}

async function getBalance(chia, wallet, tibetSwap) {
    await chia.services.wallet.log_in({
        fingerprint: wallet.fingerprint,
    });
    const balance = await chia.services.wallet.get_wallet_balance({
        wallet_id: wallet.id,
    });
    const liquidityValue = await tibetSwap.getLiquidityValue(
        wallet.pair.pair_id,
        balance.wallet_balance.confirmed_wallet_balance, // convert from tokens to mojo
    );
    const pairValue = await tibetSwap.estimatePairValue(
        wallet.pair.pair_id,
        liquidityValue.token_amount,
    );
    return {
        wallet: wallet,
        wallet_balance: balance.wallet_balance,
        liquidity_value: liquidityValue,
        token_value: pairValue,
        total_xch_value: liquidityValue.xch_amount + pairValue.xch_amount,
    };
}

function createBlank(pair) {
    return {
        type: "wallet_balance",
        pair: pair,
        liquidity_token: 0,
        liquidity_xch_value: 0,
        liquidity_token_value: 0,
        token_xch_value: 0,
        total_xch_value: 0,
    };
}

function consolidateBalances(balances) {
    const grouped = _.reduce(
        balances,
        (result, value) => {
            // this ensures we have only one object per pair
            // and creates the starter object
            const resultRecord =
                result[value.wallet.pair.pair_id] ??
                createBlank(value.wallet.pair);

            resultRecord.liquidity_token +=
                value.wallet_balance.confirmed_wallet_balance;
            resultRecord.liquidity_xch_value +=
                value.liquidity_value.xch_amount;
            resultRecord.liquidity_token_value +=
                value.liquidity_value.token_amount;
            resultRecord.token_xch_value += value.token_value.xch_amount;
            resultRecord.total_xch_value += value.total_xch_value;

            result[value.wallet.pair.pair_id] = resultRecord;
            return result;
        },
        {},
    );

    // return the resulting value array
    return _.values(grouped);
}

function getFilter(options) {
    return options.token === undefined
        ? () => true
        : (pair) => {
              return (
                  pair.short_name.toUpperCase() === options.token.toUpperCase()
              );
          };
}
