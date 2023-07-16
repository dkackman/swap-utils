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

    async getTokenQuote(pairId, amount) {
        const pairResponse = await fetch(`${this.analyticsUri}/pair/${pairId}`);
        const quote = await pairResponse.json();

        const output_reserve = quote.xch_reserve;
        const input_reserve = quote.token_reserve;
        const input_amount = Math.abs(amount);
        let output_amount =
            (993 * input_amount * output_reserve) /
            (993 * input_amount + 1000 * input_reserve);

        output_amount *= Math.sign(amount);

        return {
            quote: quote,
            xch_out: output_amount / 10 ** 12,
            xch_out_mojo: output_amount,
        };
    }

    async getLiquidityValue(pairId, userLiquidity) {
        // https://twitter.com/yakuh1t0/status/1679680380469940224
        const pairResponse = await fetch(`${this.analyticsUri}/pair/${pairId}`);
        const quote = await pairResponse.json();

        const tokenOut =
            (userLiquidity * quote.token_reserve) / quote.liquidity;
        const xchOut =
            userLiquidity +
            (userLiquidity * quote.xch_reserve) / quote.liquidity;

        return {
            quote: quote,
            token_out: tokenOut / 1000.0,
            token_out_mojo: tokenOut,
            xch_out: xchOut / 10 ** 12,
            xch_out_mojo: xchOut,
        };
    }
}
