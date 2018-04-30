app.service( '$web3',['$q','$window', function ($q, $window) {
    console.log('Loading Web3 Service');
    
    var ready = $q.defer();

    // Connect to Web3
    try {
        if (typeof web3 !== 'undefined') {
            // Use Mist/MetaMask's provider
            web3 = new Web3(web3.currentProvider);
        } else {
            //console.log('No web3? You should consider trying MetaMask!')
            // fallback - use your fallback strategy (local node / hosted node + in-dapp id mgmt / fail)
            web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
        }
    } catch (err) {
        //console.error(err);
        console.error('no web3 detected');
        ready.reject(err);
    }

    if(web3)
        ready.resolve();
    else
        ready.reject('No web3 detected.', web3);

    // Refresh the page if the current account is changed
    var firstInterval = true;
    var currentAccount = null;
    var interval = setInterval(function(){
        if(window.web3){
            service.getCurrentAccount()
            .then(function(account){
                //console.log(currentAccount, account);
                if(firstInterval) {
                    currentAccount = account;
                    firstInterval = false;
                } else if(currentAccount !== account) {
                    $window.location.reload();
                } else {
                    //console.log('do nothing');
                }
            }).catch(function(err){
                //console.log(currentAccount, err);
                if(!currentAccount && err)
                    clearInterval(interval);
                else if(currentAccount)
                    $window.location.reload();
                
                firstInterval = false;
            });
        }
    }, 250);

    var service = {
        networks: {
            current: null,
            mainnet: 1,
            privatenet: 1,
            morden: 2,
            ropsten: 3,
            rinkby: 4,
            kovan: 42,
        },
        currentBlock: null,
        assertNetworkId: function (requiredNetworkId){
            var deferred = $q.defer();

            ready.promise.then(function(){
                console.log("Web3 ready");
                web3.version.getNetwork((err, networkId) => {
                    //console.log(err, netId);
                    if(!err){
                        if(networkId == requiredNetworkId){
                            service.networks.current = requiredNetworkId;
                            console.log("Network is connected: " + networkId);
                            service.getBlock('latest').then(function(currentBlock){
                                deferred.resolve(currentBlock);
                            });
                        } else {
                            deferred.reject('Network Id incorrect');
                        }
                    } else {
                        deferred.reject('Could not detect Network Id');
                    }
                });
            }).catch(function(err){
                deferred.reject(err);
            });

            return deferred.promise;
        },
        getCurrentAccount: function(){
            var deferred = $q.defer();

            web3.eth.getAccounts(function(err, accounts){
                //console.log(err,accounts);
                if(!err){
                    if(!accounts[0])
                        deferred.resolve(null);
                    else
                        deferred.resolve(accounts[0]);
                } else {
                    deferred.reject(err);
                }
            });

            return deferred.promise;
        },
        getBalance: function(account){
            var deferred = $q.defer();
            var async_getBalance = web3.eth.getBalance(account, 
            function(err,etherBalanceInWei){
                if(!err){
                    deferred.resolve(etherBalanceInWei);
                } else {
                    deferred.reject(err);
                }
            });
            
            return deferred.promise;
        },
		getTransactionReceipt: function(txHash){
            var deferred = $q.defer();
            console.log('waiting for receipt for ' + txHash);
            var async_filter = web3.eth.filter('latest', function(err, blockHash) {
                //console.log(err, blockHash);                
                if(!err){
                    web3.eth.getTransactionReceipt(txHash, function(err, receipt){
                        //console.log(err, receipt);
                        if(!err){
                            if(receipt){
                                async_filter.stopWatching(function(err,res){
                                    console.log(err, res, 'Stopped filter watching latest');
                                    deferred.resolve(receipt);
                                });
                            } else {
                                console.log("Transaction receipt not included in this block. Waiting for the next block.");                            
                            }
                        } else {
                            async_filter.stopWatching(function(err,res){
                                console.log(err, res, 'Stopped filter watching latest');
                                deferred.reject(err);
                            });
                        }
                    });
                } else {
                    deferred.reject(err);
                }
            });
            
            return deferred.promise;
        },
		getTransaction: function(txHash){
            var deferred = $q.defer();
            
            web3.eth.getTransaction(txHash, 
            function(err,receipt){
                if(!err){
                    deferred.resolve(receipt);
                } else {
                    deferred.reject(err);
                } 
            });
            
            return deferred.promise;
        },
        getBlock: function(stringOrBlockNumberOrHash){
            var deferred = $q.defer();
            //console.log(stringOrBlockNumberOrHash);
            var async_getBlock = web3.eth.getBlock(stringOrBlockNumberOrHash,
            function(err, blockData){
                //console.log(err, blockData);
                if(!err){
                    deferred.resolve(blockData);
                } else {
                    deferred.reject(err);
                }
            });
            
            return deferred.promise;
        },
        //This is not accurate and only fetches an estimated block number
        getBlockAtTimestamp: function(timestamp){
            var deferred = $q.defer();

            var difference = service.currentBlock.timestamp - timestamp;
            if(difference < 0) 
                deferred.reject('Timestamp is in the future!');
            else {
                var averageBlockTime = 15; //seconds
                var estimatedElapsedBlocks = Math.floor(difference/averageBlockTime);
                var estimatedBlockNumber = service.currentBlock.number - estimatedElapsedBlocks;
                
                service.getBlock(estimatedBlockNumber)
                .then(function(blockData){
                    console.log(blockData);
                    difference = blockData.timestamp - timestamp;
                    
                    if(difference == 0){
                        deferred.resolve(blockData);
                    } else {
                        estimatedElapsedBlocks = Math.floor(Math.abs(difference)/averageBlockTime);
                        if(difference < 0)
                            estimatedBlockNumber = blockData.number + estimatedElapsedBlocks;
                        else
                            estimatedBlockNumber = blockData.number - estimatedElapsedBlocks;
                        
                        service.getBlock(estimatedBlockNumber)
                        .then(function(blockData){
                            deferred.resolve(blockData);
                        }).catch(function(err){
                            deferred.reject(err);
                        });
                    }
                }).catch(function(err){
                    deferred.reject(err);
                });
            }
            
            return deferred.promise;
        },
        getGasPrice: function(gasPrice) {
            var deferred = $q.defer();
            
            web3.eth.getGasPrice(function(err, gasPrice){
                if(!err){
                    deferred.resolve(gasPrice);
                } else {
                    deferred.reject(err);
                }
            });
            
            return deferred.promise;
        },
        sendEther: function(from, to, amountInWei){
            var deferred = $q.defer();
            console.log(to, amountInWei);
            web3.eth.sendTransaction({from:from, to:to, value:amountInWei},
            function(err,txHash){
                if(!err)
                    deferred.resolve(txHash);
                else
                    deferred.reject(err);
            });
            
            return deferred.promise;
        }
    };
    
    return service;
}]);