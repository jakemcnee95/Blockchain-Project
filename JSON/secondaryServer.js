// Block Chain Functions as from resources
const SHA256 = require('crypto-js/sha256');

class Block {
    constructor(index, timeStamp, data, prevHash = "") {
        this.index = index;
        this.timeStamp = timeStamp;
        this.data = data;
        this.prevHash = prevHash;
        this.hash = this.calculateHash();
    }
    calculateHash() {
        return SHA256(this.index + this.prevHash + this.timeStamp + JSON.stringify(this.data)).toString();
    }
}

//
class BlockChain {
    constructor() {
// the chain is an array with an initial block (genesis block)
        this.chain = [this.createGenesisBlock()];
    }
// create the first block. We call it the genesis block
    createGenesisBlock() {
        return new Block(0, "01/01/2018", "GB", "0");
    }
// return the latest block
    getLatestBlock() {
        return this.chain[this.chain.length - 1];
    }
// this function creates a new block and adds it to the chain
    addBlock(newBlock) {
//assign the pre hash
        newBlock.prevHash = this.getLatestBlock().hash;
// Now calculate the hash of the new block
        newBlock.hash = newBlock.calculateHash();
// push it to the chain
        this.chain.push(newBlock);
    }
// this boolean function checks if the chain is valid or not
    isChainValid() {
        for (let i = 1; i < this.chain.length; i++) {
            const currentBlock = this.chain[i];
            const prevBlock = this.chain[i - 1];
            if (currentBlock.hash !== currentBlock.calculateHash()) {
                return false;
            }
            if (currentBlock.prevHash !== prevBlock.hash) {
                return false;
            }
        }
        return true;

    }
    //each client starting at 100 coins, making sure they have enough for the transaction
    isFundValid(client,fund) {
        var total = 100;

        //checking each transaction
        for (let i = 1; i < this.chain.length; i++) {
            const currentBlock = this.chain[i];
            var temp_dict = currentBlock.data;
            //if they sent money, deduct
            if(temp_dict.F === client){
                total -= temp_dict.A
            }

            //if they received money, add
            if(temp_dict.T === client){
                total += temp_dict.A
            }
        }
        //return True is there is enough money in their account
        return(total>=fund)
    }
    //new servers being brought up to date will create their own chain based off of the information given from another
    sendChain(){
        //the total load given back to the new server
        var haul = [];

        //the data from each transaction is added to the load
        for(let i = 1; i < this.chain.length; i++){
            const currentBlock = this.chain[i];
            haul.push(currentBlock.data)
        }
        //return the load
        return haul
    }
}


// Server Inits
//each server maintains the public blockchain each is hashed differently because reasons, but they validate within itself
let myChain = new BlockChain();

// socket initialisation goodies
const http = require('http');
const express = require('express');
const app = express();
const sio_server = require('socket.io');
const sio_client = require('socket.io-client');

app.use(express.static(__dirname + '/public'))
app.get("/", function(req,res){
    res.sendfile(__dirname + '/index.html')
});

// create new random port and wealth (between 3000 and 3999)(between 1 and 10)
var exp_port = Math.floor((Math.random() * 998) + 3000);;
var exp_wealth = Math.floor((Math.random()*10)+1);

// to console so we know where to send URL
console.log('localhost:'+ exp_port);

// create the server at that randomised port number for clients
const server = http.createServer(app);
const client = require('socket.io').listen(server);
server.listen(exp_port);



//reporting back to all of the root
var root = sio_client.connect('http://127.0.0.1:8000')

var pool = [{port:exp_port,wealth:exp_wealth}];
root.on('join',function(){
    root.emit('init', {
        tag: pool[0]
    })
});

// on request to check validity
root.on('verifyBlock',function(data) {
    console.log('')
    console.log('Chosen to validate transaction',data.info)
    if (myChain.isChainValid() && myChain.isFundValid(data.info.F, data.info.A)){
        console.log('validation TRUE')
        root.emit('blockTrue',data)
    } else {
        console.log('validation FALSE')
        root.emit('blockFalse', data)
    };
    console.log('')
});

//when a transaction is approved, each server adds the information
root.on('addBlock',function(data){
    myChain.addBlock(new Block(myChain.chain.length, Date(), data.info));

});

//sending an entire chain of information to a new server
root.on('catchUp',function(data){
    console.log(data,'data on catchup')
    root.emit('chainGrab',{sid:data,info:myChain.sendChain()})
});


//client based action
client.on('connection',function(socket){
    socket.on('disconnect', function () {
        root.emit('clientLeft')
        console.log('CLIENT LEFT', socket.id)
    });
    // when a client makes a transaction request
   socket.on('go',function(data){

       //making sure the amount can be represented as an integer
       data.A = parseInt(data.A)
       if (isNaN(data.A)){
           socket.emit('status','Bruh, Amount in NUMBERS')
       }else{
           //amount is a number or has a number in the string.
           socket.emit('status','transaction validation in progress')

            // give the information to the mother server for distribution
           root.emit('transactionStart',{info: data, sid: socket.id, port: exp_port})
       }
   });
});

//validation fail
root.on('transFail',function(data){
    console.log('fail',data)
    client.to(data).emit('status','Transaction Failure, check amounts')
});

//validation success
root.on('transGo',function(data){
    console.log('transaction complete',data)
    client.to(data).emit('status','Transaction success, event added to chain')
});