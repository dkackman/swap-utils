import _ from "lodash";
import { isAddition, isRemoval } from "./swap.js";
import { createAmountFromMojo } from "./pair_amount.js";
import _debug from "debug";
const debug = _debug("tibet");

export default class TibetSwap {
    constructor(apiUri, analyticsUri) {
        this.apiUri = apiUri;
        this.analyticsUri = analyticsUri;
    }

    async loadTokenList() {
        const tokensResponse = await fetch(`${this.apiUri}/tokens`);
        this.tokens = await tokensResponse.json();

        const pairsResponse = await fetch(`${this.apiUri}/pairs?limit=500`);
        this.pairs = await pairsResponse.json();
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
            };
        }

        const token = _.find(this.tokens, { asset_id: assetId });
        if (token === undefined) {
            debug("Could not find pair for asset", assetId);
            return undefined;
        }

        return {
            ...token,
            pair_name: `TIBET-${token.short_name}-XCH`,
        };
    }

    async estimatePairValue(pairId, amountMojo) {
        const pairResponse = await fetch(`${this.analyticsUri}/pair/${pairId}`);
        const pair = await pairResponse.json();

        const output_reserve = pair.xch_reserve;
        const input_reserve = pair.token_reserve;

        // input_amount should be passed in token units - convert to mojo
        // also take absolute value of amount in case it's negative
        const input_amount = Math.abs(amountMojo) * 1000;
        let output_amount =
            (993 * input_amount * output_reserve) /
            (993 * input_amount + 1000 * input_reserve);

        // add the sign back in to account for loss value
        output_amount *= Math.sign(amountMojo);

        return createAmountFromMojo(0, output_amount);
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
