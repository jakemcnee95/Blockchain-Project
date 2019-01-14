var io = require("socket.io").listen(8000);
var dict_serverLeafs = {};
var lst_portWealth = [];
var num_client = 0;
var dict_portById = {};

// protobuf setup
var protobuf = require('protocol-buffers');
var fs = require('fs'); // file system
var messages = protobuf(fs.readFileSync('public/messages.proto'));


//chosen by proportional chance
//dict_serverLeafs[lst_portWealth[randInt(createWealthList())].port]



io.sockets.on("connection",function(socket){
    // Display a connected message
    console.log("SERVER Connected! " + socket.id);
    // Lets force this connection into the lobby room.
    socket.join('node');

    //notify the server that we have accepted them
    socket.emit('join')

    //receive init information from server
    socket.on('init',function(data){
        // if there is already a server present.
        //update the new server with the blockchain that exists before we add it to the wealth list
        if(lst_portWealth.length > 0){
            var chosenPort = randInt(createWealthList())

            //payment for action
            lst_portWealth[chosenPort].wealth += 3

            // action - create chain using the data of the previous links

            // make buffer = socket.id

            var buffer = messages.ID.encode({myid: socket.id});
            io.to(dict_serverLeafs[lst_portWealth[chosenPort].port]).emit('catchUp',buffer)
        }
        // and then add the new server to the list of available servers
        lst_portWealth.push(data['tag']);
        dict_serverLeafs[data['tag']['port']] = socket.id;
        dict_portById[socket.id] = data['tag']['port']
    });

    //sending the chain when a new server joins
    socket.on('chainGrab',function(data){
        var i;
        for (i=0;i<data.info.length;i++){
            var buffer = messages.MapMessage.encode({info:data.info[i].info});
            io.to(data.sid).emit('addBlock', buffer);
        }
    });

    //when a client requests a transaction
    socket.on('transactionStart',function(data){
        // choose a port based upon proportional wealth
        var chosenPort = randInt(createWealthList())

        //payment for action
        lst_portWealth[chosenPort].wealth += 3

        //action
        io.to(dict_serverLeafs[lst_portWealth[chosenPort].port]).emit('verifyBlock',data)

    });

    socket.on('blockTrue',function(data){
        var debuf = messages.MapMessage.decode(data);
        console.log('emitting to all, addblock')
        io.to('node').emit('addBlock',data)
        io.to(dict_serverLeafs[debuf.port]).emit('transGo',data)
    });

    socket.on('blockFalse',function(data){
        var debuf = messages.MapMessage.decode(data);
        io.to(dict_serverLeafs[debuf.port]).emit('transFail',data)
    });


    //io.sockets.connected[dict_serverLeafs[lst_portWealth[randInt(createWealthList())].port]].emit('genesis');

    // Some roster/wealth section
    // add to list with

    // When we receive a message...
    socket.on("message",function(data){
    });

    socket.on("disconnect",function(){
        console.log('disconnection '+socket.id+'\n')
        disconnectionEvents(socket.id)

        // Other logic you may or may not want
        // Your other disconnect code here
    });
});

//choosing a server based on proportional wealths
// with help from the lab resources and stack overflow
function randInt(lst) {
    var totalWealth = lst.reduce(add,0);
    var rand = Math.floor(Math.random()*(totalWealth -1))+1;

    var i = -1;
    while(rand>0){
        i ++;
        rand -= lst[i]
    }

    return i
}

//don't judge me
function add(a,b) {
    return a + b;
}

//creating the list for the randInt function to use for choosing the port dependant on wealth
function createWealthList(){

    var lst_return = [];
    var i;
    for(i = 0;i<lst_portWealth.length;i++){
        lst_return.push(lst_portWealth[i]['wealth'])
    }
    return lst_return
}
function disconnectionEvents(sid){
    var i;
    for(i = 0; i<lst_portWealth.length;i++){
        if (lst_portWealth[i].port === dict_portById[sid]){
            lst_portWealth.splice(i,1);
            break
        }
    }
}