// ===== START CONFIGURATION ======

const IRC_SERVER = "glitchtech.top";
const IRC_PORT = 6667;
const NICK = "GN";
const USERNAME = "GNIRCBOT";
const REALNAME = "GlitchNet IRC Bridge Bot";
const SPOOF_USER = 6; // User number for node spoofing (1 = Sysop)
const CHANNEL_NUM = 2;
const IRC_CHANNEL = "#main";
const SPOOF_NODE = 13;
const DEBUG_MODE = false;

// ===== END CONFIGURATION ======

// Load Synchronet socket definitions
load('sockdefs.js');
// Load node action and status constants
load("nodedefs.js");

// User input dependencies
require("sbbsdefs.js", "K_NONE");
require("mouse_getkey.js", "mouse_getkey");

function IRCBridge(nick, username, realname) {
    this.nick = nick;
    this.username = username;
    this.realname = realname;
    this.socket = new Socket(SOCK_STREAM);
    this.connected = false;
    this.originalNodeSettings = null;
    this.previousChatUsers = []; // Track BBS users for join/leave detection
    this.ircUsers = []; // Track IRC users for join/leave detection
    this.hasRequestedNames = false; // Track if we've requested initial user list
}

// Connect to IRC server
IRCBridge.prototype.connect = function() {
    if (DEBUG_MODE) alert("Connecting to IRC server " + IRC_SERVER + ":" + IRC_PORT + "...");

    if (!this.socket.connect(IRC_SERVER, IRC_PORT)) {
        if (DEBUG_MODE) alert("Connection failed.");
        return false;
    }

    if (DEBUG_MODE) alert("Connected successfully!");
    this.connected = true;
    return true;
};

// Perform IRC login handshake
IRCBridge.prototype.login = function() {
    if (!this.connected) return;

    this.send("NICK " + this.nick + "\r\n");
    this.send("USER " + this.username + " 0 * :" + this.realname + "\r\n");
};

// Send a message to the IRC server
IRCBridge.prototype.send = function(message) {
    if (this.socket && this.connected) {
        this.socket.send(message);
    }
};

// Join a channel on the IRC server
IRCBridge.prototype.joinChannel = function(channel) {
    this.send("JOIN " + channel + "\r\n");
    // Request user list after joining
    this.send("NAMES " + channel + "\r\n");
};

// Send a public message to an IRC channel
IRCBridge.prototype.sendIRCMessage = function(channel, message) {
    this.send("PRIVMSG " + channel + " :" + message + "\r\n");
};

