import _ from "lodash";

export default class TibetSwap {
    constructor(apiUri, analyticsUri) {
        this.apiUri = apiUri;
        this.analyticsUri = analyticsUri;
    }

    async loadTokenList() {
        try {
            const response = await fetch(`${this.apiUri}/tokens`);
            this.tokens = await response.json();
        } catch (error) {
            console.error("Error fetching data:", error);
        }
    }

    getToken(asset_id) {
        if (asset_id === "xch") {
            return {
                asset_id: "xch",
                name: "XCH",
                short_name: "XCH",
            };
        }

        const token = _.find(this.tokens, { asset_id });
        return {
            ...token,
            pair_name: `TIBET-${token.short_name}-XCH`,
        };
    }

    async estimatePairValue(pairId, amount) {
        const pairResponse = await fetch(`${this.analyticsUri}/pair/${pairId}`);
        const pair = await pairResponse.json();

        const output_reserve = pair.xch_reserve;
        const input_reserve = pair.token_reserve;

        // input_amount should be passed in token units - convert to mojo
        // also take absolute value of amount in case it's negative
        const input_amount = Math.abs(amount) * 1000;
        let output_amount =
            (993 * input_amount * output_reserve) /
            (993 * input_amount + 1000 * input_reserve);

        // add the sign back in to account for loss value
        output_amount *= Math.sign(amount);

        return {
            pair: pair,
            xch_amount: output_amount / 10 ** 12,
            xch_amount_mojo: output_amount,
        };
    }

    async getLiquidityValue(pairId, userLiquidity) {
        // https://twitter.com/yakuh1t0/status/1679680380469940224
        const pairResponse = await fetch(`${this.analyticsUri}/pair/${pairId}`);
        const pair = await pairResponse.json();

        const tokenOut = (userLiquidity * pair.token_reserve) / pair.liquidity;
        const xchOut =
            userLiquidity + (userLiquidity * pair.xch_reserve) / pair.liquidity;

        return {
            pair: pair,
            token_amount: tokenOut / 1000.0,
            token_amount_mojo: tokenOut,
            xch_amount: xchOut / 10 ** 12,
            xch_amount_mojo: xchOut,
        };
    }
}
