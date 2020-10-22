// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

contract SimpleGetter {
    struct SimpleStruct {
        uint256 valueA;
        bool valueB;
    }

    function getString()
        public
        pure
        returns (
            string memory _out
        )
    {
        return _out;
    }

    function getBytes()
        public
        pure
        returns (
            bytes memory _out
        )
    {
        return _out;
    }

    function getUint256()
        public
        pure
        returns (
            uint256 _out
        )
    {
        return _out;
    }

    function getBool()
        public
        pure
        returns (
            bool _out
        )
    {
        return _out;
    }

    function getSimpleStruct()
        public
        pure
        returns (
            SimpleStruct memory _out
        )
    {
        return _out;
    }

    function getUint256Array()
        public
        pure
        returns (
            uint256[] memory _out
        )
    {
        return _out;
    }

    function getUint256Tuple()
        public
        pure
        returns (
            uint256 _outA, uint256 _outB
        )
    {
        return (_outA, _outB);
    }
}
