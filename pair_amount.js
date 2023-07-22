export function createAmountFromMojo(tokenMojo, xchMojo) {
    return {
        token_amount: tokenMojo / 1000,
        token_amount_mojo: tokenMojo,
        xch_amount: xchMojo / 10 ** 12,
        xch_amount_mojo: xchMojo,
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

export function getAssetId(record) {
    for (const field in record) {
        if (field !== "xch") {
            return field;
        }
    }
    return "xch";
}

export function addAmounts(amount1, amount2) {
    return createAmountFromMojo(
        amount1.token_amount_mojo + amount2.token_amount_mojo,
        amount1.xch_amount_mojo + amount2.xch_amount_mojo
    );
}
