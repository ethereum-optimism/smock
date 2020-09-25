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
        return "";
    }

    function getUint256()
        public
        pure
        returns (
            uint256 _out
        )
    {
        return 0;
    }

    function getBool()
        public
        pure
        returns (
            bool _out
        )
    {
        return false;
    }

    function getSimpleStruct()
        public
        pure
        returns (
            SimpleStruct memory _out
        )
    {
        return SimpleStruct({
            valueA: 0,
            valueB: false
        });
    }
}
