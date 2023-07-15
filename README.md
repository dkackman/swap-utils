# swap-utils

A small utility to show impermanent loss for swaps made on the [tibet swap liquidity provider](https://v2.tibetswap.io/).

### Thanks [yakuhito.xch](https://twitter.com/yakuh1t0)

## Install

[Node](https://nodejs.org) is a prerequisite.

```bash
# in the repo root
npm install
```

## Usage

```bash
chia swap-utils

  Shows summarized swaps for the given wallet fingerprints. The wallet must be running and unlocked.                                                         

Options

  --command string                       The command to run. 'swaps' to list    
                                         summarized swaps, 'imp' to show        
                                         impermanent loss. Defaults to 'imp'.
  -w, --host string                      The chia daemon host. 
                                         (localhost)                
  -s, --port number                      The chia daemon port. (55400)
  -k, --key_path string                  The path to the daemon private key.    
  -c, --cert_path string                 The path to the daemon certificate.    
  -f, --wallet_fingerprints number[]     Optional list of wallet fingerprints to     
                                         use.
  -a, --tibet_api_uri string             The root uri of the tibet api          
  -i, --tibet_analytics_api_uri string   The root uri of the tibet analytics    
                                         api                                    
  -t, --timeout_seconds number           The timeout in seconds for the daemon  
                                         connection.                            
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
$ npx . imp --wallet_fingerprints 1234567890 0987654321

Swapped 0.000612042913 XCH and 0.42 POTT for 0.355 TIBET-POTT-XCH
Now worth 0.000507019827 XCH and 0.518555709146 POTT
Net -0.000105023086 XCH and 0.098555709146 POTT
--------------------------------------------------
Swapped 0.429211636061 XCH and 1.061 CH21 for 1.061 TIBET-CH21-XCH
Now worth 0.44743417566 XCH and 1.043509175739 CH21
Net 0.018222539599 XCH and -0.017490824261 CH21
--------------------------------------------------
Total net 0.018117516513 XCH
