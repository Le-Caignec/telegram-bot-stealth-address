// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Escrow {
    address public owner;

    // Montant total envoyé par chaque utilisateur (ETH natif)
    mapping(address => uint256) public lockedBalance;

    // Montant "investi" parmi les fonds bloqués
    mapping(address => uint256) public investedBalance;

    constructor() {
        owner = msg.sender;
    }

    // Utilisateur envoie de l'ETH qui est locké
    function lockFunds() external payable {
        require(msg.value > 0, "No ETH sent");
        lockedBalance[msg.sender] += msg.value;
    }

    // Marquer une partie des fonds comme "investis" par la Dapp
    //TODO - Add modifier
    function markAsInvested(address user, uint256 amount) external {
        require(amount <= getAvailableToInvest(user), "Not enough available");
        investedBalance[user] += amount;
    }

    // Lire combien l'utilisateur peut encore investir
    function getAvailableToInvest(address user) public view returns (uint256) {
        return lockedBalance[user] - investedBalance[user];
    }

    // Permet au propriétaire de retirer tout l'ETH du contrat (optionnel)
    // TODO: Add modifier
    function emergencyWithdraw() external {
        payable(owner).transfer(address(this).balance);
    }

    // Permet de lire le solde total du contrat
    function getContractBalance() public view returns (uint256) {
        return address(this).balance;
    }
}
