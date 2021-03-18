import { expect } from '../setup'

/* Imports: External */
import { ethers } from 'hardhat'
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

      it('should be able to return bytes', async () => {
        const ret = '0x1234123412341234'

        mock.smocked.getBytes.will.return.with(ret)

        expect(await mock.getBytes()).to.equal(ret)
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

        const result = _.toPlainObject(await mock.getSimpleStruct())
        expect(result.valueA).to.deep.equal(ret.valueA)
        expect(result.valueB).to.deep.equal(ret.valueB)
      })

      it('should be able to return an array', async () => {
        const ret = [BigNumber.from(1234), BigNumber.from(4321)]

        mock.smocked.getUint256Array.will.return.with(ret)

        const result = _.toPlainObject(await mock.getUint256Array())
        expect(result[0]).to.deep.equal(ret[0])
        expect(result[1]).to.deep.equal(ret[1])
      })

      it('should be able to return a tuple', async () => {
        const ret = [BigNumber.from(1234), BigNumber.from(4321)]

        mock.smocked.getUint256Tuple.will.return.with(ret)

        const result = _.toPlainObject(await mock.getUint256Tuple())
        expect(result[0]).to.deep.equal(ret[0])
        expect(result[1]).to.deep.equal(ret[1])
      })

      it('should be able to do reverts', async () => {
        mock.smocked.getString.will.revert()

        await expect(mock.getString()).to.be.reverted
      })
    })
  })
})
