// Load Synchronet socket definitions
load('sockdefs.js');

const IRC_SERVER = "glitchtech.top";
const IRC_PORT = 6667;
const NICK = "GN";
const USERNAME = "GNIRCBOT";
const REALNAME = "GlitchNet IRC Bridge Bot";
const BBSNAME = "GlitchNet IRC Bridge";
const PASS = "YTFTPE5TNQXX";
const CHANNEL_NUM = 2;


function IRCClient(nick, username, realname) {
    this.nick = nick;
    this.username = username;
    this.realname = realname;
    this.socket = new Socket(SOCK_STREAM);
    this.connected = false;
}

// Connect to IRC server
IRCClient.prototype.connect = function() {
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
IRCClient.prototype.login = function() {
    if (!this.connected) return;

    this.send("NICK " + this.nick + "\r\n");
    this.send("USER " + this.username + " 0 * :" + this.realname + "\r\n");
};

// Send a message to the IRC server
IRCClient.prototype.send = function(message) {
    if (this.socket && this.connected) {
        this.socket.send(message);
    }
};

// Join a channel on the IRC server
IRCClient.prototype.joinChannel = function(channel) {
    this.send("JOIN " + channel + "\r\n");
};

// Send a public message to a channel
IRCClient.prototype.sendMessage = function(channel, message) {
    this.send("PRIVMSG " + channel + " :" + message + "\r\n");
};

// Receive and handle incoming messages
IRCClient.prototype.receiveLoop = function() {
    while (!js.terminated && this.connected) {
        var line = this.socket.recvline(512, 300);
        if (line == null) continue;

        alert("<< " + line);

        // Respond to server PING to stay connected
        if (line.indexOf("PING") === 0) {
            var pong = line.replace("PING", "PONG");
            this.send(pong + "\r\n");
            alert(">> " + pong);
        }
    }
};

// Disconnect from the IRC server
IRCClient.prototype.disconnect = function() {
    if (this.connected) {
        this.send("QUIT :Disconnecting\r\n");
        this.socket.close();
        this.connected = false;
        alert("Disconnected from IRC server.");
    }
};

var client = new IRCClient(NICK, USERNAME, REALNAME);

if (client.connect()) {
    client.login();

    // Wait a moment for login to complete
    mswait(2000);

    // Join the main channel
    client.joinChannel("#main");

    // Wait a moment for join to complete
    mswait(1000);

    // Send hello world message
    client.sendMessage("#main", "Hello World! SyncChat IRC Bridge is now active.");

    alert("Sent hello message to #main channel");

    bbs.login(BBSNAME, PASS, PASS, PASS);

    // Simulate pressing Enter/Return key to send message
    //console.ungetstr('\r');

    console.ungetstr('c')

    // Start receiving messages (optional - comment out if you don't want to stay connected)
    //client.receiveLoop();

    // Disconnect after sending message
    client.disconnect();
}