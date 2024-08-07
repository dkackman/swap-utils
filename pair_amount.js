export function createAmountFromMojo(tokenMojo, xchMojo) {
    return {
        token_amount: Number.isNaN(tokenMojo) ? 0 : tokenMojo / 1000,
        token_amount_mojo: Number.isNaN(tokenMojo) ? 0 : tokenMojo,
        xch_amount: Number.isNaN(xchMojo) ? 0 : xchMojo / 10 ** 12,
        xch_amount_mojo: Number.isNaN(xchMojo) ? 0 : xchMojo,
    };
}

export function getPairAmount(record) {
    const pairAmount = createAmountFromMojo(0, 0);
    for (const field in record) {
        if (field === "xch") {
            pairAmount.xch_amount = record.xch / 10.0 ** 12;
            pairAmount.xch_amount_mojo = record.xch;
        } else {
            // the token asset_id is the field name
            pairAmount.token_amount = record[field] / 1000.0;
            pairAmount.token_amount_mojo = record[field];
        }
    }

    return pairAmount;
}

export function negate(amount) {
    return createAmountFromMojo(
        -amount.token_amount_mojo,
        -amount.xch_amount_mojo,
    );
}

export function addAmounts(amount1, amount2) {
    return createAmountFromMojo(
        amount1.token_amount_mojo + amount2.token_amount_mojo,
        amount1.xch_amount_mojo + amount2.xch_amount_mojo,
    );
}
