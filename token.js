export function getTokenAmount(record) {
    const token = {};
    for (const field in record) {
        // the token asset_id is the field name
        token.token_amount = record[field] / 1000.0;
        token.token_amount_mojo = record[field];
    }

    return token;
}

export function getPair(tibetSwap, record) {
    const pair = {};
    for (const field in record) {
        if (field === "xch") {
            pair.xch_amount = record.xch / 10.0 ** 12;
            pair.xch_amount_mojo = record.xch;
        } else {
            // the token asset_id is the field name
            pair.token_amount = record[field] / 1000.0;
            pair.token_amount_mojo = record[field];
            pair.token = tibetSwap.getToken(field);
        }
    }

    return pair;
}
