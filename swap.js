import _ from "lodash";
import { createAmountFromMojo, getPairAmount, negate } from "./pair_amount.js";

export default class Swap {
    constructor(pair, trade) {
        this.pair = pair;
        this.trade = trade;
    }

    asRecord() {
        if (isAddition(this.trade)) {
            return this.asAddition(
                getPairAmount(this.trade.summary.offered),
                getPairAmount(this.trade.summary.requested)
            );
        }

        if (isRemoval(this.trade)) {
            return this.asRemoval(
                getPairAmount(this.trade.summary.offered),
                getPairAmount(this.trade.summary.requested)
            );
        }

        return undefined;
    }

    asAddition(offeredAmount, requestedAmount) {
        // the amount of xch offered covers both the liquidity added and
        // the fee used to mint the liquidity token (burned on withdrawal)
        // the liquidity mint fee is the same as the amount of
        // the liquidity token requested (in mojo)
        const fee = createAmountFromMojo(
            0,
            requestedAmount.token_amount_mojo / 1000 // need to convert to mojo
        );
        return {
            type: "addition",
            pair: this.pair,
            offered: negate(offeredAmount),
            requested: requestedAmount,
            liquidity_fee: negate(fee),
        };
    }

    asRemoval(offeredAmount, requestedAmount) {
        return {
            type: "removal",
            pair: this.pair,
            offered: negate(offeredAmount),
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
        balances: new Map([
            ["xch", 0.0],
            ["liquidity_fee_xch", 0.0],
            [pair.asset_id, 0.0],
            [pair.pair_id, 0.0],
        ]),
    };
}

export function consolidateSwaps(swaps) {
    const grouped = _.reduce(
        swaps,
        (result, value) => {
            // this ensures we have only one object per pair
            // and creates the starter object
            const resultRecord =
                result[value.pair.pair_id] ?? createBlank(value.pair);

            resultRecord.balances.set(
                "xch",
                resultRecord.balances.get("xch") +
                    value.offered.xch_amount +
                    value.requested.xch_amount
            );
            resultRecord.balances.set(
                "liquidity_fee_xch",
                resultRecord.balances.get("liquidity_fee_xch") +
                    value.liquidity_fee.xch_amount
            );

            // look closely at this next bit before changing
            // when adding liquidity the offer has the CAT
            // and the requested is the liquidity token (TIBET-???-TOKEN)
            // On removing liquidity the offer and request are reversed
            if (value.type === "addition") {
                resultRecord.balances.set(
                    value.pair.asset_id,
                    resultRecord.balances.get(value.pair.asset_id) +
                        value.offered.token_amount
                );
                resultRecord.balances.set(
                    value.pair.pair_id,
                    resultRecord.balances.get(value.pair.pair_id) +
                        value.requested.token_amount
                );
            } else if (value.type === "removal") {
                resultRecord.balances.set(
                    value.pair.asset_id,
                    resultRecord.balances.get(value.pair.asset_id) +
                        value.requested.token_amount
                );
                resultRecord.balances.set(
                    value.pair.pair_id,
                    resultRecord.balances.get(value.pair.pair_id) +
                        value.offered.token_amount
                );
            } else {
                throw new Error(`Unknown swap type: ${value.type}`);
            }

            result[value.pair.pair_id] = resultRecord;
            return result;
        },
        {}
    );

    // return the resulting value array
    return _.values(grouped);
}