// Receive and handle incoming messages, relaying between IRC and BBS
IRCBridge.prototype.receiveLoop = function() {
    while (!js.terminated && this.connected) {

        var mk = mouse_getkey(K_NONE, 100, true);
        var key = mk.key;

        // Check for 'q' key press to quit
        if (key == 'q') {
            if (DEBUG_MODE) alert("Disconnecting due to user request.");
            break; // Exit the loop
        }

        this.checkBBSMessages();
        
        var line = this.socket.recvline(512, 0.1); // 100ms timeout for better responsiveness

        // Only process IRC messages if we received data
        if (line != null) {
            // Respond to server PING to stay connected
            if (line.indexOf("PING") === 0) {
                var pong = line.replace("PING", "PONG");
                this.send(pong + "\r\n");
                if (DEBUG_MODE) alert(">> " + pong);
            }
            
            // Handle NAMES reply (user list)
            if (line.indexOf(" 353 ") !== -1) { // RPL_NAMREPLY
                this.handleNamesReply(line);
            }
            
            // Handle end of NAMES list
            if (line.indexOf(" 366 ") !== -1) { // RPL_ENDOFNAMES
                this.handleEndOfNames();
            }
            
            // Handle user joins
            if (line.indexOf(" JOIN ") !== -1) {
                this.handleUserJoin(line);
            }
            
            // Handle user quits
            if (line.indexOf(" QUIT ") !== -1) {
                this.handleUserQuit(line);
            }
            
            // Handle user parts (leaves channel)
            if (line.indexOf(" PART ") !== -1) {
                this.handleUserPart(line);
            }
            
            // Handle nick changes
            if (line.indexOf(" NICK ") !== -1) {
                this.handleNickChange(line);
            }
            
            // Parse PRIVMSG messages from IRC and relay to BBS
            if (line.indexOf("PRIVMSG") !== -1) {
                var privmsgMatch = line.match(/^:([^!]+)![^\s]+ PRIVMSG ([^\s]+) :(.+)$/);
                if (privmsgMatch) {
                    var sender = privmsgMatch[1];
                    var channel = privmsgMatch[2];
                    var message = privmsgMatch[3];
                    
                    // Only relay messages from our target IRC channel
                    if (channel === IRC_CHANNEL) {
                        var relayMessage;
                        
                        // Special handling for MC - check if message contains <username>
                        if (sender === "MC") {
                            var mcUserMatch = message.match(/^<([^>]+)>\s*(.*)$/);
                            if (mcUserMatch) {
                                var actualUsername = mcUserMatch[1];
                                var actualMessage = mcUserMatch[2];
                                relayMessage = actualUsername + " [MC]: " + actualMessage;
                            } else {
                                // MC message without <username> format - show as [MC]: message
                                relayMessage = "[MC]: " + message;
                            }
                        } else {
                            // All other IRC users
                            relayMessage = sender + " [IRC]: " + message;
                        }
                        
                        this.sendBBSMessage(CHANNEL_NUM, relayMessage);
                        if (DEBUG_MODE) alert("Relayed IRC message to BBS: " + relayMessage);
                    }
                }
            }
        }
    }
};

// Setup node spoofing to receive messages on node 13
IRCBridge.prototype.setupNodeSpoof = function() {
    try {
        if (DEBUG_MODE) alert("Setting up node " + SPOOF_NODE + " to receive messages from channel " + CHANNEL_NUM);
        
        // Store original node settings for restoration later
        var originalNode = system.node_list[SPOOF_NODE - 1];
        this.originalNodeSettings = {
            status: originalNode.status,
            action: originalNode.action,
            aux: originalNode.aux,
            useron: originalNode.useron,
            connection: originalNode.connection,
            misc: originalNode.misc
        };
        
        // Configure node 13 to appear active in the target channel
        system.node_list[SPOOF_NODE - 1].status = NODE_INUSE;        // Make it appear active
        system.node_list[SPOOF_NODE - 1].action = NODE_MCHT;         // Set to multinode chat
        system.node_list[SPOOF_NODE - 1].aux = CHANNEL_NUM;          // Set to target channel
        system.node_list[SPOOF_NODE - 1].useron = SPOOF_USER;       // Use current user number
        system.node_list[SPOOF_NODE - 1].connection = 0xFFFF;        // Telnet connection
        system.node_list[SPOOF_NODE - 1].misc = 0;                   // No special flags
        
        if (DEBUG_MODE) alert("Node " + SPOOF_NODE + " configured to receive messages from channel " + CHANNEL_NUM);
        return true;
        
    } catch (error) {
        if (DEBUG_MODE) alert("Error setting up node spoof: " + error.toString());
        return false;
    }
};

// Disconnect from the IRC server
IRCBridge.prototype.disconnect = function() {
    if (this.connected) {
        this.sendIRCMessage(IRC_CHANNEL, "SyncChat IRC Bridge disconnected");
        this.sendBBSMessage(CHANNEL_NUM, "SyncChat IRC Bridge disconnected");
        this.send("QUIT :Disconnecting\r\n");
        this.socket.close();
        this.connected = false;
        if (DEBUG_MODE) alert("Disconnected from IRC server.");
    }
    
    // Restore node spoofing settings
    this.restoreNodeSpoof();
};

