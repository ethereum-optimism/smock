/* Imports: External */
import { ethers } from '@nomiclabs/buidler'
import { expect } from 'chai'
import { BigNumber, Contract } from 'ethers'
import _ from 'lodash'

/* Imports: Internal */
import { MockContract, smockit } from '../../src/smockit'

describe('smock', () => {
  describe('from contract', () => {
    describe('for functions with a single fixed return value', () => {
      let SimpleGetter: Contract
      let mock: MockContract
      before(async () => {
        SimpleGetter = await (
          await ethers.getContractFactory('SimpleGetter')
        ).deploy()
        mock = await smockit(SimpleGetter)
      })

      it('should be able to return a string', async () => {
        const ret = 'Hello world!'

        mock.smocked.getString.will.return.with(ret)

        expect(await mock.getString()).to.equal(ret)
      })

      it('should be able to return a uint256', async () => {
        const ret = 1234

        mock.smocked.getUint256.will.return.with(ret)

        expect(await mock.getUint256()).to.equal(ret)
      })

      it('should be able to return a boolean', async () => {
        const ret = true

        mock.smocked.getBool.will.return.with(ret)

        expect(await mock.getBool()).to.equal(ret)
      })

      it('should be able to return a simple struct', async () => {
        const ret = {
          valueA: BigNumber.from(1234),
          valueB: true,
        }

        mock.smocked.getSimpleStruct.will.return.with(ret)

        expect(_.toPlainObject(await mock.getSimpleStruct())).to.deep.include(
          ret
        )
      })

      it('should be able to do reverts', async () => {
        mock.smocked.getString.will.revert()

        await expect(mock.getString()).to.be.reverted
      })
    })
  })
})
