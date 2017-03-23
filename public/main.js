$(function() {
  var FADE_TIME = 150; // ms
  var TYPING_TIMER_LENGTH = 400; // ms
  var COLORS = [
    '#f76455', '#ffd39a', '#f8a700', '#f78b00',
    '#58dc00', '#68ec28', '#a8f07a', '#4ae8c4',
    '#3b88eb', '#3824aa', '#a700ff', '#d300e7'
  ];

  // Initialize variables
  var $window = $(window);
  var $usernameInput = $('.usernameInput'); // Input for username
  var $messages = $('.messages'); // Messages area
  var $inputMessage = $('.inputMessage'); // Input message input box

  var $loginPage = $('.login.page'); // The login page
  var $chatPage = $('.chat.page'); // The chatroom page

  // Prompt for setting a username
  var username;
  var connected = false;
  var typing = false;
  var lastTypingTime;
  var unreadMessages = 0;
  var focus = true;
  var titleFlash;
  var flashCount = 0;
  var $currentInput = $usernameInput.focus();

  var socket = io();

  function addParticipantsMessage (data) {
    var message = '';
    if (data.numUsers === 1) {
      message += "there's 1 participant";
    } else {
      message += "there are " + data.numUsers + " participants";
    }
    log(message);
  }

  // Sets the client's username
  function setUsername () {
    username = cleanInput($usernameInput.val().trim());

    // If the username is valid
    if (username) {
      $loginPage.fadeOut();
      $chatPage.show();
      $loginPage.off('click');
      $currentInput = $inputMessage.focus();

      // Tell the server your username
      socket.emit('add user', username);
    }
  }

  // Sends a chat message
  function sendMessage () {
    var message = $inputMessage.val();
    // Prevent markup from being injected into the message
    message = cleanInput(message);
    // if there is a non-empty message and a socket connection
    if (message && connected) {
      $inputMessage.val('');
      var dt = new Date(); 
      var timestamp = ("0" + (dt.getMonth() + 1)).slice(-2) + "/" 
                       + ("0" + dt.getDate()).slice(-2) + "/" 
                       + dt.getFullYear() + " " 
                       + ("0" + dt.getHours()).slice(-2) + ":" 
                       + ("0" + dt.getMinutes()).slice(-2) + ":" 
                       + ("0" + dt.getSeconds()).slice(-2);
      addChatMessage({
        username: username,
        message: message,
        timestamp: timestamp
      });
      // tell server to execute 'new message' and send along one parameter
      socket.emit('new message', { message: message, timestamp: timestamp });
    }
  }

  // Log a message
  function log (message, options) {
    var $el = $('<li>').addClass('log').text(message);
    addMessageElement($el, options);
  }

  // Adds the visual chat message to the message list
  function addChatMessage (data, options) {
    // Don't fade the message in if there is an 'X was typing'
    var $typingMessages = getTypingMessages(data);

    options = options || {};
    options.fade = false;

    if ($typingMessages.length !== 0) {
      options.fade = false;
      $typingMessages.remove();
    }
    
    var $usernameDiv = $('<span class="username"/>')
      .text(data.username)
      .css('color', getUsernameColor(data.username));
      
    var $messageBodyDiv = $('<span class="messageBody">').text(data.message);
    
    var msg_lc = data.message.toLowerCase();
    
    if(msg_lc.includes("http://") || msg_lc.includes("https://")){
      
      if(msg_lc.indexOf("youtube.com") > -1) {
        $messageBodyDiv = $('<span class="messageBody">').html('<iframe width="420" height="240" src="https://www.youtube.com/embed/'+ data.message.split("?v=")[1] +'"?controls=1></iframe>')
      }
      else 
      {
        $messageBodyDiv = $('<span class="messageBody">').html(data.message.replace(/(https?:\/\/([\?\/0-9A-Za-z-\\.@:%_\+~#=]+))/ig,'<a href="$1" target="_blank">$1</a>'));
      }
    }
    else{
      $messageBodyDiv = $('<span class="messageBody">').text(data.message);
    }
    
    if(data.timestamp) {
      $messageBodyDiv.append("<span class='timestamp'>" + data.timestamp + "</span>"); 
    }

    var typingClass = data.typing ? 'typing' : '';
    var $messageDiv = $('<li class="message"/>')
      .data('username', data.username)
      .addClass(typingClass)
      .append($usernameDiv, $messageBodyDiv);
    //pageTitleNotification.On("New Chat Message!");
    addMessageElement($messageDiv, options);
  }

  // Adds the visual chat typing message
  function addChatTyping (data) {
    data.typing = true;
    data.message = 'is typing';
    addChatMessage(data);
  }

  // Removes the visual chat typing message
  function removeChatTyping (data) {
    getTypingMessages(data).fadeOut(function () {
      $(this).remove();
    });
  }

  // Adds a message element to the messages and scrolls to the bottom
  // el - The element to add as a message
  // options- If the element should fade-in (default = true)
  // options.prepend - If the element should prepend
  //   all other messages (default = false)
  function addMessageElement (el, options) {
    var $el = $(el);

    // Setup default options
    if (!options) {
      options = {};
    }
    if (typeof options.fade === 'undefined') {
      options.fade = true;
    }
    if (typeof options.prepend === 'undefined') {
      options.prepend = false;
    }

    // Apply options
    if (options.fade) {
      $el.hide().fadeIn(FADE_TIME);
    }
    if (options.prepend) {
      $messages.prepend($el);
    } else {
      $messages.append($el);
    }
    $messages[0].scrollTop = $messages[0].scrollHeight;
  }

  // Prevents input from having injected markup
  function cleanInput (input) {
    return $('<div/>').text(input).text();
  }

  // Updates the typing event
  function updateTyping () {
    if (connected) {
      if (!typing) {
        typing = true;
        socket.emit('typing');
      }
      lastTypingTime = (new Date()).getTime();

      setTimeout(function () {
        var typingTimer = (new Date()).getTime();
        var timeDiff = typingTimer - lastTypingTime;
        if (timeDiff >= TYPING_TIMER_LENGTH && typing) {
          socket.emit('stop typing');
          typing = false;
        }
      }, TYPING_TIMER_LENGTH);
    }
  }

  // Gets the 'X is typing' messages of a user
  function getTypingMessages (data) {
    return $('.typing.message').filter(function (i) {
      return $(this).data('username') === data.username;
    });
  }

  // Gets the color of a username through our hash function
  function getUsernameColor (username) {
    // Compute hash code
    var hash = 7;
    var user = username || '';
    for (var i = 0; i < user.length; i++) {
       hash = user.charCodeAt(i) + (hash << 5) - hash;
    }
    // Calculate color
    var index = Math.abs(hash % COLORS.length);
    return COLORS[index];
  }

  // Keyboard events

  $window.keydown(function (event) {
    // Auto-focus the current input when a key is typed
    if (!(event.ctrlKey || event.metaKey || event.altKey)) {
      $currentInput.focus();
    }
    // When the client hits ENTER on their keyboard
    if (event.which === 13) {
      if (username) {
        sendMessage();
        socket.emit('stop typing');
        typing = false;
      } else {
        setUsername();
      }
    }
  });

  $inputMessage.on('input', function() {
    updateTyping();
  });

  // Click events

  // Focus input when clicking anywhere on login page
  $loginPage.click(function () {
    $currentInput.focus();
  });

  // Focus input when clicking on the message input's border
  $inputMessage.click(function () {
    $inputMessage.focus();
  });
  
  // Window events
  //listen for browser events so we know to update the document title
  $window.bind("blur", function() {
    focus = false;
    updateTitle();
  });

  $window.bind("focus", function() {
    focus = true;
    unreadMessages = 0;
    updateTitle();
  });
  
  //we want to show a count of unread messages when the window does not have focus
function updateTitle() {
  if (unreadMessages > 0) {
    if(!titleFlash) {
      titleFlash = window.setInterval(function () {
        if(++flashCount%2)
          document.title = " ";
        else
          document.title = "(" + unreadMessages.toString() + ") node chat";
          
        //if (window.external.msIsSiteMode()) {
        //  window.external.msSiteModeActivate();
        //}        
      }, 1000);
    }
	  playSound();
  } else {
    window.clearInterval(titleFlash);
    titleFlash = undefined;
    document.title = "node chat";
  }
}

function playSound() {   
   // var mysound = document.getElementById(soundObj);
   // mysound.Play();
   var snd = new Audio("https://cdn.gomix.com/94ad3f99-995e-433b-b951-f98252156895%2FSound.wav");
   snd.play();
}

  // Socket events

  // Whenever the server emits 'login', log the login message
  socket.on('login', function (data) {
    connected = true;
    // Display the welcome message
    var message = "Welcome to Socket.IO Chat – ";
    log(message, {
      prepend: true
    });
    addParticipantsMessage(data);
  });

  // Whenever the server emits 'new message', update the chat body
  socket.on('new message', function (data) {
    if(!focus) unreadMessages++;
    //update the document title to include unread message count if blurred
    updateTitle();
    //Add time
    addChatMessage(data);
  });

  // Whenever the server emits 'user joined', log it in the chat body
  socket.on('user joined', function (data) {
    log(data.username + ' joined');
    addParticipantsMessage(data);
  });

  // Whenever the server emits 'user left', log it in the chat body
  socket.on('user left', function (data) {
    log(data.username + ' left');
    addParticipantsMessage(data);
    removeChatTyping(data);
  });

  // Whenever the server emits 'typing', show the typing message
  socket.on('typing', function (data) {
    addChatTyping(data);
  });

  // Whenever the server emits 'stop typing', kill the typing message
  socket.on('stop typing', function (data) {
    removeChatTyping(data);
  });
  
  // Keep alive
  window.setInterval(function () 
  { 
    socket.emit('keep alive'); 
    console.log('Keep alive ping');
  }, 240000);  /* Need to set this to 4 minutes since containers will timeout after no activity for 5 minutes) */
});