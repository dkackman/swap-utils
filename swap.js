import _ from "lodash";

export default class Swap {
    constructor(pair) {
        this.pair = pair;
    }

    asAddition(requestedAmount) {
        // **
        // if you add any fields here add them to the consolidateSwaps function
        // **
        return {
            type: "addition",
            pair_name: this.pair.token.pair_name,
            pair_id: this.pair.token.pair_id,
            offered: this.pair,
            requested: requestedAmount,
            // the amount of xch offered covers both the liquidity added and
            // the fee used to mint the liquidity token (burned on withdrawal)
            // the liquidity mint fee is the same as the amount of
            // the liquidity token requested (in mojo)
            liquidity_fee: requestedAmount.token_amount_mojo / 10 ** 12,
            liquidity_fee_mojo: requestedAmount.token_amount_mojo,
            // so net that out of the xch offered to get the liquidity added
            liquidity_xch_amount:
                (this.pair.xch_amount_mojo -
                    requestedAmount.token_amount_mojo) /
                10 ** 12,
            liquidity_xch_amount_mojo:
                this.pair.xch_amount_mojo - requestedAmount.token_amount_mojo,
        };
    }

    asRemoval(offeredAmount) {
        // **
        // if you add any fields here add them to the consolidateSwaps function
        // **
        return {
            type: "removal",
            pair_name: this.pair.token.pair_name,
            pair_id: this.pair.token.pair_id,
            offered: offeredAmount,
            requested: this.pair,
            liquidity_fee: 0,
            liquidity_fee_mojo: 0,
            liquidity_xch_amount: 0,
            liquidity_xch_amount_mojo: 0,
        };
    }
}
// ADDITIONS:
//        will offer two and only two items, one of which will be xch
//        and request only one item, which will NOT be xch
export function isAddition(trade) {
    return (
        Object.keys(trade.summary.offered).length === 2 &&
        trade.summary.offered.xch !== undefined &&
        Object.keys(trade.summary.requested).length === 1 &&
        trade.summary.requested.xch === undefined
    );
}
// REMOVAL:
//        will request two and only two items, one of which will be xch
//        and offer only one item, which will NOT be xch
export function isRemoval(trade) {
    return (
        Object.keys(trade.summary.offered).length === 1 &&
        trade.summary.offered.xch === undefined &&
        Object.keys(trade.summary.requested).length === 2 &&
        trade.summary.requested.xch !== undefined
    );
}

export function consolidateSwaps(swaps) {
    let grouped = _.reduce(
        swaps,
        (result, value) => {
            // this ensures we have only one object per pair
            // and creates the starter object
            if (!result[value.pair_id]) {
                result[value.pair_id] = {
                    type: "consolidated",
                    pair_name: value.pair_name,
                    pair_id: value.pair_id,
                    offered: {
                        token: value.offered.token,
                        token_amount: 0,
                        token_amount_mojo: 0,
                        xch_amount: 0,
                        xch_amount_mojo: 0,
                    },
                    requested: {
                        token_amount: 0,
                        token_amount_mojo: 0,
                    },
                    liquidity_fee: 0,
                    liquidity_fee_mojo: 0,

                    liquidity_xch_amount: 0,
                    liquidity_xch_amount_mojo: 0,
                };
            }

            // now sum up the values
            result[value.pair_id].offered.token_amount +=
                value.offered.token_amount;
            result[value.pair_id].offered.token_amount_mojo +=
                value.offered.token_amount_mojo;
            result[value.pair_id].offered.xch_amount +=
                value.offered.xch_amount;
            result[value.pair_id].offered.xch_amount_mojo +=
                value.offered.xch_amount_mojo;

            result[value.pair_id].requested.token_amount +=
                value.requested.token_amount;
            result[value.pair_id].requested.token_amount_mojo +=
                value.requested.token_amount_mojo;

            result[value.pair_id].liquidity_fee += value.liquidity_fee;
            result[value.pair_id].liquidity_fee_mojo +=
                value.liquidity_fee_mojo;
            result[value.pair_id].liquidity_xch_amount +=
                value.liquidity_xch_amount;
            result[value.pair_id].liquidity_xch_amount_mojo +=
                value.liquidity_xch_amount_mojo;

            return result;
        },
        {}
    );

    // return the resulting value array
    return _.values(grouped);
}
