/* External Imports */
import chai = require('chai')
import chaiAsPromised = require('chai-as-promised')
import { solidity } from 'ethereum-waffle'

chai.use(solidity)
chai.use(chaiAsPromised)

const should = chai.should()
const expect = chai.expect

export { should, expect }
