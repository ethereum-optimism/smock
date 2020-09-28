/* Imports: External */
import { ethers } from '@nomiclabs/buidler'
import { expect } from 'chai'
import { BigNumber } from 'ethers'
import _ from 'lodash'

/* Imports: Internal */
import {
  ModifiableContractFactory,
  ModifiableContract,
  smoddit,
} from '../../src/smoddit'

describe('smoddit', () => {
  describe('via contract factory', () => {
    describe('for functions with a single fixed return value', () => {
      let SmodFactory: ModifiableContractFactory
      before(async () => {
        SmodFactory = await smoddit('SimpleStorageGetter')
      })

      let smod: ModifiableContract
      beforeEach(async () => {
        smod = await SmodFactory.deploy()
      })

      it('should be able to return a uint256', async () => {
        const ret = 1234

        smod.smodify.put({
          _uint256: ret,
        })

        expect(await smod.getUint256()).to.equal(ret)
      })

      it('should be able to return a boolean', async () => {
        const ret = true

        smod.smodify.put({
          _bool: ret,
        })

        expect(await smod.getBool()).to.equal(ret)
      })

      it('should be able to return a simple struct', async () => {
        const ret = {
          valueA: BigNumber.from(1234),
          valueB: true,
        }

        smod.smodify.put({
          _SimpleStruct: ret,
        })

        expect(_.toPlainObject(await smod.getSimpleStruct())).to.deep.include(
          ret
        )
      })

      it('should be able to return a simple uint256 => uint256 mapping value', async () => {
        const retKey = 1234
        const retVal = 5678

        smod.smodify.put({
          _uint256Map: {
            [retKey]: retVal,
          },
        })

        expect(await smod.getUint256MapValue(retKey)).to.equal(retVal)
      })

      it('should be able to return a nested uint256 => uint256 mapping value', async () => {
        const retKeyA = 1234
        const retKeyB = 4321
        const retVal = 5678

        smod.smodify.put({
          _uint256NestedMap: {
            [retKeyA]: {
              [retKeyB]: retVal,
            },
          },
        })

        expect(await smod.getNestedUint256MapValue(retKeyA, retKeyB)).to.equal(
          retVal
        )
      })
    })
  })
})
