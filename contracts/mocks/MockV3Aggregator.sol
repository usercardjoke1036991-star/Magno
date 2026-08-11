// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

contract MockV3Aggregator {
    uint8 public decimals;
    int256 public answer;
    uint80 public roundId = 1;

    constructor(uint8 _decimals, int256 _initialAnswer) {
        decimals = _decimals;
        answer = _initialAnswer;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (roundId, answer, block.timestamp, block.timestamp, roundId);
    }

    function decimals() external view returns (uint8) {
        return decimals;
    }

    function updateAnswer(int256 _answer) external {
        answer = _answer;
        roundId += 1;
    }
}
