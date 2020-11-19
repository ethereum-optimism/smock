import { HardhatUserConfig } from 'hardhat/config'

import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-waffle'
import './src/plugins/hardhat-storagelayout'

const config: HardhatUserConfig = {
  paths: {
    sources: './test/contracts',
  },
  solidity: {
    version: '0.7.0',
  },
}

export default config
