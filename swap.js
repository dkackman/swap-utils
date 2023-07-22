import _ from "lodash";
import { createAmountFromMojo, addAmounts } from "./pair_amount.js";

export default class Swap {
    constructor(pair) {
        this.pair = pair;
    }

    asAddition(offeredAmount, requestedAmount) {
        // the amount of xch offered covers both the liquidity added and
        // the fee used to mint the liquidity token (burned on withdrawal)
        // the liquidity mint fee is the same as the amount of
        // the liquidity token requested (in mojo)
        const fee = createAmountFromMojo(
            requestedAmount.token_amount_mojo,
            offeredAmount.xch_amount_mojo - requestedAmount.token_amount_mojo
        );
        return {
            type: "addition",
            pair: this.pair,
            offered: offeredAmount,
            requested: requestedAmount,
            liquidity_fee: fee,
        };
    }

    asRemoval(offeredAmount, requestedAmount) {
        // **
        // if you add any fields here add them to the consolidateSwaps function
        // **
        return {
            type: "removal",
            pair: this.pair,
            offered: offeredAmount,
            requested: requestedAmount,
            liquidity_fee: createAmountFromMojo(0, 0),
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

function createBlank(pair) {
    return {
        type: "consolidated",
        pair: pair,
        offered: createAmountFromMojo(0, 0),
        requested: createAmountFromMojo(0, 0),
        liquidity_fee: createAmountFromMojo(0, 0),
    };
}

export function consolidateSwaps(swaps) {
    let grouped = _.reduce(
        swaps,
        (result, value) => {
            // this ensures we have only one object per pair
            // and creates the starter object
            if (!result[value.pair.pair_id]) {
                result[value.pair.pair_id] = createBlank(value.pair);
            }

            result[value.pair.pair_id].offered = addAmounts(
                result[value.pair.pair_id].offered,
                value.offered
            );
            result[value.pair.pair_id].requested = addAmounts(
                result[value.pair.pair_id].requested,
                value.requested
            );
            result[value.pair.pair_id].liquidity_fee = addAmounts(
                result[value.pair.pair_id].liquidity_fee,
                value.liquidity_fee
            );

            return result;
        },
        {}
    );

    // return the resulting value array
    return _.values(grouped);
}
