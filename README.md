# swap-utils

A small utility to show swap details, estimated xch value, and estimated impermanent loss for liquidity swaps on the [tibet swap liquidity provider](https://v2.tibetswap.io/).

### Thanks [yakuhito.xch](https://twitter.com/yakuh1t0)

## Install

[Node](https://nodejs.org) is a prerequisite.

```bash
# in the repo root
npm install
```

## Usage

It's not published on npmjs, so you'll need to run it from the repo root with `npx .`

```bash
chia swap-utils

  Shows summarized swaps and estimated impermanent loss for the given wallet
  fingerprints. The wallet must be running and unlocked.

Commands

  --command string   The command to run:
                     swaps  Show liquidity swaps.
                     imp    Show estimated impermanent loss.
                     xch    Show the estimated XCH value of current liquidity.
                     names  Set wallet names from the tibet list.

Options (defaults to Tibet production and localhost chia)

  -n, --token (token symbol)             Limit the output to this token.
  -v, --verbose                          Show verbose details.
  -d, --host string                      The chia daemon host. (localhost)
  -p, --port number                      The chia daemon port. (55400)
  -k, --key_path string                  The path to the daemon private key.
  -c, --cert_path string                 The path to the daemon certificate.
  -f, --wallet_fingerprints number[]     Optional list of wallet fingerprints.
  -a, --tibet_api_uri string             The uri of the tibet api
  -i, --tibet_analytics_api_uri string   The uri of the tibet analytics api
  -t, --timeout_seconds number           The timeout for the wallet connection.
  -j, --json                             Return results as json.
  -h, --help                             Display this usage guide.

  Project home: https://github.com/dkackman/swap-utils
```

## Examples

```bash
# from the repo root

# shows summarized swaps for the default wallet
$ npx . swaps

Swapped 0.000612042913 XCH and 0.42 POTT for 0.355 TIBET-POTT-XCH
Swapped 0.429211636061 XCH and 1.061 CH21 for 1.061 TIBET-CH21-XCH

# shows impermanent loss for swaps across two wallets
$ npx . imp --wallet_fingerprints 1234567890 0987654321 --verbose

Swapped 0.000612042913 XCH and 0.42 POTT for 0.355 TIBET-POTT-XCH
Now worth 0.000507019827 XCH and 0.518555709146 POTT
Net -0.000105023086 XCH and 0.098555709146 POTT
--------------------------------------------------
Swapped 0.429211636061 XCH and 1.061 CH21 for 1.061 TIBET-CH21-XCH
Now worth 0.44743417566 XCH and 1.043509175739 CH21
Net 0.018222539599 XCH and -0.017490824261 CH21
--------------------------------------------------
Total net 0.018117516513 XCH

# shows the estimated XCH value of current liquidity
$ npx . xch --token ALGOLD
ALGOLD: 0.00006835841 XCH
Total: 0.00006835841 XCH
