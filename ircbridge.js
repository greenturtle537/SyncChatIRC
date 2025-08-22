// Load Synchronet socket definitions
load('sockdefs.js');
// Load node action and status constants
load("nodedefs.js");

// User input dependencies
require("sbbsdefs.js", "K_NONE");
require("mouse_getkey.js", "mouse_getkey");

const IRC_SERVER = "glitchtech.top";
const IRC_PORT = 6667;
const NICK = "GN";
const USERNAME = "GNIRCBOT";
const REALNAME = "GlitchNet IRC Bridge Bot";
const CHANNEL_NUM = 2;
const IRC_CHANNEL = "#main";
const SPOOF_NODE = 13;


function IRCBridge(nick, username, realname) {
    this.nick = nick;
    this.username = username;
    this.realname = realname;
    this.socket = new Socket(SOCK_STREAM);
    this.connected = false;
    this.originalNodeSettings = null;
}

// Connect to IRC server
IRCBridge.prototype.connect = function() {
    alert("Connecting to IRC server " + IRC_SERVER + ":" + IRC_PORT + "...");

    if (!this.socket.connect(IRC_SERVER, IRC_PORT)) {
        alert("Connection failed.");
        return false;
    }

    alert("Connected successfully!");
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
            alert("Disconnecting due to user request.");
            break; // Exit the loop
        }

        this.checkBBSMessages();
        
        var line = this.socket.recvline(512, 300);

        // Only process IRC messages if we received data
        if (line != null) {
            //alert("<< " + line);

            // Respond to server PING to stay connected
            if (line.indexOf("PING") === 0) {
                var pong = line.replace("PING", "PONG");
                this.send(pong + "\r\n");
                alert(">> " + pong);
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
                        var relayMessage = "[IRC-" + sender + "] " + message;
                        this.sendBBSMessage(CHANNEL_NUM, relayMessage);
                        alert("Relayed IRC message to BBS: " + relayMessage);
                    }
                }
            }
        }
    }
};

// Setup node spoofing to receive messages on node 13
IRCBridge.prototype.setupNodeSpoof = function() {
    try {
        alert("Setting up node " + SPOOF_NODE + " to receive messages from channel " + CHANNEL_NUM);
        
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
        system.node_list[SPOOF_NODE - 1].useron = user.number;       // Use current user number
        system.node_list[SPOOF_NODE - 1].connection = 0xFFFF;        // Telnet connection
        system.node_list[SPOOF_NODE - 1].misc = 0;                   // No special flags
        
        alert("Node " + SPOOF_NODE + " configured to receive messages from channel " + CHANNEL_NUM);
        return true;
        
    } catch (error) {
        alert("Error setting up node spoof: " + error.toString());
        return false;
    }
};

// Disconnect from the IRC server
IRCBridge.prototype.disconnect = function() {
    if (this.connected) {
        this.send("QUIT :Disconnecting\r\n");
        this.socket.close();
        this.connected = false;
        alert("Disconnected from IRC server.");
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
    var successCount = 0;
    
    // Format the message (similar to ChatLineFmt in C code)
    var formattedMessage = format("[%s] (%d): %s\r\n", 
        'IRC',      // Current user's handle
        SPOOF_NODE,    // Current node number  
        message          // The message text
    );
    
    // Send to all users in the channel
    for (var i = 0; i < usersInChannel.length; i++) {
        var targetNode = usersInChannel[i].node_num;
        
        // Send the message using system.put_node_message
        if (system.put_node_message(targetNode, formattedMessage)) {
            successCount++;
        }
    }
    
    return {
        sent: successCount,
        total: usersInChannel.length - 1  // Exclude self
    };
};

// Check for and process BBS messages to relay to IRC
IRCBridge.prototype.checkBBSMessages = function() {
    var nodeMessage = system.get_node_message(SPOOF_NODE);
    
    if (nodeMessage && nodeMessage.length > 0) {
        alert("Received BBS message on node " + SPOOF_NODE + ": " + nodeMessage);
        var messageLines = nodeMessage.split('\r\n');

        // Relay all non-empty message lines directly to IRC
        for (var i = 0; i < messageLines.length; i++) {
            var line = messageLines[i];
            if (line.length > 0) {
                // Remove Ctrl-A codes for cleaner IRC display
                var cleanMessage = line.replace(/\x01./g, '');
                this.sendIRCMessage(IRC_CHANNEL, "[BBS] " + cleanMessage);
                alert("Relayed BBS message to IRC: " + cleanMessage);
            }
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
            
            alert("Node " + SPOOF_NODE + " settings restored");
            this.originalNodeSettings = null;
            
        } catch (error) {
            alert("Error restoring node settings: " + error.toString());
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

    alert("Sent hello message to " + IRC_CHANNEL + " channel");

    client.sendBBSMessage(CHANNEL_NUM, "SyncChat IRC Bridge is now active in channel " + CHANNEL_NUM);

    // Setup node spoofing before starting the receive loop
    if (!client.setupNodeSpoof()) {
        alert("Failed to setup node spoofing - messages may not be received properly");
    }

    // Start receiving messages and relaying between IRC and BBS
    client.receiveLoop();

    // Disconnect will happen when receiveLoop exits
    client.disconnect();
}