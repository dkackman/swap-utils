import _ from "lodash";
import { isAddition, isRemoval } from "./swap.js";
import { createAmountFromMojo } from "./pair_amount.js";
import Cache from "./cache.js";
import _debug from "debug";
const debug = _debug("tibet");

export default class TibetSwap {
    constructor(apiUri, analyticsUri) {
        this.apiUri = apiUri;
        this.analyticsUri = analyticsUri;
    }

    async loadTokenList() {
        console.log("Loading token list...");
        const cache = new Cache(this.apiUri, this.analyticsUri);
        const cacheData = await cache.loadTokenList();
        this.tokens = cacheData.tokens;
        this.pairs = cacheData.pairs;
    }

    getPairFromTrade(trade) {
        if (isAddition(trade)) {
            return this.getPairByAssetId(getAssetId(trade.summary.offered));
        }

        if (isRemoval(trade)) {
            return this.getPairByAssetId(getAssetId(trade.summary.requested));
        }

        console.error("Could not find pair for trade", trade);
        return undefined;
    }

    getPairByLiquidityTokenId(liquidityTokenId) {
        const pair = _.find(this.pairs, {
            liquidity_asset_id: liquidityTokenId,
        });
        if (pair === undefined) {
            debug("Could not find pair for liquidity token", liquidityTokenId);
            return undefined;
        }

        return this.getPairByAssetId(pair.asset_id);
    }

    getPairByAssetId(assetId) {
        if (assetId === "xch") {
            return {
                asset_id: "xch",
                name: "XCH",
                short_name: "XCH",
                verified: true,
            };
        }

        const token = _.find(this.tokens, { asset_id: assetId });
        if (token === undefined) {
            debug("Could not find pair for asset", assetId);
            return undefined;
        }

        return {
            ...token,
            verified: true,
            pair_name: `TIBET-${token.short_name}-XCH`,
        };
    }

    async estimatePairValue(pairId, amount) {
        if (amount === 0) {
            return createAmountFromMojo(0, 0);
        }

        const pairResponse = await fetch(`${this.analyticsUri}/pair/${pairId}`);
        const pair = await pairResponse.json();

        const output_reserve = pair.xch_reserve;
        const input_reserve = pair.token_reserve;

        // amount should be passed in token units - convert to mojo
        const input_amount = amount * 1000;
        if (input_amount > output_reserve) {
            return createAmountFromMojo(0, 0);
        }

        if (input_amount > 0) {
            const output_amount =
                (993 * input_amount * output_reserve) /
                (993 * input_amount + 1000 * input_reserve);

            return createAmountFromMojo(0, output_amount);
        }

        const numerator = input_reserve * input_amount;
        const denominator = (output_reserve - input_amount) * 993;

        return createAmountFromMojo(0, Math.floor(numerator / denominator) + 1);
    }

    getOutputPrice(output_amount, input_reserve, output_reserve) {
        if (output_amount > output_reserve) {
            return 0;
        }
        if (output_amount == 0) return 0;

        const numerator = input_reserve * output_amount * 1000;
        const denominator = (output_reserve - output_amount) * 993;
        return Math.floor(numerator / denominator) + 1;
    }

    async getLiquidityValue(pairId, userLiquidity) {
        // https://twitter.com/yakuh1t0/status/1679680380469940224
        const pairResponse = await fetch(`${this.analyticsUri}/pair/${pairId}`);
        const pair = await pairResponse.json();

        const tokenOut = (userLiquidity * pair.token_reserve) / pair.liquidity;
        const xchOut =
            userLiquidity + (userLiquidity * pair.xch_reserve) / pair.liquidity;

        return createAmountFromMojo(tokenOut, xchOut);
    }
}

export function getAssetId(record) {
    for (const field in record) {
        if (field !== "xch") {
            return field;
        }
    }
    return "xch";
}
