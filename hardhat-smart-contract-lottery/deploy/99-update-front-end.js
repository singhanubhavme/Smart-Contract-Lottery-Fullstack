const { ethers, network } = require("hardhat");
const fs = require("fs");

const FRONT_END_ADDRESSES_FILE = "C:/Users/singh/Desktop/hardhat/hardhat-smart-contract-lottery-fullstack/nextjs-smart-contract-lottery/constants/contractAddresses.json";
const FRONT_END_ABI_FILE = "C:/Users/singh/Desktop/hardhat/hardhat-smart-contract-lottery-fullstack/nextjs-smart-contract-lottery/constants/abi.json";

const updateContractAddresses = async ()=>{
    const raffle = await ethers.getContract("Raffle");
    const chainId = network.config.chainId.toString();
    const currentAddresses = JSON.parse(fs.readFileSync(FRONT_END_ADDRESSES_FILE, "utf8"));
    if(chainId in currentAddresses){
        if(!currentAddresses[chainId].includes(raffle.address)){
            currentAddresses[chainId].push(raffle.address);
        }
    }
    currentAddresses[chainId] = [raffle.address];
    fs.writeFileSync(FRONT_END_ADDRESSES_FILE, JSON.stringify(currentAddresses));
}

const updateAbi = async ()=>{
    const raffle =await ethers.getContract("Raffle");
    fs.writeFileSync(FRONT_END_ABI_FILE, raffle.interface.format(ethers.utils.FormatTypes.json));
}

module.exports = async ()=>{
    if(process.env.UPDATE_FRONT_END){
        console.log("Updating Frontend");
        await updateContractAddresses();
        await updateAbi();
    }
}

module.exports.tags = ["all", "frontend"];