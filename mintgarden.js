import _debug from "debug";
const debug = _debug("mintgarden");

export default class MintGarden {
    constructor(apiUri) {
        this.apiUri = apiUri;
    }

    async getToken(tokenId) {
        try {
            const response = await fetch(`${this.apiUri}tokens/${tokenId}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch token ${tokenId}`);
            }

            return response.json();
        } catch (error) {
            return null;
        }
    }
}