// Find users in a specific BBS channel
IRCBridge.prototype.findUsers = function(channel) {
    var usersInChannel = [];
    
    // Iterate through all nodes
    for (var i = 0; i < system.node_list.length; i++) {
        var node = system.node_list[i];
        
        // Check if node is in multinode chat
        if (node.action == NODE_MCHT && 
            (node.status == NODE_INUSE || node.status == NODE_QUIET)) {
            
            // Check if node is in the specified channel
            // The channel number is stored in node.aux (lower 8 bits)
            var nodeChannel = node.aux & 0xFF;
            
            if (nodeChannel == channel) {
                usersInChannel.push({
                    node_num: i + 1,  // Node numbers are 1-based
                    user_num: node.useron,
                    status: node.status,
                    anonymous: (node.misc & 0x01) != 0  // NODE_ANON flag
                });
            }
        }
    }
    
    return usersInChannel;
};

// Send a message to users in a BBS channel
IRCBridge.prototype.sendBBSMessage = function(channel, message) {
    var usersInChannel = this.findUsers(channel);
    
    // Format the message (similar to ChatLineFmt in C code)
    var formattedMessage = message + "\r\n";
    
    // Send to all users in the channel
    for (var i = 0; i < usersInChannel.length; i++) {
        var targetNode = usersInChannel[i].node_num;
        
        // Send the message using system.put_node_message
        system.put_node_message(targetNode, formattedMessage);
    }
};

// Check for and process BBS messages to relay to IRC
IRCBridge.prototype.checkBBSMessages = function() {
    // Check for user join/leave events
    this.checkMultinodeChatUsers();
    
    var nodeMessage = system.get_node_message(SPOOF_NODE);
    
    if (nodeMessage && nodeMessage.length > 0) {
        if (DEBUG_MODE) alert("Received BBS message on node " + SPOOF_NODE + ": " + nodeMessage);
        var messageLines = nodeMessage.split('\r\n');

        // Relay only multinode chat messages that match the format
        for (var i = 0; i < messageLines.length; i++) {
            var line = messageLines[i];
            if (line.length > 0) {
                // Remove Ctrl-A codes for cleaner processing
                var cleanMessage = line.replace(/\x01./g, '');
                
                // Check if message matches multinode format: username + spaces + node number + semicolon + content
                var multinodeMatch = cleanMessage.match(/^([^\s]+)\s+(\d+):\s*(.+)$/);
                if (multinodeMatch) {
                    var username = multinodeMatch[1];
                    var content = multinodeMatch[3];
                    
                    this.sendIRCMessage(IRC_CHANNEL, "<" + username + "> " + content);
                    if (DEBUG_MODE) alert("Relayed BBS message to IRC: <" + username + "> " + content);
                }
                // Messages that don't match the format are filtered out
            }
        }
    }
};

// Check for users joining/leaving multinode chat
IRCBridge.prototype.checkMultinodeChatUsers = function() {
    var currentChatUsers = this.findUsers(CHANNEL_NUM);
    
    // Find users who joined (in current but not in previous)
    for (var i = 0; i < currentChatUsers.length; i++) {
        var found = false;
        for (var j = 0; j < this.previousChatUsers.length; j++) {
            if (currentChatUsers[i].node_num == this.previousChatUsers[j].node_num) {
                found = true;
                break;
            }
        }
        if (!found) {
            // User joined
            var user = new User(currentChatUsers[i].user_num);
            var userName = user.handle || user.alias || "Unknown User";
            var joinMessage = userName + " has joined multinode chat channel " + CHANNEL_NUM;
            this.sendIRCMessage(IRC_CHANNEL, joinMessage);
            if (DEBUG_MODE) alert("User joined: " + userName);
        }
    }
    
    // Find users who left (in previous but not in current)
    for (var i = 0; i < this.previousChatUsers.length; i++) {
        var found = false;
        for (var j = 0; j < currentChatUsers.length; j++) {
            if (this.previousChatUsers[i].node_num == currentChatUsers[j].node_num) {
                found = true;
                break;
            }
        }
        if (!found) {
            // User left
            var user = new User(this.previousChatUsers[i].user_num);
            var userName = user.handle || user.alias || "Unknown User";
            var leaveMessage = userName + " has left multinode chat channel " + CHANNEL_NUM;
            this.sendIRCMessage(IRC_CHANNEL, leaveMessage);
            if (DEBUG_MODE) alert("User left: " + userName);
        }
    }
    
    // Update previous users list
    this.previousChatUsers = currentChatUsers;
};

