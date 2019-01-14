var io = require("socket.io").listen(8000);
var dict_serverLeafs = {};
var lst_portWealth = []
var dict_portById = {}



io.sockets.on("connection",function(socket){
    // Display a connected message
    console.log("SERVER Connected! " + socket.id);
    // Lets force this connection into a room.
    socket.join('node');

    //notify the server that we have accepted them
    socket.emit('join')

    //receive init information from server
    socket.on('init',function(data){
        // if there is already a server present.
        //update the new server with the blockchain that exists before we add it to the wealth list
        if(lst_portWealth.length > 0){
            var chosenPort = randInt(createWealthList())

            //payment for action - 3 'coins'
            lst_portWealth[chosenPort].wealth += 3

            // action - create chain using the data of the previous links
            io.to(dict_serverLeafs[lst_portWealth[chosenPort].port]).emit('catchUp',socket.id)
        }
        // and then add the new server to the list of available servers
        lst_portWealth.push(data['tag']);
        dict_serverLeafs[data['tag']['port']] = socket.id;
        dict_portById[socket.id] = data['tag']['port']
    });

    //sending the chain when a new server joins from a chosen server, potentially empty because of no links yet.
    socket.on('chainGrab',function(data){
        var i;
        for (i=0;i<data.info.length;i++){
            io.to(data.sid).emit('addBlock',{info:data.info[i]})
        }
    })

    //when a client requests a transaction
    socket.on('transactionStart',function(data){
        // choose a port based upon proportional wealth
        var chosenPort = randInt(createWealthList())

        //payment for action - 3 'coins'
        lst_portWealth[chosenPort].wealth += 3

        //action - verify the transaction can take place
        io.to(dict_serverLeafs[lst_portWealth[chosenPort].port]).emit('verifyBlock',data)

    });

    //Transaction ready to proceed
    socket.on('blockTrue',function(data){
        console.log('validation success, emitting to all, addblock:\n',data.info)
        io.to('node').emit('addBlock',data)
        io.to(dict_serverLeafs[data.port]).emit('transGo',data.sid)
    });

    //if we were not able to validate a transaction
    socket.on('blockFalse',function(data){
        console.log('unable to validate transaction')
        io.to(dict_serverLeafs[data.port]).emit('transFail',data.sid)
    });

    //Servers can disconnect too
    socket.on("disconnect",function(){
        console.log('disconnection '+socket.id+'\n')
        disconnectionEvents(socket.id)
    });
});

// choosing a server based on proportional wealth
// --with help from the lab resources and stack overflow--
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

//removing the disconnected port from the proportional chance list
function disconnectionEvents(sid){
    var i;
    for(i = 0; i<lst_portWealth.length;i++){
        if (lst_portWealth[i].port === dict_portById[sid]){
            lst_portWealth.splice(i,1);
            break
        };
    }
}