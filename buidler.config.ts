import { usePlugin, BuidlerConfig } from '@nomiclabs/buidler/config'

usePlugin('@nomiclabs/buidler-ethers')
usePlugin('@nomiclabs/buidler-waffle')

const config: BuidlerConfig = {
  paths: {
    sources: './test/contracts',
  },
  solc: {
    version: '0.7.0',
    optimizer: { enabled: true, runs: 200 },
  },
}

export default config
