import { ChiaDaemon } from "chia-daemon";
import _debug from "debug";
const debug = _debug("wallet");
import _ from "lodash";

export async function getChia(options, tibetSwap) {
    const chia = new ChiaWalletManager(options, tibetSwap);
    await chia.connect();
    return chia;
}

export class ChiaWalletManager {
    constructor(options, tibetSwap) {
        this.options = options;
        this.tibetSwap = tibetSwap;
        this.chia = null;
    }

    async connect() {
        if (this.chia !== null) {
            throw new Error("Already connected to chia daemon");
        }

        const chia = new ChiaDaemon(this.options, "swap-utils");
        if (!(await chia.connect())) {
            throw new Error("Could not connect to chia daemon");
        }

        this.chia = chia;
    }

    disconnect() {
        if (this.chia !== null) {
            this.chia.disconnect();
            this.chia = null;
        }
    }

    async waitForSync(millisecondsDelay = 10000) {
        console.log("Waiting for wallet sync...");
        let status = await this.chia.services.wallet.get_sync_status();
        while (!status.synced) {
            await new Promise((resolve) =>
                setTimeout(resolve, millisecondsDelay),
            );
            status = await this.chia.services.wallet.get_sync_status();
        }
    }

    async setWalletNames() {
        const tokenFilter = this.getFilter(this.options);
        for await (const fingerprint of this.options.wallet_fingerprints || [
            null,
        ]) {
            for await (const wallet of await this.getCATWallets(
                fingerprint,
                tokenFilter,
            )) {
                const shouldBeName = wallet.is_asset_wallet
                    ? wallet.pair.name
                    : wallet.pair.pair_name;

                if (wallet.name !== shouldBeName) {
                    console.log(
                        `Changing wallet name for ${wallet.name} to ${shouldBeName}`,
                    );
                    await this.chia.services.wallet.cat_set_name({
                        wallet_id: wallet.id,
                        name: shouldBeName,
                    });
                }
            }
        }
    }

    async getWalletBalances() {
        let fingerprints = [];
        const tokenFilter = this.getFilter(this.options);

        for await (const fingerprint of this.options.wallet_fingerprints || [
            null,
        ]) {
            const balances = await this.getBalancesForFingerprint(
                fingerprint,
                tokenFilter,
            );

            fingerprints.push({
                fingerprint: fingerprint,
                balances: balances.sort((a, b) =>
                    a.wallet.pair.pair_name.localeCompare(
                        b.wallet.pair.pair_name,
                    ),
                ),
            });
        }

        return fingerprints;
    }

    async getFee() {
        const fee = await this.chia.services.full_node.get_fee_estimate({
            target_times: [300],
            spend_type: "send_xch_transaction",
        });

        return fee.estimates[0];
    }

    async sendCat(walletId, address, amount, fee) {
        const transaction = await this.chia.services.wallet.cat_spend({
            wallet_id: walletId,
            inner_address: address,
            amount: amount,
            fee: fee,
        });

        return transaction;
    }

    async getConsolidatedWalletBalances() {
        let balances = [];
        const tokenFilter = this.getFilter(this.options);

        for await (const fingerprint of this.options.wallet_fingerprints || [
            null,
        ]) {
            for await (const wallet of await this.getCATWallets(
                fingerprint,
                tokenFilter,
            )) {
                const balance = await this.getBalance(wallet);
                balances.push(balance);
            }
        }
        balances = this.consolidateBalances(balances);
        return balances.sort((a, b) =>
            a.pair.pair_name.localeCompare(b.pair.pair_name),
        );
    }

    async getBalancesForFingerprint(fingerprint, tokenFilter) {
        const balances = [];
        for await (const wallet of await this.getCATWallets(
            fingerprint,
            tokenFilter,
        )) {
            const balance = await this.getBalance(wallet);
            balances.push(balance);
        }
        return balances;
    }

    async getCATWallets(fingerprint, tokenFilter) {
        if (fingerprint !== null) {
            await this.chia.services.wallet.log_in({
                fingerprint: fingerprint,
            });
        }
        const catWallets = await this.chia.services.wallet.get_wallets({
            type: 6,
            include_data: true,
        });
        const walletData = [];
        for (const wallet of catWallets.wallets) {
            wallet.asset_id = wallet.data.slice(0, -2);
            const pair =
                this.tibetSwap.getPairByLiquidityTokenId(wallet.asset_id) ??
                this.tibetSwap.getPairByAssetId(wallet.asset_id) ??
                this.createBlankPair(wallet);

            if (tokenFilter(pair)) {
                debug(`Found wallet for ${pair.pair_name}`);
                wallet.pair = pair;
                wallet.fingerprint = fingerprint;
                wallet.is_asset_wallet = wallet.asset_id === pair.asset_id;
                walletData.push(wallet);
            }
        }
        return walletData;
    }

    createBlankPair(wallet) {
        return {
            asset_id: wallet.asset_id,
            pair_id: wallet.asset_id,
            name: wallet.name,
            short_name: wallet.asset_id.substring(0, 5),
            image_url: "",
            verified: false,
            pair_name: "",
        };
    }

    async getBalance(wallet) {
        await this.chia.services.wallet.log_in({
            fingerprint: wallet.fingerprint,
        });
        await this.waitForSync();
        const balance = await this.chia.services.wallet.get_wallet_balance({
            wallet_id: wallet.id,
        });
        const liquidityValue = await this.tibetSwap.getLiquidityValue(
            wallet.pair.pair_id,
            balance.wallet_balance.confirmed_wallet_balance,
        );
        const pairValue = await this.tibetSwap.estimatePairValue(
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

    createBlank(pair) {
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

    consolidateBalances(balances) {
        const grouped = _.reduce(
            balances,
            (result, value) => {
                const resultRecord =
                    result[value.wallet.pair.pair_id] ??
                    this.createBlank(value.wallet.pair);

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

        return _.values(grouped);
    }

    getFilter(options) {
        return options.token === undefined
            ? () => true
            : (pair) => {
                  return (
                      pair.short_name.toUpperCase() ===
                      options.token.toUpperCase()
                  );
              };
    }
}
