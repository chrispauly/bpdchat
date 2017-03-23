// Setup basic express server
var express = require('express');
var favicon = require('serve-favicon');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 3000;
var lastMessages = [];
var maxMessages = 20;

server.listen(port, function () {
  console.log('Server listening at port %d', port);
});

// Routing
app.use(express.static('public'));
//app.use(favicon('https://cdn.gomix.com/94ad3f99-995e-433b-b951-f98252156895%2Ffavicon.ico'));

// Chatroom

var numUsers = 0;

io.on('connection', function (socket) {
  var addedUser = false;

  // when the client emits 'new message', this listens and executes
  socket.on('new message', function (data) {
    var dt = new Date();
    var userDataMsg = {
      username: socket.username,
      message: data.message,
      timestamp: data.timestamp
    };
    // save last n messages
    lastMessages.push(userDataMsg);
    if(lastMessages.length > maxMessages)
      lastMessages.splice(0,1);
      
    console.log('%s: %s', userDataMsg.username, userDataMsg.message);
      
    // we tell the client to execute 'new message'
    socket.broadcast.emit('new message', userDataMsg);
  });

  // when the client emits 'add user', this listens and executes
  socket.on('add user', function (username) {
    if (addedUser) return;

    // we store the username in the socket session for this client
    socket.username = username;
    ++numUsers;
    addedUser = true;
    socket.emit('login', {
      numUsers: numUsers
    });
    
    // Send the last n saved messages
    for(var i=0;i<lastMessages.length;i++) {
      socket.emit('new message', lastMessages[i]);
    }
    
    console.log('Connect: %s', socket.username);
    
    // echo globally (all clients) that a person has connected
    socket.broadcast.emit('user joined', {
      username: socket.username,
      numUsers: numUsers
    });
  });

  // when the client emits 'typing', we broadcast it to others
  socket.on('typing', function () {
    socket.broadcast.emit('typing', {
      username: socket.username
    });
  });

  // when the client emits 'stop typing', we broadcast it to others
  socket.on('stop typing', function () {
    socket.broadcast.emit('stop typing', {
      username: socket.username
    });
  });

  // when the user disconnects.. perform this
  socket.on('disconnect', function () {
    if (addedUser) {
      --numUsers;
      console.log('Disconnect: %s', socket.username);
      
      // echo globally that this client has left
      socket.broadcast.emit('user left', {
        username: socket.username,
        numUsers: numUsers
      });
    }
  });
  
    // keep alive
  socket.on('keep alive', function () {
    console.log('Keep alive: %s', socket.username);
  });
});