const { assert, expect } = require("chai");
const { network, getNamedAccounts, deployments, ethers } = require("hardhat");
const { developmentChains, networkConfig } = require("../../helper-hardhat-config");

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle", () => {
        let raffle, vrfCoordinatorV2Mock, raffleEntranceFee, deployer, interval;
        const chainId = network.config.chainId;

        beforeEach(async () => {
            deployer = (await getNamedAccounts()).deployer;
            await deployments.fixture(["all"]);
            raffle = await ethers.getContract("Raffle", deployer);
            vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer);
            raffleEntranceFee = await raffle.getEntranceFee();
            interval = await raffle.getInterval();
        })

        describe("constructor", () => {
            it("initializes the raffle correctly", async () => {
                // ideally 1 assets per "it"
                const raffleState = await raffle.getRaffleState();
                assert.equal(raffleState.toString(), "0");
                assert.equal(interval.toString(), networkConfig[chainId]["interval"]);
                // write tests for all the variables in constructor
            })
        })

        describe("enterRaffle", () => {
            it("revert when you don't pay enough", async () => {
                await expect(raffle.enterRaffle()).to.be.revertedWith(
                    "Raffle__NotEnoughETHEntered"
                )
            });

            it("records players when they enter", async () => {
                await raffle.enterRaffle(
                    { value: raffleEntranceFee }
                );
                const playerFromContract = await raffle.getPlayer(0);
                assert.equal(playerFromContract, deployer);
            })

            it("emits event on enter", async () => {
                await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.emit(raffle, "RaffleEnter");
            })

            it("doesn't allow entrance when raffle is calculating", async () => {
                await raffle.enterRaffle({ value: raffleEntranceFee });
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                await network.provider.send("evm_mine", []);
                await network.provider.request({ method: "evm_mine", params: [] });

                // we pretent to be Chainlink Keeper
                await raffle.performUpkeep([]);
                await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.be.revertedWith("Raffle__NotOpen");
            })
        })
        describe("checkUpKeep", () => {
            it("returns false if people haven't send any ETH", async () => {
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                await network.provider.send("evm_mine", []);
                const { upKeepNeeded } = await raffle.callStatic.checkUpkeep([]); // call static doesn't make transaction but mocks it
                assert(!upKeepNeeded);
            })
            it("returns false if raffle isn't open", async () => {
                await raffle.enterRaffle({ value: raffleEntranceFee });
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                await network.provider.send("evm_mine", []);
                await raffle.performUpkeep("0x"); // "0x" -> [] (blank bytes obj)
                const raffleState = await raffle.getRaffleState();
                const { upKeepNeeded } = await raffle.callStatic.checkUpkeep([]);
                assert.equal(raffleState.toString(), "1");
                assert.equal(upKeepNeeded, false);

            })
        })

        describe("performUpKeep", () => {

            it("it can only run if checkUpKeep is true", async () => {
                await raffle.enterRaffle({ value: raffleEntranceFee });
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                await network.provider.request({ method: "evm_mine", params: [] })
                const tx = await raffle.performUpkeep([]);
                assert(tx);
            })

            it("reverts when checkupkeep is false", async () => {
                await expect(raffle.performUpkeep([])).to.be.revertedWith("Raffle__UpkeepNotNeeded");
            })
            it("updates the raffle state, emits an event and calls the vrf coordinator", async () => {
                await raffle.enterRaffle({ value: raffleEntranceFee });
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                await network.provider.request({ method: "evm_mine", params: [] })
                const txResponse = await raffle.performUpkeep([]);
                const txReceipt = await txResponse.wait(1);
                const requestId = txReceipt.events[1].args.requestId;
                const raffleState = await raffle.getRaffleState();
                assert(requestId.toNumber() > 0);
                assert(raffleState.toString() == "1");
            })
        })

        describe("fulfillRandomWords", () => {
            beforeEach(async () => {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                await network.provider.request({ method: "evm_mine", params: [] })
            })
            it("can only be called after performUpKeep", async () => {
                await expect(vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address))
                    .to.be.revertedWith("nonexistent request");
                await expect(vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.address))
                    .to.be.revertedWith("nonexistent request");
            })
            it("picks a winner, reset the lottery, and sends money", async () => {
                const additionalEntrants = 3;
                const startingAccountIndex = 1; // deployer = 0
                const accounts = await ethers.getSigners();
                for (let i = startingAccountIndex; i < startingAccountIndex + additionalEntrants; i++) {
                    const accountConnectedRaffle = raffle.connect(accounts[i]);
                    await accountConnectedRaffle.enterRaffle({ value: raffleEntranceFee })
                }
                const startingTimeStamp = await raffle.getLatestTimeStamp();

                // performupkeep (mock being chainlink keepers)
                // fulfillRandomWords (mock being the ChainLink VRF)
                // We will have to wait for the fullfillRandomWords to be called
                await new Promise(async (resolve, reject) => {
                    raffle.once("WinnerPicked", async () => {
                        console.log("Found the event!");
                        try {
                            const recentWinner = await raffle.getRecentWinner();
                            const raffleState = await raffle.getRaffleState();
                            const endingTimeStamp = await raffle.getLatestTimeStamp();
                            const numPlayers = await raffle.getNumberOfPlayers();
                            const winnerEndingBalance = await accounts[1].getBalance();
                            assert.equal(numPlayers.toString(), "0");
                            assert.equal(raffleState.toString(), "0");
                            assert(endingTimeStamp > startingTimeStamp);
                            assert.equal(winnerEndingBalance.toString(),
                                winnerStartingBalance
                                    .add(raffleEntranceFee
                                        .mul(additionalEntrants)
                                        .add(raffleEntranceFee)
                                        .toString()));
                        } catch (e) {
                            reject(e);
                        }
                        resolve()
                    });
                    const tx = await raffle.performUpkeep([]);
                    const txReceipt = await tx.wait(1);
                    const winnerStartingBalance = await accounts[1].getBalance();
                    await vrfCoordinatorV2Mock.fulfillRandomWords(
                        txReceipt.events[1].args.requestId,
                        raffle.address
                    );

                })

            })
        })

    })