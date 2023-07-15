import _ from "lodash";

export default class TibetSwap {
    constructor(apiUri, analyticsUri, floatFormat) {
        this.apiUri = apiUri;
        this.analyticsUri = analyticsUri;
        this.floatFormat = floatFormat;
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

    async getQuote(token, userLiquidity) {
        // https://twitter.com/yakuh1t0/status/1679680380469940224
        const quoteResponse = await fetch(`${this.analyticsUri}/pair/${token}`);
        const quote = await quoteResponse.json();

        const tokenOut =
            (userLiquidity * quote.token_reserve) / quote.liquidity;
        const xchOut =
            userLiquidity +
            (userLiquidity * quote.xch_reserve) / quote.liquidity;

        return {
            quote: quote,
            token_out: tokenOut / 1000.0,
            token_out_mojo: tokenOut,
            token_out_string: (tokenOut / 1000.0).toLocaleString(
                undefined,
                this.floatFormat
            ),
            xch_out: xchOut / 10 ** 12,
            xch_out_mojo: xchOut,
            xch_out_string: (xchOut / 10 ** 12).toLocaleString(
                undefined,
                this.floatFormat
            ),
        };
    }
}
