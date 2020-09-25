# @eth-optimisim/smock

`smock` is a utility package that can generate mock Solidity contracts (for testing). `smock` hooks into a `ethereumjs-vm` instance so that mock contract functions can be written entirely in JavaScript. `smock` currently only supports [buidler](https://buidler.dev), but will be extended to support other testing frameworks.

## Examples

### Via `ethers.Contract`
```typescript
import { ethers } from '@nomiclabs/buidler'
import { smockit } from '@eth-optimism/smock'

const MyContractFactory = await ethers.getContractFactory('MyContract')
const MyContract = await MyContractFactory.deploy(...)

// Smockit!
const MyMockContract = smockit(MyContract)

MyMockContract.myFunction.will.return.with('Some return value!')

console.log(await MyMockContract.myFunction()) // 'Some return value!'
```

### Returning (w/o Data)
```typescript
import { ethers } from '@nomiclabs/buidler'
import { smockit } from '@eth-optimism/smock'

const MyContractFactory = await ethers.getContractFactory('MyContract')
const MyContract = await MyContractFactory.deploy(...)

// Smockit!
const MyMockContract = smockit(MyContract)

MyMockContract.myFunction.will.return()

console.log(await MyMockContract.myFunction()) // []
```

### Returning a Struct
```typescript
import { ethers } from '@nomiclabs/buidler'
import { smockit } from '@eth-optimism/smock'

const MyContractFactory = await ethers.getContractFactory('MyContract')
const MyContract = await MyContractFactory.deploy(...)

// Smockit!
const MyMockContract = smockit(MyContract)

MyMockContract.myFunction.will.return.with({
    valueA: 'Some value',
    valueB: 1234,
    valueC: true
})

console.log(await MyMockContract.myFunction()) // ['Some value', 1234, true]
```

### Returning a Function
```typescript
import { ethers } from '@nomiclabs/buidler'
import { smockit } from '@eth-optimism/smock'

const MyContractFactory = await ethers.getContractFactory('MyContract')
const MyContract = await MyContractFactory.deploy(...)

// Smockit!
const MyMockContract = smockit(MyContract)

MyMockContract.myFunction.will.return.with(() => {
  return 'Some return value!'
})

console.log(await MyMockContract.myFunction()) // ['Some return value!']
```

### Returning a Function (w/ Arguments)
```typescript
import { ethers } from '@nomiclabs/buidler'
import { smockit } from '@eth-optimism/smock'

const MyContractFactory = await ethers.getContractFactory('MyContract')
const MyContract = await MyContractFactory.deploy(...)

// Smockit!
const MyMockContract = smockit(MyContract)

MyMockContract.myFunction.will.return.with((myFunctionArgument: string) => {
  return myFunctionArgument
})

console.log(await MyMockContract.myFunction('Some return value!')) // ['Some return value!']
```

### Reverting (w/o Data)
```typescript
import { ethers } from '@nomiclabs/buidler'
import { smockit } from '@eth-optimism/smock'

const MyContractFactory = await ethers.getContractFactory('MyContract')
const MyContract = await MyContractFactory.deploy(...)

// Smockit!
const MyMockContract = smockit(MyContract)

MyMockContract.myFunction.will.revert()

console.log(await MyMockContract.myFunction()) // Revert!
```

### Reverting (w/ Data)
```typescript
import { ethers } from '@nomiclabs/buidler'
import { smockit } from '@eth-optimism/smock'

const MyContractFactory = await ethers.getContractFactory('MyContract')
const MyContract = await MyContractFactory.deploy(...)

// Smockit!
const MyMockContract = smockit(MyContract)

MyMockContract.myFunction.will.revert.with('0x1234')

console.log(await MyMockContract.myFunction('Some return value!')) // Revert!
```