// Broadcast initial user list to IRC
IRCBridge.prototype.broadcastInitialUserList = function() {
    var currentUsers = this.findUsers(CHANNEL_NUM);
    this.previousChatUsers = currentUsers; // Initialize tracking
    
    if (currentUsers.length > 0) {
        var userNames = [];
        for (var i = 0; i < currentUsers.length; i++) {
            var user = new User(currentUsers[i].user_num);
            var userName = user.handle || user.alias || "Unknown User";
            userNames.push(userName);
        }
        var userListMessage = "Current multinode chat channel " + CHANNEL_NUM + " users: " + userNames.join(", ");
        this.sendIRCMessage(IRC_CHANNEL, userListMessage);
        if (DEBUG_MODE) alert("Broadcasted user list: " + userNames.join(", "));
    } else {
        this.sendIRCMessage(IRC_CHANNEL, "No users currently in multinode chat channel " + CHANNEL_NUM);
        if (DEBUG_MODE) alert("No users currently in multinode chat");
    }
};

// Handle IRC NAMES reply to build user list
IRCBridge.prototype.handleNamesReply = function(line) {
    // Format: :server 353 nick = #channel :nick1 nick2 nick3
    var match = line.match(/:\S+ 353 \S+ . (#\S+) :(.+)$/);
    if (match && match[1] === IRC_CHANNEL) {
        var userList = match[2].split(' ');
        for (var i = 0; i < userList.length; i++) {
            var user = userList[i].replace(/[@+%&~]/, ''); // Remove channel modes
            if (user && user !== this.nick && this.ircUsers.indexOf(user) === -1) {
                this.ircUsers.push(user);
            }
        }
        if (DEBUG_MODE) alert("Added IRC users: " + userList.join(", "));
    }
};

// Handle end of NAMES list - broadcast initial IRC user list to BBS
IRCBridge.prototype.handleEndOfNames = function() {
    if (!this.hasRequestedNames) {
        this.hasRequestedNames = true;
        
        if (this.ircUsers.length > 0) {
            var userListMessage = "Current [IRC] users: " + this.ircUsers.join(", ");
            this.sendBBSMessage(CHANNEL_NUM, userListMessage);
            if (DEBUG_MODE) alert("Broadcasted IRC user list to BBS: " + this.ircUsers.join(", "));
        } else {
            this.sendBBSMessage(CHANNEL_NUM, "No [IRC] users currently online");
            if (DEBUG_MODE) alert("No other IRC users currently online");
        }
    }
};

// Handle IRC user joining channel
IRCBridge.prototype.handleUserJoin = function(line) {
    // Format: :nick!user@host JOIN :#channel or :nick!user@host JOIN #channel
    var match = line.match(/^:([^!]+)![^\s]+ JOIN :?(#\S+)$/);
    if (match && match[2] === IRC_CHANNEL) {
        var user = match[1];
        if (user !== this.nick && this.ircUsers.indexOf(user) === -1) {
            this.ircUsers.push(user);
            var joinMessage = user + " [IRC]" + " has joined IRC channel " + IRC_CHANNEL;
            this.sendBBSMessage(CHANNEL_NUM, joinMessage);
            if (DEBUG_MODE) alert("IRC user joined: " + user);
        }
    }
};

// Handle IRC user quitting
IRCBridge.prototype.handleUserQuit = function(line) {
    // Format: :nick!user@host QUIT :reason
    var match = line.match(/^:([^!]+)![^\s]+ QUIT :(.*)$/);
    if (match) {
        var user = match[1];
        var reason = match[2] || "No reason given";
        var userIndex = this.ircUsers.indexOf(user);
        if (userIndex !== -1) {
            this.ircUsers.splice(userIndex, 1);
            var quitMessage = user + " [IRC]" + " has quit IRC" + " (" + reason + ")";
            this.sendBBSMessage(CHANNEL_NUM, quitMessage);
            if (DEBUG_MODE) alert("IRC user quit: " + user + " (" + reason + ")");
        }
    }
};

// Handle IRC user leaving channel
IRCBridge.prototype.handleUserPart = function(line) {
    // Format: :nick!user@host PART #channel or :nick!user@host PART #channel :reason
    var match = line.match(/^:([^!]+)![^\s]+ PART (#\S+)(?:\s+:(.*))?$/);
    if (match && match[2] === IRC_CHANNEL) {
        var user = match[1];
        var reason = match[3] || "No reason given";
        var userIndex = this.ircUsers.indexOf(user);
        if (userIndex !== -1) {
            this.ircUsers.splice(userIndex, 1);
            var partMessage = user + " has left IRC channel " + IRC_CHANNEL + " (" + reason + ")";
            this.sendBBSMessage(CHANNEL_NUM, partMessage);
            if (DEBUG_MODE) alert("IRC user left channel: " + user + " (" + reason + ")");
        }
    }
};

// Handle IRC nick changes
IRCBridge.prototype.handleNickChange = function(line) {
    // Format: :oldnick!user@host NICK :newnick or :oldnick!user@host NICK newnick
    var match = line.match(/^:([^!]+)![^\s]+ NICK :?(.+)$/);
    if (match) {
        var oldNick = match[1];
        var newNick = match[2];
        var userIndex = this.ircUsers.indexOf(oldNick);
        if (userIndex !== -1) {
            this.ircUsers[userIndex] = newNick;
            var nickMessage = oldNick + " [IRC]" + " is now known as " + newNick;
            this.sendBBSMessage(CHANNEL_NUM, nickMessage);
            if (DEBUG_MODE) alert("IRC nick change: " + oldNick + " -> " + newNick);
        }
    }
};

// Restore original node settings
IRCBridge.prototype.restoreNodeSpoof = function() {
    if (this.originalNodeSettings) {
        try {
            var node = system.node_list[SPOOF_NODE - 1];
            node.status = this.originalNodeSettings.status;
            node.action = this.originalNodeSettings.action;
            node.aux = this.originalNodeSettings.aux;
            node.useron = this.originalNodeSettings.useron;
            node.connection = this.originalNodeSettings.connection;
            node.misc = this.originalNodeSettings.misc;
            
            if (DEBUG_MODE) alert("Node " + SPOOF_NODE + " settings restored");
            this.originalNodeSettings = null;
            
        } catch (error) {
            if (DEBUG_MODE) alert("Error restoring node settings: " + error.toString());
        }
    }
};

var client = new IRCBridge(NICK, USERNAME, REALNAME);

if (client.connect()) {
    client.login();

    // Wait a moment for login to complete
    mswait(2000);

    // Join the main channel
    client.joinChannel(IRC_CHANNEL);

    // Wait a moment for join to complete
    mswait(1000);
    // Send hello world message
    client.sendIRCMessage(IRC_CHANNEL, "SyncChat IRC Bridge is now active in channel " + IRC_CHANNEL);

    if (DEBUG_MODE) alert("Sent hello message to " + IRC_CHANNEL + " channel");

    client.sendBBSMessage(CHANNEL_NUM, "SyncChat IRC Bridge is now active in channel " + CHANNEL_NUM);

    // Setup node spoofing before starting the receive loop
    if (!client.setupNodeSpoof()) {
        if (DEBUG_MODE) alert("Failed to setup node spoofing - messages may not be received properly");
    }

    // Broadcast initial user list to IRC
    client.broadcastInitialUserList();

    // Start receiving messages and relaying between IRC and BBS
    client.receiveLoop();

    // Disconnect will happen when receiveLoop exits
    client.disconnect();
}